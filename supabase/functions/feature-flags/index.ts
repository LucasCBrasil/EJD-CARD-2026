import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Edge Function: Feature Flags
// GET - Lista todas as flags (público)
// PUT - Atualiza uma flag (apenas admin)

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Verificar se usuário é admin
async function isAdmin(authHeader: string | null): Promise<{ isAdmin: boolean; userId?: string }> {
  if (!authHeader || !supabaseAdmin) return { isAdmin: false }
  
  const token = authHeader.replace('Bearer ', '')
  
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) {
      console.log('[feature-flags] Auth error:', error?.message)
      return { isAdmin: false }
    }
    
    // Buscar role do usuário na tabela app_users
    const { data: appUser, error: appError } = await supabaseAdmin
      .from('app_users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    
    if (appError) {
      console.log('[feature-flags] Error fetching app_user:', appError.message)
    }
    
    console.log('[feature-flags] User role:', appUser?.role, 'isAdmin:', appUser?.role === 'admin')
    
    return { 
      isAdmin: appUser?.role === 'admin', 
      userId: user.id 
    }
  } catch (e: any) {
    console.error('[feature-flags] isAdmin error:', e?.message)
    return { isAdmin: false }
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  console.log('[feature-flags] Request:', req.method, req.url)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ success: false, error: 'Supabase not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const url = new URL(req.url)
    const flagKey = url.searchParams.get('key')

    // GET - Listar flags (público)
    if (req.method === 'GET') {
      if (flagKey) {
        // Buscar flag específica
        const { data, error } = await supabaseAdmin
          .from('feature_flags')
          .select('key, enabled, description')
          .eq('key', flagKey)
          .maybeSingle()
        
        if (error) {
          return new Response(JSON.stringify({ success: false, error: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        
        if (!data) {
          return new Response(JSON.stringify({ success: false, error: 'Flag not found' }), {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
        
        return new Response(JSON.stringify({ success: true, data }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Listar todas
      const { data, error } = await supabaseAdmin
        .from('feature_flags')
        .select('key, enabled, description, updated_at')
        .order('key')
      
      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      
      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // PUT - Atualizar flag (apenas admin)
    if (req.method === 'PUT') {
      const authHeader = req.headers.get('authorization')
      const { isAdmin: userIsAdmin, userId } = await isAdmin(authHeader)
      
      if (!userIsAdmin) {
        return new Response(JSON.stringify({ success: false, error: 'Apenas administradores podem alterar feature flags' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const body = await req.json()
      const { key, enabled } = body

      if (!key || typeof enabled !== 'boolean') {
        return new Response(JSON.stringify({ success: false, error: 'key e enabled são obrigatórios' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data, error } = await supabaseAdmin
        .from('feature_flags')
        .update({ 
          enabled, 
          updated_by: userId,
          updated_at: new Date().toISOString() 
        })
        .eq('key', key)
        .select('key, enabled, description')
        .maybeSingle()
      
      if (error) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      if (!data) {
        return new Response(JSON.stringify({ success: false, error: 'Flag not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      console.log(`[feature-flags] Flag '${key}' atualizada para ${enabled} por ${userId}`)

      return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('[feature-flags] Erro:', error?.message)
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Erro inesperado' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

