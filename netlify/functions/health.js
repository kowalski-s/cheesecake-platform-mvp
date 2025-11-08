export const handler = async () => {
  const ok = !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_KEY
  return {
    statusCode: ok ? 200 : 500,
    body: JSON.stringify({
      ok,
      hasUrl: !!process.env.SUPABASE_URL,
      hasServiceKey: !!process.env.SUPABASE_SERVICE_KEY,
    }),
  }
}