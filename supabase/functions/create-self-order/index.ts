import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth, getUserRole } from '../_shared/auth.ts'
import { hasPermission } from '../_shared/roles.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { isUuid, jsonResponse, rpcErrorResponse } from '../_shared/lanchonete-orders.ts'

interface SelfOrderResult {
  sale_id: string
  sale_number: number
  total: number | string
  new_balance: number | string
  already_existed: boolean
}

/**
 * Pedido de autoatendimento na Lanchonete.
 *
 * O comprador é SEMPRE o usuário do JWT: userId, preço e nome vindos do body
 * são ignorados. Validação, total, estoque e débito acontecem na RPC
 * create_lanchonete_self_order, em uma única transação.
 *
 * Body: { items: [{ productId, quantity }], requestId }
 */
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

    if (req.method !== 'POST') {
      return jsonResponse(origin, { success: false, error: 'Método não permitido' }, 405)
    }

    const role = await getUserRole(authResult.id)
    if (!hasPermission(role, 'canSelfOrderLanchonete')) {
      return jsonResponse(origin, { success: false, error: 'Acesso negado' }, 403)
    }

    let body: Record<string, unknown>
    try {
      body = await req.json()
    } catch {
      return jsonResponse(origin, { success: false, error: 'JSON inválido' }, 400)
    }

    if (!isUuid(body.requestId)) {
      return jsonResponse(origin, { success: false, error: 'requestId inválido', code: 'INVALID_REQUEST' }, 400)
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return jsonResponse(origin, { success: false, error: 'O carrinho está vazio', code: 'EMPTY_CART' }, 400)
    }

    // Repassa só productId e quantity; a RPC valida formato e limites
    const items = body.items.map((item) => {
      const value = (typeof item === 'object' && item !== null ? item : {}) as Record<string, unknown>
      return { productId: value.productId, quantity: value.quantity }
    })

    const supabase = createSupabaseClient()
    const { data, error } = await supabase.rpc('create_lanchonete_self_order', {
      p_user_id: authResult.id,
      p_items: items,
      p_request_id: body.requestId,
    }).single<SelfOrderResult>()

    if (error) {
      return rpcErrorResponse(origin, error, 'create_lanchonete_self_order')
    }

    if (!data) {
      return jsonResponse(origin, { success: false, error: 'Erro ao confirmar o pedido' }, 500)
    }

    return jsonResponse(origin, {
      success: true,
      data: {
        saleId: data.sale_id,
        saleNumber: Number(data.sale_number),
        total: Number(data.total),
        newBalance: Number(data.new_balance),
        alreadyExisted: data.already_existed,
      },
    }, data.already_existed ? 200 : 201)
  } catch (error) {
    console.error('Error in create-self-order:', error)
    return jsonResponse(origin, { success: false, error: 'Erro interno do servidor' }, 500)
  }
})
