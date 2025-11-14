import { supabase } from '@/lib/supabaseClient'

// Fetch notifications for the current user (RLS restricts scope)
export async function getUserNotifications({ limit = 20, offset = 0 } = {}) {
  const from = Number(offset) || 0
  const to = from + (Number(limit) || 20) - 1
  const q = supabase
    .from('notifications')
    .select('*')
    .order('is_read', { ascending: true })
    .order('created_at', { ascending: false })
    .range(from, to)
  const { data, error } = await q
  return { data: data || [], error }
}

// Mark a single notification as read
export async function markNotificationRead(id) {
  if (!id) return { error: new Error('id is required') }
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('id', id)
  return { error }
}

// Mark all notifications for current user as read (RLS will limit scope)
export async function markAllNotificationsRead() {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq('is_read', false)
  return { error }
}

// Subscribe to realtime notifications for current user
export async function subscribeToNotifications(onNew) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id
    if (!userId) return null

    const channel = supabase.channel('notifications_channel_' + userId)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        const notif = payload?.new || null
        if (notif && typeof onNew === 'function') onNew(notif)
      })
      .subscribe()

    return channel
  } catch (e) {
    console.error('subscribeToNotifications failed', e)
    return null
  }
}

export default {
  getUserNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToNotifications,
}