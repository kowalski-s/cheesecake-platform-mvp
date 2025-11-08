import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_KEY

if (!url || !serviceKey) {
  // Конкретная строка используется в клиенте для показа подсказки
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY (functions env)')
}

export const supabase = createClient(url, serviceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
})