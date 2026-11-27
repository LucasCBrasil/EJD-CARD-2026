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

type UserRole = 'admin' | 'lojinha' | 'lanchonete' | 'comunicacao' | 'servico' | 'encontrista' | 'coordLojinha' | 'coordLanchonete'

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

const menuCategories = ['Salgados', 'Sobremesas', 'Bebidas', 'Outros']
const productSizes = ['PP', 'P', 'M', 'G', 'GG', 'XGG']

const isValidSizeStock = (value: unknown): value is Record<string, number> | null =>
  value === null || (
    typeof value === 'object'
    && !Array.isArray(value)
    && Object.keys(value).length > 0
    && Object.entries(value).every(([size, quantity]) =>
      productSizes.includes(size) && Number.isInteger(quantity) && Number(quantity) >= 0
    )
    && Object.values(value as Record<string, number>).some((quantity) => quantity > 0)
  )


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

  return (appUser?.role as UserRole) || 'encontrista'
}

// Permissões simplificadas - apenas o que precisamos para produtos
const hasPermission = (userRole: UserRole, permission: 'canManageProductsLojinha' | 'canManageProductsLanchonete'): boolean => {
  if (userRole === 'admin') return true
  
  if (permission === 'canManageProductsLojinha') {
    return userRole === 'coordLojinha'
  }

  if (permission === 'canManageProductsLanchonete') {
    return userRole === 'coordLanchonete'
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

        const userRole = await getUserRole(authResult.id)
        const canSeeLojinhaStock = userRole === 'admin' || userRole === 'lojinha' || userRole === 'coordLojinha'
        const safeProducts = (products || []).map((product: Record<string, unknown>) => {
          if (product.category !== 'lojinha' || canSeeLojinhaStock) {
            return product
          }
          const rawStock = product.stock
          const numericStock = rawStock === null || rawStock === undefined || rawStock === '' ? NaN : Number(rawStock)
          const outOfStock = Number.isFinite(numericStock) && numericStock <= 0
          const { stock: _stock, is_consigned: _isConsigned, size_stock: _sizeStock, ...safeProduct } = product
          return { ...safeProduct, out_of_stock: outOfStock }
        })

        return new Response(
          JSON.stringify({
            success: true,
            data: safeProducts
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
          stock,
          image_url,
          is_consigned,
          menu_category,
          size_stock
        }: {
          name: string
          price: number
          category: 'lojinha' | 'lanchonete'
          description?: string
          stock?: number
          image_url?: string | null
          is_consigned?: boolean
          menu_category?: string
          size_stock?: Record<string, number> | null
        } = await req.json()

        // Validações básicas
        if (!name || price === undefined || !['lojinha', 'lanchonete'].includes(category)) {
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

        if (
          (is_consigned !== undefined && typeof is_consigned !== 'boolean')
          || (category !== 'lojinha' && is_consigned === true)
          || (menu_category !== undefined && !menuCategories.includes(menu_category))
          || (category === 'lojinha' && !isValidSizeStock(size_stock ?? null))
        ) {
          return new Response(
            JSON.stringify({ success: false, error: 'Dados inválidos para consignação ou estoque por tamanho.' } as ApiResponse),
            { status: 400, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
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

        const { data: product, error } = category === 'lojinha'
          ? await supabase.rpc('save_lojinha_product_with_sizes', {
            p_product_id: null,
            p_name: name,
            p_price: price,
            p_description: description || null,
            p_image_url: image_url || null,
            p_is_consigned: is_consigned === true,
            p_size_stock: size_stock ?? null,
            p_stock: stock ?? null,
            p_active: true,
          })
          : await supabase
            .from('products')
            .insert({
              name,
              price,
              category,
              description,
              stock,
              image_url,
              is_consigned: false,
              menu_category: menu_category || 'Outros',
              active: true,
            })
            .select()
            .single()

        const savedProduct = Array.isArray(product) ? product[0] : product

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
            data: savedProduct,
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
        const body = await req.json()
        const {
          id,
          name,
          price,
          description,
          stock,
          image_url,
          active,
          is_consigned,
          menu_category,
          size_stock,
          expected_stock,
          expected_size_stock
        } = body
        const hasSizeStock = Object.prototype.hasOwnProperty.call(body, 'size_stock')

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

        const { data: currentProduct, error: currentProductError } = await supabase
          .from('products')
          .select('is_combo, category, size_stock, stock, name, price, description, image_url, active, is_consigned')
          .eq('id', id)
          .maybeSingle()

        if (currentProductError) {
          console.error('Error checking product before update:', currentProductError.message)
          return new Response(
            JSON.stringify({ success: false, error: 'Erro ao verificar produto' } as ApiResponse),
            { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
          )
        }

        if (!currentProduct) {
          return new Response(
            JSON.stringify({ success: false, error: 'Produto não encontrado' } as ApiResponse),
            { status: 404, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
          )
        }

        if (
          currentProduct.category === 'lojinha'
          && (
            !Object.prototype.hasOwnProperty.call(body, 'expected_stock')
            || !Object.prototype.hasOwnProperty.call(body, 'expected_size_stock')
            || !(expected_stock === null || (Number.isInteger(expected_stock) && expected_stock >= 0))
            || !isValidSizeStock(expected_size_stock)
          )
        ) {
          return new Response(
            JSON.stringify({ success: false, error: 'Dados de estoque de referência inválidos. Recarregue o produto antes de salvar.' } as ApiResponse),
            { status: 400, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
          )
        }

        if (currentProduct.is_combo) {
          return new Response(
            JSON.stringify({ success: false, error: 'Combos devem ser gerenciados pela tela de combos.' } as ApiResponse),
            { status: 400, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
          )
        }

        if (
          (is_consigned !== undefined && typeof is_consigned !== 'boolean')
          || (currentProduct.category !== 'lojinha' && is_consigned === true)
          || (menu_category !== undefined && !menuCategories.includes(menu_category))
          || (currentProduct.category === 'lojinha' && hasSizeStock && !isValidSizeStock(size_stock))
        ) {
          return new Response(
            JSON.stringify({ success: false, error: 'Dados inválidos para consignação ou estoque por tamanho.' } as ApiResponse),
            { status: 400, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
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
        if (image_url !== undefined) updates.image_url = image_url
        if (active !== undefined) updates.active = active
        if (is_consigned !== undefined) updates.is_consigned = currentProduct.category === 'lojinha' && is_consigned
        if (menu_category !== undefined) {
          if (currentProduct.category !== 'lanchonete') {
            return new Response(
              JSON.stringify({ success: false, error: 'A categoria do cardápio só pode ser usada em itens da lanchonete.' } as ApiResponse),
              { status: 400, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
            )
          }
          updates.menu_category = menu_category
        }

        const { data: product, error } = currentProduct.category === 'lojinha'
          ? await supabase.rpc('save_lojinha_product_with_sizes', {
            p_product_id: id,
            p_name: name ?? currentProduct.name,
            p_price: price ?? currentProduct.price,
            p_description: description ?? currentProduct.description,
            p_image_url: image_url === undefined ? currentProduct.image_url : image_url,
            p_is_consigned: is_consigned ?? currentProduct.is_consigned,
            p_size_stock: hasSizeStock ? size_stock : currentProduct.size_stock,
            p_stock: stock ?? currentProduct.stock,
            p_active: active ?? currentProduct.active,
            p_expected_size_stock: expected_size_stock,
            p_expected_stock: expected_stock,
          })
          : await supabase
            .from('products')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) {
          if (error.message.includes('PRODUCT_STOCK_CHANGED')) {
            return new Response(
              JSON.stringify({ success: false, error: 'O estoque mudou desde que você abriu o formulário. Atualize os dados e tente novamente.' } as ApiResponse),
              { status: 409, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
            )
          }
          if (error.message.includes('PRODUCT_SIZE_RESERVED')) {
            return new Response(
              JSON.stringify({ success: false, error: 'Não é possível alterar os estoques por tamanho enquanto há carrinhos abertos com esse produto. Cancele ou finalize esses carrinhos primeiro.' } as ApiResponse),
              { status: 409, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
            )
          }
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
