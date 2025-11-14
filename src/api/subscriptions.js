import { supabase } from '@/lib/supabaseClient'

function computeEndAt(endDate) {
  if (endDate) {
    // endDate from <input type="date"> like YYYY-MM-DD
    const d = new Date(endDate)
    return d.toISOString()
  }
  const plus30 = new Date(Date.now() + 30*24*3600*1000)
  return plus30.toISOString()
}

// Create a new active subscription for a student (studentId = public.students.id)
// Uses students.user_id as subscriptions.user_id; sets end_at.
export async function createSubscriptionForStudent(studentId, { lessonsCount = 8, endDate = null } = {}) {
  const count = Math.max(1, Number(lessonsCount) || 8)
  // Resolve students.user_id
  const { data: student, error: sErr } = await supabase
    .from('students')
    .select('id, user_id')
    .eq('id', studentId)
    .maybeSingle()
  if (sErr) throw sErr
  const userId = student?.user_id
  if (!userId) throw new Error('У ученика не задан user_id')

  const end_at = computeEndAt(endDate)
  const payloadBase = {
    user_id: userId,
    name: `Абонемент на ${count}`,
    remaining_lessons: count,
    active: true,
    end_at,
  }
  // Try with lessons_total if column exists; fallback without on specific error
  let { data, error } = await supabase
    .from('subscriptions')
    .insert({ ...payloadBase, lessons_total: count })
    .select()
    .maybeSingle()
  if (error && String(error.message).toLowerCase().includes('lessons_total')) {
    const res = await supabase
      .from('subscriptions')
      .insert(payloadBase)
      .select()
      .maybeSingle()
    data = res.data; error = res.error
  }
  if (error) throw error
  return data
}

export async function updateSubscription(id, { lessonsCount, endDate }) {
  const count = Math.max(1, Number(lessonsCount) || 1)
  const end_at = computeEndAt(endDate)
  let { data, error } = await supabase
    .from('subscriptions')
    .update({ remaining_lessons: count, end_at, lessons_total: count })
    .eq('id', id)
    .select()
    .maybeSingle()
  if (error && String(error.message).toLowerCase().includes('lessons_total')) {
    const res = await supabase
      .from('subscriptions')
      .update({ remaining_lessons: count, end_at })
      .eq('id', id)
      .select()
      .maybeSingle()
    data = res.data; error = res.error
  }
  if (error) throw error
  return data
}

// Fetch active subscriptions by studentIds for aggregation
export async function fetchActiveSubscriptionsByUsers(userIds = []) {
  if (!Array.isArray(userIds) || userIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('subscriptions')
    .select('id, user_id, remaining_lessons, end_at, active, created_at, lessons_total')
    .in('user_id', userIds)
    .eq('active', true)
  if (error) throw error
  const map = new Map()
  ;(data || []).forEach(row => {
    const uid = row.user_id
    const arr = map.get(uid) ?? []
    arr.push(row)
    map.set(uid, arr)
  })
  return map
}

export async function decrementSubscription(id) {
  // Two-step update (client-side decrement) to avoid SQL expressions in payloads
  const { data: sub, error: getErr } = await supabase
    .from('subscriptions')
    .select('id, user_id, remaining_lessons, active')
    .eq('id', id)
    .maybeSingle()
  if (getErr) throw getErr
  if (!sub?.active) throw new Error('Абонемент неактивен')
  const current = Math.max(0, Number(sub?.remaining_lessons || 0))
  const next = Math.max(0, current - 1)
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ remaining_lessons: next })
    .eq('id', id)
    .select('id, user_id, remaining_lessons, end_at, active, created_at, lessons_total')
    .maybeSingle()
  if (error) throw error
  return data
}

export async function archiveSubscription(id) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update({ active: false, remaining_lessons: 0, end_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, user_id, remaining_lessons, end_at, active, created_at, lessons_total')
    .maybeSingle()
  if (error) throw error
  return data
}