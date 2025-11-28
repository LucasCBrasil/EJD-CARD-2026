/**
 * Edge Function: manage-products
 * 
 * Gerencia produtos de forma segura (CRUD):
 * - Criar produto (admin, lojinha para lojinha, lanchonete para lanchonete)
 * - Atualizar produto (admin, lojinha para lojinha, lanchonete para lanchonete)
 * - Deletar produto / Desativar (admin, lojinha para lojinha, lanchonete para lanchonete)
 * - Listar produtos (público)
 * 
 * Utilitários inline (para evitar problemas de bundle com _shared)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type UserRole = 'admin' | 'lojinha' | 'lanchonete' | 'comunicacao' | 'servico' | 'encontrista'

interface ApiResponse {
  success: boolean
  data?: any
  error?: string
  message?: string
}

// ==================== UTILITÁRIOS ====================

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
      email: user.email,
      role: user.role
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
      } as ApiResponse),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  return user
}

const getUserRole = async (userId: string): Promise<UserRole> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials')
    return 'servico'
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  
  const { data: appUser } = await supabase
    .from('app_users')
    .select('role')
    .eq('id', userId)
    .single()

  return (appUser?.role as UserRole) || 'servico'
}

// Permissões simplificadas - apenas o que precisamos para produtos
const hasPermission = (userRole: UserRole, permission: 'canManageProductsLojinha' | 'canManageProductsLanchonete'): boolean => {
  if (userRole === 'admin') return true
  
  if (permission === 'canManageProductsLojinha') {
    return userRole === 'lojinha'
  }
  
  if (permission === 'canManageProductsLanchonete') {
    return userRole === 'lanchonete'
  }
  
  return false
}

const getCorsHeaders = (origin: string | null) => {
  const allowed = Deno.env.get('ALLOWED_ORIGINS') || 'http://localhost:5173,http://localhost:5174,http://localhost:3000'
  const allowedOrigins = allowed.split(',').map(o => o.trim())
  const allowOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  }
}

// ==================== FUNÇÃO PRINCIPAL ====================

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) })
  }

  try {
    // 1. VALIDAR AUTENTICAÇÃO
    const authResult = await requireAuth(req)
    if (authResult instanceof Response) {
      return authResult
    }

    const supabase = createSupabaseClient()

    // 2. VALIDAR PERMISSÕES (exceto para GET - listar é público)
    // Para POST/PUT/DELETE, verificar permissões baseadas em role e categoria
    if (req.method !== 'GET') {
      const userRole = await getUserRole(authResult.id)
      
      // Admin pode tudo
      if (userRole !== 'admin') {
        // Verificar permissões baseadas na categoria do produto
        let category: 'lojinha' | 'lanchonete' | null = null
        
        // Para POST, extrair categoria do body
        if (req.method === 'POST') {
          try {
            const body = await req.clone().json()
            category = body.category
          } catch {
            // Se não conseguir extrair, será validado depois no POST handler
          }
        }
        
        // Para PUT/DELETE, precisamos buscar o produto para saber a categoria
        if (req.method === 'PUT' || req.method === 'DELETE') {
          let productId: string | null = null
          
          if (req.method === 'PUT') {
            try {
              const body = await req.clone().json()
              productId = body.id
            } catch {
              // Será validado depois
            }
          } else {
            // DELETE - aceitar tanto query string quanto body
            const url = new URL(req.url)
            productId = url.searchParams.get('id')
            
            // Se não encontrou na query string, tenta no body
            if (!productId) {
              try {
                const body = await req.clone().json()
                productId = body.id
              } catch {
                // Body vazio ou inválido
              }
            }
          }
          
          if (productId) {
            const { data: product } = await supabase
              .from('products')
              .select('category')
              .eq('id', productId)
              .single()
            
            if (product) {
              category = product.category as 'lojinha' | 'lanchonete'
            }
          }
        }
        
        // Verificar permissões baseadas em role e categoria
        if (category) {
          const permission = category === 'lojinha' ? 'canManageProductsLojinha' : 'canManageProductsLanchonete'
          const hasPermissionToManage = hasPermission(userRole, permission)
          
          if (!hasPermissionToManage) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Acesso negado: você não tem permissão para gerenciar produtos de ${category}`
              } as ApiResponse),
              {
                status: 403,
                headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
              }
            )
          }
        }
        // Se category for null, a validação será feita no handler específico (POST)
      }
    }

    // 3. ROTEAMENTO POR MÉTODO HTTP
    switch (req.method) {
      case 'GET': {
        // LISTAR PRODUTOS (público)
        const url = new URL(req.url)
        const category = url.searchParams.get('category') as 'lojinha' | 'lanchonete' | null

        let query = supabase
          .from('products')
          .select('*')
          .eq('active', true)
          .order('created_at', { ascending: false })

        if (category) {
          query = query.eq('category', category)
        }

        const { data: products, error } = await query

        if (error) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Erro ao buscar produtos: ${error.message}`
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
            data: products
          } as ApiResponse),
          {
            status: 200,
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
          }
        )
      }

      case 'POST': {
        // CRIAR PRODUTO - verifica permissões baseadas em role e categoria
        const {
          name,
          price,
          category,
          description,
          stock
        }: {
          name: string
          price: number
          category: 'lojinha' | 'lanchonete'
          description?: string
          stock?: number
        } = await req.json()

        // Validações básicas
        if (!name || price === undefined || !category) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Dados inválidos: name, price e category são obrigatórios'
            } as ApiResponse),
            {
              status: 400,
              headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
            }
          )
        }

        if (price <= 0) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Preço deve ser maior que zero'
            } as ApiResponse),
            {
              status: 400,
              headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
            }
          )
        }

        // Verificar permissões novamente (caso não tenha sido verificada antes)
        const userRole = await getUserRole(authResult.id)
        if (userRole !== 'admin') {
          const permission = category === 'lojinha' ? 'canManageProductsLojinha' : 'canManageProductsLanchonete'
          const hasPermissionToManage = hasPermission(userRole, permission)
          
          if (!hasPermissionToManage) {
            return new Response(
              JSON.stringify({
                success: false,
                error: `Acesso negado: você não tem permissão para criar produtos de ${category}`
              } as ApiResponse),
              {
                status: 403,
                headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
              }
            )
          }
        }

        // Criar produto
        const { data: product, error } = await supabase
          .from('products')
          .insert({
            name,
            price,
            category,
            description,
            stock,
            active: true
          })
          .select()
          .single()

        if (error) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Erro ao criar produto: ${error.message}`
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
            data: product,
            message: 'Produto criado com sucesso!'
          } as ApiResponse),
          {
            status: 201,
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
          }
        )
      }

      case 'PUT': {
        // ATUALIZAR PRODUTO - permissões verificadas acima baseadas em role e categoria
        const {
          id,
          name,
          price,
          description,
          stock,
          active
        } = await req.json()

        if (!id) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'ID do produto é obrigatório'
            } as ApiResponse),
            {
              status: 400,
              headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
            }
          )
        }

        // Montar objeto de atualização (apenas campos fornecidos)
        const updates: any = {
          updated_at: new Date().toISOString()
        }
        if (name !== undefined) updates.name = name
        if (price !== undefined) {
          if (price <= 0) {
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Preço deve ser maior que zero'
              } as ApiResponse),
              {
                status: 400,
                headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
              }
            )
          }
          updates.price = price
        }
        if (description !== undefined) updates.description = description
        if (stock !== undefined) updates.stock = stock
        if (active !== undefined) updates.active = active

        const { data: product, error } = await supabase
          .from('products')
          .update(updates)
          .eq('id', id)
          .select()
          .single()

        if (error) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Erro ao atualizar produto: ${error.message}`
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
            data: product,
            message: 'Produto atualizado com sucesso!'
          } as ApiResponse),
          {
            status: 200,
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
          }
        )
      }

      case 'DELETE': {
        // DELETAR/DESATIVAR PRODUTO - permissões verificadas acima baseadas em role e categoria
        // Aceitar ID tanto na query string quanto no body (para compatibilidade)
        const url = new URL(req.url)
        let id = url.searchParams.get('id')
        
        // Se não encontrou na query string, tenta no body
        if (!id) {
          try {
            const body = await req.clone().json()
            id = body.id
          } catch {
            // Body vazio ou inválido, continua tentando query string
          }
        }

        if (!id) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'ID do produto é obrigatório'
            } as ApiResponse),
            {
              status: 400,
              headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
            }
          )
        }

        // Soft delete: marcar como inativo
        const { error } = await supabase
          .from('products')
          .update({
            active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)

        if (error) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Erro ao deletar produto: ${error.message}`
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
            message: 'Produto deletado com sucesso!'
          } as ApiResponse),
          {
            status: 200,
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
          }
        )
      }

      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Método não suportado'
          } as ApiResponse),
          {
            status: 405,
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
          }
        )
    }

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      } as ApiResponse),
      {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    )
  }
})
