import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth, getUserRole } from '../_shared/auth.ts'
import { hasPermission } from '../_shared/roles.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import {
  OPEN_ORDER_STATUSES,
  SALE_SELECT,
  isUuid,
  jsonResponse,
  mapOrder,
  rpcErrorResponse,
} from '../_shared/lanchonete-orders.ts'

const NEXT_STATUSES = ['preparing', 'ready', 'delivered']
const CLOSED_STATUSES = ['delivered', 'cancelled']

/**
 * Fila de pedidos de autoatendimento da Lanchonete (equipe: admin, lanchonete).
 *
 * GET  ?status=open (padrão) | delivered | cancelled
 * POST { saleId, status: 'preparing' | 'ready' | 'delivered' }
 * POST { saleId, action: 'cancel' }  (estorno integral; até 'ready')
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
    if (!hasPermission(role, 'canManageLanchoneteOrders')) {
      return jsonResponse(origin, { success: false, error: 'Acesso negado' }, 403)
    }

    const supabase = createSupabaseClient()

    if (req.method === 'GET') {
      const status = new URL(req.url).searchParams.get('status') || 'open'
      const isOpen = status === 'open'

      if (!isOpen && !CLOSED_STATUSES.includes(status)) {
        return jsonResponse(origin, { success: false, error: 'Status inválido' }, 400)
      }

      let query = supabase
        .from('sales')
        .select(`${SALE_SELECT}, user:app_users!sales_user_id_fkey(name, email)`)
        .eq('category', 'lanchonete')
        .eq('origin', 'autoatendimento')

      // Fila em ordem de chegada; encerrados do mais recente para o mais antigo
      query = isOpen
        ? query.in('status', [...OPEN_ORDER_STATUSES]).order('created_at', { ascending: true }).limit(200)
        : query.eq('status', status).order('status_updated_at', { ascending: false }).limit(30)

      const { data, error } = await query

      if (error) {
        console.error('Error listing lanchonete orders:', error.message)
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

      if (!isUuid(body.saleId)) {
        return jsonResponse(origin, { success: false, error: 'saleId inválido' }, 400)
      }

      if (body.action === 'cancel') {
        const { data, error } = await supabase.rpc('cancel_lanchonete_order', {
          p_sale_id: body.saleId,
          p_actor_id: authResult.id,
          p_is_staff: true,
        }).single<{ sale_number: number; refunded_amount: number | string }>()

        if (error) {
          return rpcErrorResponse(origin, error, 'cancel_lanchonete_order')
        }

        return jsonResponse(origin, {
          success: true,
          data: {
            saleId: body.saleId,
            saleNumber: Number(data?.sale_number),
            status: 'cancelled',
            refundedAmount: Number(data?.refunded_amount),
          },
        })
      }

      if (typeof body.status !== 'string' || !NEXT_STATUSES.includes(body.status)) {
        return jsonResponse(origin, { success: false, error: 'Status inválido', code: 'INVALID_STATUS' }, 400)
      }

      const { data, error } = await supabase.rpc('update_lanchonete_order_status', {
        p_sale_id: body.saleId,
        p_new_status: body.status,
        p_actor_id: authResult.id,
      }).single<{ sale_number: number; status: string; status_updated_at: string }>()

      if (error) {
        return rpcErrorResponse(origin, error, 'update_lanchonete_order_status')
      }

      return jsonResponse(origin, {
        success: true,
        data: {
          saleId: body.saleId,
          saleNumber: Number(data?.sale_number),
          status: data?.status,
          statusUpdatedAt: data?.status_updated_at,
        },
      })
    }

    return jsonResponse(origin, { success: false, error: 'Método não permitido' }, 405)
  } catch (error) {
    console.error('Error in lanchonete-orders:', error)
    return jsonResponse(origin, { success: false, error: 'Erro interno do servidor' }, 500)
  }
})
