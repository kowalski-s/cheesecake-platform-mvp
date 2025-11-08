// Netlify Function: POST /.netlify/functions/storage-setup
// Ensures required Storage buckets exist: materials (public), submissions (private)
// Auth: allow admin/teacher; dev bypass via NETLIFY_DEV=true

import { supabase as admin } from './_supabaseClient.js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders }
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: 'Method Not Allowed' }
  }

  const isDev = process.env.NETLIFY_DEV === 'true'
  const authHeader = event.headers?.authorization || event.headers?.Authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  try {
    // AuthZ: require admin or teacher in prod; allow in dev
    if (!isDev) {
      if (!token) {
        return resp(401, { ok: false, message: 'Missing Bearer token' })
      }
      const { data: userData, error: userErr } = await admin.auth.getUser(token)
      if (userErr || !userData?.user) {
        return resp(401, { ok: false, message: 'Invalid token' })
      }
      const userId = userData.user.id
      const { data: profile } = await admin.from('users').select('role').eq('id', userId).single()
      const role = profile?.role?.trim()?.toLowerCase()
      if (!['admin', 'teacher'].includes(role)) {
        return resp(403, { ok: false, message: 'Forbidden: role not allowed' })
      }
    }

    const { data: buckets, error: lbErr } = await admin.storage.listBuckets()
    if (lbErr) throw lbErr
    const names = new Set((buckets || []).map(b => b.name))

    const created = {}

    if (!names.has('materials')) {
      const { error } = await admin.storage.createBucket('materials', { public: true })
      if (error) throw error
      created.materials = true
    } else {
      created.materials = false
    }

    if (!names.has('submissions')) {
      const { error } = await admin.storage.createBucket('submissions', { public: false })
      if (error) throw error
      created.submissions = true
    } else {
      created.submissions = false
    }

    return resp(200, { ok: true, created })
  } catch (e) {
    return resp(500, { ok: false, message: e?.message || 'Bucket setup failed' })
  }
}

function resp(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  }
}