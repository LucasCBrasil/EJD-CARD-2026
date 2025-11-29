import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Edge Function: Listar todos os usuários
// GET - Lista usuários (apenas admin)

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''

const supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  : null

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Verificar se usuário é admin
async function isAdmin(authHeader: string | null): Promise<boolean> {
  if (!authHeader || !supabaseAdmin) return false
  
  const token = authHeader.replace('Bearer ', '')
  
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !user) return false
    
    // Buscar role do usuário
    const { data: profile } = await supabaseAdmin
      .from('app_users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    
    return profile?.role === 'admin'
  } catch {
    return false
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  console.log('[list-users] Request:', req.method)

  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: corsHeaders })
  }

  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ success: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!supabaseAdmin) {
    return new Response(JSON.stringify({ success: false, error: 'Supabase not configured' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Verificar se é admin
  const authHeader = req.headers.get('authorization')
  const userIsAdmin = await isAdmin(authHeader)
  
  if (!userIsAdmin) {
    return new Response(JSON.stringify({ success: false, error: 'Apenas administradores podem listar usuários' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const url = new URL(req.url)
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const search = url.searchParams.get('search') || ''
    const roleFilter = url.searchParams.get('role') || ''
    
    const offset = (page - 1) * limit

    // Query base
    let query = supabaseAdmin
      .from('app_users')
      .select('id, email, name, role, created_at', { count: 'exact' })

    // Filtros
    if (search) {
      query = query.or(`email.ilike.%${search}%,name.ilike.%${search}%`)
    }
    
    if (roleFilter) {
      query = query.eq('role', roleFilter)
    }

    // Ordenação e paginação
    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error('[list-users] Erro:', error.message)
      return new Response(JSON.stringify({ success: false, error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ 
      success: true, 
      data,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('[list-users] Erro:', error?.message)
    return new Response(JSON.stringify({ success: false, error: error?.message || 'Erro inesperado' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

