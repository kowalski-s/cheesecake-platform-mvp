import { supabase } from '@/lib/supabaseClient'

export async function inviteUser({ email, display_name, role }) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  const res = await fetch('/.netlify/functions/invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ email, display_name, role }),
  })
  let data = null
  try { data = await res.json() } catch {}
  return { ok: res.ok, status: res.status, data }
}