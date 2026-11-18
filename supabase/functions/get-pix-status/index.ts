import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth, getUserRole } from '../_shared/auth.ts'
import { getUserPermissions } from '../_shared/roles.ts'
import type { ApiResponse } from '../_shared/types.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { syncMercadoPagoPayment } from '../_shared/mercadopago.ts'

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

    if (req.method !== 'GET') {
      return new Response(JSON.stringify({ success: false, error: 'Método não permitido' } as ApiResponse), {
        status: 405,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    const paymentId = new URL(req.url).searchParams.get('paymentId')
    if (!paymentId) {
      return new Response(JSON.stringify({ success: false, error: 'paymentId obrigatório' } as ApiResponse), {
        status: 400,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    const role = await getUserRole(authResult.id)
    const canReadAll = getUserPermissions(role).canViewAllBalances
    const supabase = createSupabaseClient()
    let query = supabase
      .from('pix_payments')
      .select('id, user_id, external_id, status, amount, pix_code, qr_code_url, confirmed_at, webhook_data')
      .eq('external_id', paymentId)

    if (!canReadAll) {
      query = query.eq('user_id', authResult.id)
    }

    const { data, error } = await query.maybeSingle()
    if (error) {
      console.error('Error loading PIX payment status:', error.message)
      return new Response(JSON.stringify({ success: false, error: 'Erro ao buscar pagamento PIX' } as ApiResponse), {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    if (!data) {
      return new Response(JSON.stringify({ success: false, error: 'Pagamento não encontrado' } as ApiResponse), {
        status: 404,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    const result = data.status === 'pending' && data.webhook_data?.provider === 'mercadopago'
      ? await syncMercadoPagoPayment(data)
      : { id: data.id, status: data.status, amount: data.amount, pix_code: data.pix_code, qr_code_url: data.qr_code_url, confirmed_at: data.confirmed_at }
    return new Response(JSON.stringify({ success: true, data: { ...result, amount_charged: Number(data.webhook_data?.amount_charged ?? data.amount) } } as ApiResponse), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in get-pix-status:', error)
    return new Response(JSON.stringify({ success: false, error: 'Erro interno do servidor' } as ApiResponse), {
      status: 500,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }
})
