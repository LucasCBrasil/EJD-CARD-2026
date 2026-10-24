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

    const role = await getUserRole(authResult.id)
    if (role === 'encontrista') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Acesso negado: use o histórico da sua conta para consultar movimentações',
      } as ApiResponse), {
        status: 403,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    const permissions = getUserPermissions(role)
    const url = new URL(req.url)
    const requestedUserId = url.searchParams.get('userId')
    const canListAll = permissions.canViewAllBalances

    if (requestedUserId && requestedUserId !== authResult.id && !canListAll) {
      return new Response(JSON.stringify({ success: false, error: 'Acesso negado' } as ApiResponse), {
        status: 403,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    const limitParam = Number(url.searchParams.get('limit') || 1000)
    const limit = Number.isFinite(limitParam) ? Math.max(1, Math.min(1000, Math.floor(limitParam))) : 1000
    const supabase = createSupabaseClient()
    let query = supabase
      .from('transactions')
      .select('id, user_id, amount, type, description, created_by, created_at, app_users:user_id(name)')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (requestedUserId) {
      query = query.eq('user_id', requestedUserId)
    } else if (!canListAll) {
      query = query.eq('user_id', authResult.id)
    }

    const { data: transactions, error } = await query
    if (error) {
      console.error('Error listing transactions:', error.message)
      return new Response(JSON.stringify({ success: false, error: 'Erro ao buscar transações' } as ApiResponse), {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    const formattedTransactions = (transactions || []).map((transaction) => ({
      id: transaction.id,
      user_id: transaction.user_id,
      amount: transaction.amount,
      type: transaction.type,
      description: transaction.description,
      created_by: transaction.created_by,
      created_at: transaction.created_at,
      user_name: transaction.app_users?.[0]?.name || null,
    }))

    return new Response(JSON.stringify({ success: true, data: formattedTransactions } as ApiResponse), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in list-transactions:', error)
    return new Response(JSON.stringify({ success: false, error: 'Erro interno do servidor' } as ApiResponse), {
      status: 500,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }
})
