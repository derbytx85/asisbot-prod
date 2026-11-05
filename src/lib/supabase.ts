import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Cliente server-side con service role (solo usar en API routes, nunca en el cliente)
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false }
})
