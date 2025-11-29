/**
 * Edge Function: list-coupons
 * 
 * Lista cupons de forma segura com autenticação obrigatória
 * 
 * Cupons são dados públicos, mas por segurança usamos Edge Function
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Utilitários inline (para evitar problemas de bundle com _shared)
const createSupabaseClient = () => {
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

const getAuthUser = async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return null
    }

    const token = authHeader.replace('Bearer ', '')
    if (!token) {
      return null
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase credentials')
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    const { data: { user }, error } = await supabase.auth.getUser(token)

    if (error || !user) {
      return null
    }

    return {
      id: user.id,
      email: user.email
    }
  } catch (error) {
    console.error('Error validating auth:', error)
    return null
  }
}

const requireAuth = async (req: Request) => {
  const user = await getAuthUser(req)
  
  if (!user) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Unauthorized: Authentication required' 
      }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  return user
}

const getUserRole = async (userId: string): Promise<string> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials')
    return 'encontrista'
  }

  const supabase = createSupabaseClient()
  
  const { data: appUser } = await supabase
    .from('app_users')
    .select('role')
    .eq('id', userId)
    .single()

  return appUser?.role || 'encontrista'
}

const getAllowedOrigins = () => {
  const allowed = Deno.env.get('ALLOWED_ORIGINS') || 'http://localhost:5173,http://localhost:5174,http://localhost:3000'
  return allowed.split(',').map(o => o.trim())
}

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigins = getAllowedOrigins()
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }
}

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) })
  }

  try {
    // 1. VALIDAR AUTENTICAÇÃO OBRIGATÓRIA
    const authResult = await requireAuth(req)
    if (authResult instanceof Response) {
      return new Response(authResult.body, {
        status: authResult.status,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    // 2. VALIDAR MÉTODO
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Método não permitido'
        } as ApiResponse),
        {
          status: 405,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    // 3. VERIFICAR PERMISSÕES POR CATEGORIA
    const userRole = await getUserRole(authResult.id)
    const url = new URL(req.url)
    const category = url.searchParams.get('category') as 'lojinha' | 'lanchonete' | null

    // Verificar permissões: lanchonete pode ver cupons de lanchonete, lojinha pode ver cupons de lojinha
    if (category === 'lanchonete' && !['admin', 'lanchonete'].includes(userRole)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Acesso negado: apenas administradores e lanchonete podem ver cupons de lanchonete'
        } as ApiResponse),
        {
          status: 403,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    if (category === 'lojinha' && !['admin', 'lojinha'].includes(userRole)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Acesso negado: apenas administradores e lojinha podem ver cupons de lojinha'
        } as ApiResponse),
        {
          status: 403,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    const supabase = createSupabaseClient()
    let coupons: any[] = []

    if (category === 'lanchonete') {
      // Buscar cupons da lanchonete (com valor fixo de desconto)
      const { data, error } = await supabase
        .from('lanchonete_coupons')
        .select('name, discount_amount')
        .eq('active', true)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao buscar cupons da lanchonete:', error)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao buscar cupons'
          } as ApiResponse),
          {
            status: 500,
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
          }
        )
      }

      coupons = (data || []).map((item: { name: string; discount_amount: number }) => ({
        name: item.name,
        discountAmount: parseFloat(item.discount_amount?.toString() || '0')
      }))
    } else {
      // Buscar cupons da lojinha (percentual)
      const { data, error } = await supabase
        .from('coupons')
        .select('name')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao buscar cupons da lojinha:', error)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao buscar cupons'
          } as ApiResponse),
          {
            status: 500,
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
          }
        )
      }

      coupons = (data || []).map((item: { name: string }) => ({
        name: item.name
      }))
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: coupons
      } as ApiResponse),
      {
        status: 200,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error in list-coupons:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Erro interno do servidor'
      } as ApiResponse),
      {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    )
  }
})
