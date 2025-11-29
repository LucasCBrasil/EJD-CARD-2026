/**
 * Edge Function: list-orders
 * 
 * Lista pedidos de forma segura com autenticação obrigatória
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// --- Shared Types ---
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

export type UserRole = 
  | 'admin'
  | 'lojinha'
  | 'lanchonete'
  | 'comunicacao'
  | 'servico'
  | 'encontrista'

export interface AuthUser {
  id: string
  email?: string
  role?: UserRole
}

// --- Shared CORS Headers ---
const getAllowedOrigins = () => {
  const allowed = Deno.env.get('ALLOWED_ORIGINS') || 'http://localhost:5173,http://localhost:5174,http://localhost:3000'
  return allowed.split(',').map(o => o.trim())
}

export const getCorsHeaders = (origin: string | null) => {
  const allowedOrigins = getAllowedOrigins()
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }
}

// --- Shared Supabase Client ---
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

// --- Shared Auth Utilities ---
export const getAuthUser = async (req: Request): Promise<AuthUser | null> => {
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
      email: user.email,
      role: user.role
    }
  } catch (error) {
    console.error('Error validating auth:', error)
    return null
  }
}

export const getUserRole = async (userId: string): Promise<UserRole> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials')
    return 'encontrista'
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  const { data: appUser } = await supabase
    .from('app_users')
    .select('role')
    .eq('id', userId)
    .single()

  return (appUser?.role as UserRole) || 'encontrista'
}

export const requireAuth = async (req: Request): Promise<AuthUser | Response> => {
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

// --- Main Function ---
Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) })
  }

  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof Response) {
      return new Response(authResult.body, {
        status: authResult.status,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

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

    const userRole = await getUserRole(authResult.id)
    const supabase = createSupabaseClient()
    const url = new URL(req.url)
    const category = url.searchParams.get('category') as 'lojinha' | 'sapatinho' | null

    // REGRA: Apenas admin e lojinha podem ver pedidos (tanto da lojinha quanto do sapatinho)
    if (!['admin', 'lojinha'].includes(userRole)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Acesso negado: apenas administradores e lojinha podem ver pedidos'
        } as ApiResponse),
        {
          status: 403,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    if (category === 'sapatinho') {
      // Pedidos do Sapatinho (apenas admin e lojinha podem ver)
      // Usar relacionamento direto do Supabase (como na branch que funciona)

      const { data: orders, error } = await supabase
        .from('sapatinho_veloz_orders')
        .select(`
          *,
          sapatinho_veloz_order_items (
            id,
            order_id,
            product_id,
            product_name,
            quantity,
            price,
            created_at
          )
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Erro ao buscar pedidos:', error)
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao buscar pedidos'
          } as ApiResponse),
          {
            status: 500,
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: orders || []
        } as ApiResponse),
        {
          status: 200,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    } else {
      // Pedidos da Lojinha (apenas admin e lojinha podem ver - já validado acima)

      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao buscar pedidos'
          } as ApiResponse),
          {
            status: 500,
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: orders || []
        } as ApiResponse),
        {
          status: 200,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }
  } catch (error) {
    console.error('Error in list-orders:', error)
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
