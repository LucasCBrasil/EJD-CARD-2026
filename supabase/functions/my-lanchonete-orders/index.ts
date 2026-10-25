import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth, getUserRole } from '../_shared/auth.ts'
import { hasPermission } from '../_shared/roles.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { SALE_SELECT, isUuid, jsonResponse, mapOrder, rpcErrorResponse } from '../_shared/lanchonete-orders.ts'

interface CancelResult {
  sale_id: string
  sale_number: number
  refunded_amount: number | string
  new_balance: number | string
}

/**
 * Pedidos de autoatendimento do próprio usuário (sempre o usuário do JWT).
 *
 * GET:  últimos pedidos com status e itens
 * POST: { saleId, action: 'cancel' } cancela o próprio pedido ainda pendente
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

    const role = await getUserRole(authResult.id)
    if (!hasPermission(role, 'canSelfOrderLanchonete')) {
      return jsonResponse(origin, { success: false, error: 'Acesso negado' }, 403)
    }

    const supabase = createSupabaseClient()

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('sales')
        .select(SALE_SELECT)
        .eq('user_id', authResult.id)
        .eq('category', 'lanchonete')
        .eq('origin', 'autoatendimento')
        .order('created_at', { ascending: false })
        .limit(20)

      if (error) {
        console.error('Error listing own lanchonete orders:', error.message)
        return jsonResponse(origin, { success: false, error: 'Erro ao buscar pedidos' }, 500)
      }

      return jsonResponse(origin, { success: true, data: (data || []).map(mapOrder) })
    }

    if (req.method === 'POST') {
      let body: Record<string, unknown>
      try {
        body = await req.json()
      } catch {
        return jsonResponse(origin, { success: false, error: 'JSON inválido' }, 400)
      }

      if (body.action !== 'cancel' || !isUuid(body.saleId)) {
        return jsonResponse(origin, { success: false, error: 'Dados inválidos' }, 400)
      }

      // p_is_staff = false: a RPC só aceita pedido do próprio usuário e em 'pending'
      const { data, error } = await supabase.rpc('cancel_lanchonete_order', {
        p_sale_id: body.saleId,
        p_actor_id: authResult.id,
        p_is_staff: false,
      }).single<CancelResult>()

      if (error) {
        return rpcErrorResponse(origin, error, 'cancel_lanchonete_order')
      }

      return jsonResponse(origin, {
        success: true,
        data: {
          saleId: data?.sale_id,
          saleNumber: Number(data?.sale_number),
          refundedAmount: Number(data?.refunded_amount),
          newBalance: Number(data?.new_balance),
        },
      })
    }

    return jsonResponse(origin, { success: false, error: 'Método não permitido' }, 405)
  } catch (error) {
    console.error('Error in my-lanchonete-orders:', error)
    return jsonResponse(origin, { success: false, error: 'Erro interno do servidor' }, 500)
  }
})
