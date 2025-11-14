-- Add end_at to subscriptions for real expiration tracking
alter table public.subscriptions
  add column if not exists end_at timestamptz;

-- Optional: total lessons on subscription
alter table public.subscriptions
  add column if not exists lessons_total int;