// Netlify Function: POST /.netlify/functions/admin-users
// Admin operations on users: create, update_role, delete. Uses Supabase service key.

import { supabase } from './_supabaseClient.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const handler = async (event) => {
  try {
    if (event.httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: corsHeaders, body: '' }
    }
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Method Not Allowed' }) }
    }

    // supabase util throws if env missing; catch and return readable error
    // (message includes "Missing SUPABASE_URL/SUPABASE_SERVICE_KEY")

    const authHeader = event.headers?.authorization || event.headers?.Authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Unauthorized' }) }
    }
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: userData, error: getUserError } = await supabase.auth.getUser(token)
    if (getUserError || !userData?.user?.id) {
      return { statusCode: 401, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'Unauthorized user' }) }
    }
    const callerId = userData.user.id

    // Check admin role in public.users
    const { data: adminRow, error: roleErr } = await supabase.from('users').select('role').eq('id', callerId).maybeSingle()
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

    if (action === 'create') {
      const email = String(payload?.email || '').trim().toLowerCase()
      const role = String(payload?.role || '').trim().toLowerCase()
      if (!email || !role) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'email and role required' }) }
      }
      // Create user in auth; if exists, upsert public.users
      const { data: created, error: cErr } = await supabase.auth.admin.createUser({ email, email_confirm: true })
      let uid = created?.user?.id || null
      if (cErr && !uid) {
        // Try fetch by email via v_users_full
        const { data: urows } = await supabase.from('v_users_full').select('id').eq('email', email).limit(1)
        uid = urows && urows[0]?.id || null
        if (!uid) {
          return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: cErr.message || 'createUser failed' }) }
        }
      }
      const displayName = email.split('@')[0]
      const { error: upErr } = await supabase.from('users').upsert({ id: uid, role, display_name: displayName })
      if (upErr) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: upErr.message || 'Upsert public.users failed' }) }
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true, data: { id: uid, email, role } }) }
    }

    if (action === 'update_role') {
      const targetUserId = String(payload?.user_id || '').trim()
      const newRole = String(payload?.role || '').trim().toLowerCase()
      if (!targetUserId || !newRole) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'user_id and role required' }) }
      }
      const { error: upRoleErr } = await supabase.from('users').update({ role: newRole }).eq('id', targetUserId)
      if (upRoleErr) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: upRoleErr.message || 'Update role failed' }) }
      }
      return { statusCode: 200, headers: corsHeaders, body: JSON.stringify({ ok: true }) }
    }

    if (action === 'delete') {
      const targetUserId = String(payload?.user_id || '').trim()
      if (!targetUserId) {
        return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ ok: false, error: 'user_id required' }) }
      }
      const { error: delErr } = await supabase.auth.admin.deleteUser(targetUserId)
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