import { createClient } from 'jsr:@supabase/supabase-js@2'

const createSupabaseAdminClient = () =>
  createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

export { createSupabaseAdminClient }
