// Netlify Function: POST /.netlify/functions/admin-users
// Admin operations on users (delete). Uses Supabase service key.

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
      return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) }
    }

    const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Supabase env missing' }) }
    }
    const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const authHeader = event.headers?.authorization || event.headers?.Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Unauthorized' }) }
    }
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: userData, error: getUserError } = await client.auth.getUser(token)
    if (getUserError || !userData?.user?.id) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Unauthorized user' }) }
    }
    const callerId = userData.user.id

    // Check admin role in public.users
    const { data: adminRow, error: roleErr } = await client.from('users').select('role').eq('id', callerId).maybeSingle()
    if (roleErr) {
      return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Role check failed' }) }
    }
    const callerRole = adminRow?.role?.trim()?.toLowerCase() ?? null
    if (callerRole !== 'admin') {
      return { statusCode: 403, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Forbidden' }) }
    }

    let payload
    try {
      payload = JSON.parse(event.body || '{}')
    } catch {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Invalid JSON body' }) }
    }

    const action = String(payload?.action || '').trim().toLowerCase()
    const targetUserId = String(payload?.user_id || '').trim()
    if (!targetUserId) {
      return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'user_id required' }) }
    }

    if (action === 'delete') {
      const { error: delErr } = await client.auth.admin.deleteUser(targetUserId)
      if (delErr) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: delErr.message || 'Delete failed' }) }
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true }) }
    }

    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Unknown action' }) }
  } catch (e) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ ok: false, error: e?.message || 'Unexpected error' }) }
  }
}