import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth, getUserRole } from '../_shared/auth.ts'
import { getUserPermissions } from '../_shared/roles.ts'
import type { ApiResponse } from '../_shared/types.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

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
      .select('id, status, amount, confirmed_at')
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

    return new Response(JSON.stringify({ success: true, data } as ApiResponse), {
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
