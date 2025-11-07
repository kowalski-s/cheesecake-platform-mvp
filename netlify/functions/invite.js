// Netlify Function: POST /.netlify/functions/invite
// Node + @supabase/supabase-js@2
// Invites a user by email and provisions role rows in public tables.

import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export async function handler(event) {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: corsHeaders, body: '' }
    }

    if (event.httpMethod !== 'POST') {
      return {
        statusCode: 405,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }),
      }
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Supabase env missing' }),
      }
    }

    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Authorization: Bearer <access_token>
    const authHeader = event.headers?.authorization || event.headers?.Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Unauthorized' }),
      }
    }
    const token = authHeader.replace(/^Bearer\s+/i, '')

    // Validate current user via service client (bypass RLS)
    const { data: userData, error: getUserError } = await client.auth.getUser(token)
    if (getUserError || !userData?.user?.id) {
      return {
        statusCode: 401,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Unauthorized user' }),
      }
    }
    const callerId = userData.user.id

    // Check admin role in public.users
    const { data: adminRow, error: roleErr } = await client
      .from('users')
      .select('role')
      .eq('id', callerId)
      .maybeSingle()
    if (roleErr) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Role check failed' }),
      }
    }
    const callerRole = adminRow?.role?.trim()?.toLowerCase() ?? null
    if (callerRole !== 'admin') {
      return {
        statusCode: 403,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Forbidden' }),
      }
    }

    // Parse body
    let payload
    try {
      payload = JSON.parse(event.body || '{}')
    } catch {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Invalid JSON body' }),
      }
    }
    const email = String(payload?.email || '').trim()
    const display_name = String(payload?.display_name || '').trim()
    const role = String(payload?.role || '').trim().toLowerCase()
    const emailValid = /.+@.+\..+/.test(email)
    if (!emailValid) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Введите корректный email' }),
      }
    }
    if (!email) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'email and display_name are required' }),
      }
    }
    if (!['student', 'teacher'].includes(role)) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'role must be student|teacher' }),
      }
    }

    // Send invite
    const { data: invited, error: inviteErr } = await client.auth.admin.inviteUserByEmail(email, {
      data: { display_name },
    })
    if (inviteErr) {
      const msg = String(inviteErr.message || '').toLowerCase()
      const conflict = msg.includes('already') || msg.includes('exists')
      const statusCode = conflict ? 409 : 400
      return {
        statusCode,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: inviteErr.message || 'Invite failed' }),
      }
    }
    const invitedId = invited?.user?.id
    if (!invitedId) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: 'Invite returned no user id' }),
      }
    }

    // Upsert role in public.users
    const { error: upUsersErr } = await client
      .from('users')
      .upsert({ id: invitedId, role })
    if (upUsersErr) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ ok: false, error: upUsersErr.message || 'Upsert users failed' }),
      }
    }

    // Upsert profile row and bind user_id
    if (role === 'teacher') {
      const { error } = await client.from('teachers').upsert({ id: invitedId, display_name, user_id: invitedId })
      if (error) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ ok: false, error: error.message || 'Upsert teachers failed' }),
        }
      }
    } else if (role === 'student') {
      const { error } = await client.from('students').upsert({ id: invitedId, display_name, user_id: invitedId })
      if (error) {
        return {
          statusCode: 500,
          headers: corsHeaders,
          body: JSON.stringify({ ok: false, error: error.message || 'Upsert students failed' }),
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
      body: JSON.stringify({ ok: true, user: { id: invitedId, email, role } }),
    }
  } catch (e) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, error: e?.message || 'Unexpected error' }),
    }
  }
}