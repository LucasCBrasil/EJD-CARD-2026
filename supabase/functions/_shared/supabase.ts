/**
 * Cliente Supabase para usar nas Edge Functions
 * Usa a SERVICE_ROLE_KEY para ter permissões de admin
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * Criar cliente Supabase com service role (permissões completas)
 * ATENÇÃO: Este cliente só deve ser usado no servidor!
 */
export const createSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

