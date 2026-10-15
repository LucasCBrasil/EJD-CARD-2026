import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth } from '../_shared/auth.ts'
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

    const supabase = createSupabaseClient()
    const [accountResult, transactionsResult, salesResult] = await Promise.all([
      supabase
        .from('app_users')
        .select('id, email, name, role, balance, created_at')
        .eq('id', authResult.id)
        .maybeSingle(),
      supabase
        .from('transactions')
        .select('id, user_id, amount, type, description, created_by, created_at')
        .eq('user_id', authResult.id)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('sales')
        .select('*, sale_items (*)')
        .eq('user_id', authResult.id)
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    const queryError = accountResult.error || transactionsResult.error || salesResult.error
    if (queryError) {
      console.error('Error loading account history:', queryError.message)
      return new Response(JSON.stringify({ success: false, error: 'Erro ao buscar histórico da conta' } as ApiResponse), {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    if (!accountResult.data) {
      return new Response(JSON.stringify({ success: false, error: 'Conta não encontrada' } as ApiResponse), {
        status: 404,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        account: accountResult.data,
        transactions: transactionsResult.data || [],
        sales: salesResult.data || [],
      },
    } as ApiResponse), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in my-account-history:', error)
    return new Response(JSON.stringify({ success: false, error: 'Erro interno do servidor' } as ApiResponse), {
      status: 500,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }
})
