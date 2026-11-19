import { createSupabaseClient } from '../_shared/supabase.ts'
import { getUserRole, requireAuth } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import type { UserRole } from '../_shared/roles.ts'
import { hasPermission } from '../_shared/roles.ts';


const jsonResponse = (status: number, body: Record<string, unknown>, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
  })

const loadCart = async (supabase: ReturnType<typeof createSupabaseClient>, cartId: string) => {
  const { data: cart, error: cartError } = await supabase
    .from('lojinha_carts')
    .select('*')
    .eq('id', cartId)
    .maybeSingle()

  if (cartError) throw cartError
  if (!cart) return null

  const { data: items, error: itemsError } = await supabase
    .from('lojinha_cart_items')
    .select('product_id, product_name, price, quantity, image_url')
    .eq('cart_id', cartId)
    .order('product_name')

  if (itemsError) throw itemsError
  return { ...cart, items: items || [] }
}

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
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    const role = await getUserRole(authResult.id)
    if (!hasPermission(role as UserRole, 'canSellLojinha')) {
      return jsonResponse(403, {
        success: false,
        error: 'Acesso negado: usuário sem permissão para gerenciar carrinhos da lojinha',
      }, origin)
    }

    const supabase = createSupabaseClient()

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const cartId = url.searchParams.get('cartId')
      let targetCartId = cartId

      if (!targetCartId) {
        const userId = url.searchParams.get('userId')
        if (!userId) {
          return jsonResponse(400, { success: false, error: 'cartId ou userId é obrigatório' }, origin)
        }

        const { data, error } = await supabase.rpc('get_or_create_lojinha_cart', {
          p_user_id: userId,
          p_created_by: authResult.id,
        })

        if (error || !data) {
          console.error('Error finding or creating lojinha cart:', error)
          return jsonResponse(500, {
            success: false,
            error: error?.message || 'Erro ao criar ou buscar carrinho',
          }, origin)
        }
        targetCartId = data
      }

      const cart = await loadCart(supabase, targetCartId)
      if (!cart) {
        return jsonResponse(404, { success: false, error: 'Carrinho não encontrado' }, origin)
      }
      return jsonResponse(200, { success: true, data: cart }, origin)
    }

    if (req.method !== 'POST') {
      return jsonResponse(405, { success: false, error: 'Método não permitido' }, origin)
    }

    const body = await req.json()
    const { action, cartId, productId, quantity } = body
    if (typeof action !== 'string' || typeof cartId !== 'string') {
      return jsonResponse(400, { success: false, error: 'action e cartId são obrigatórios' }, origin)
    }

    let rpcError: { message: string } | null = null
    if (action === 'add-item') {
      if (typeof productId !== 'string' || !Number.isInteger(quantity)) {
        return jsonResponse(400, { success: false, error: 'productId e quantity inteiro são obrigatórios' }, origin)
      }
      const result = await supabase.rpc('add_lojinha_cart_item', {
        p_cart_id: cartId,
        p_product_id: productId,
        p_quantity: quantity,
      })
      rpcError = result.error
    } else if (action === 'decrease-item') {
      if (typeof productId !== 'string') {
        return jsonResponse(400, { success: false, error: 'productId é obrigatório' }, origin)
      }
      const result = await supabase.rpc('decrease_lojinha_cart_item', {
        p_cart_id: cartId,
        p_product_id: productId,
      })
      rpcError = result.error
    } else if (action === 'cancel') {
      const result = await supabase.rpc('cancel_lojinha_cart', {
        p_cart_id: cartId,
        p_cancelled_by: authResult.id,
      })
      rpcError = result.error
    } else {
      return jsonResponse(400, { success: false, error: 'Ação de carrinho inválida' }, origin)
    }

    if (rpcError) {
      const status = ['CART_NOT_FOUND', 'PRODUCT_NOT_FOUND', 'CART_ITEM_NOT_FOUND'].some(code =>
        rpcError?.message.includes(code)
      ) ? 404 : 400
      return jsonResponse(status, { success: false, error: rpcError.message }, origin)
    }

    const cart = await loadCart(supabase, cartId)
    if (!cart) {
      return jsonResponse(404, { success: false, error: 'Carrinho não encontrado' }, origin)
    }

    return jsonResponse(200, { success: true, data: cart }, origin)
  } catch (error) {
    console.error('Error in lojinha-carts:', error)
    return jsonResponse(500, {
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor',
    }, origin)
  }
})
