import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth, getUserRole } from '../_shared/auth.ts'
import { hasPermission } from '../_shared/roles.ts'
import type { ApiResponse } from '../_shared/types.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { roundMoney } from '../_shared/money.ts'

interface BalanceUpdateResult {
  previous_balance: number | string
  new_balance: number | string
  transaction_id: string
}

const isBalanceUpdateResult = (value: unknown): value is BalanceUpdateResult => {
  if (typeof value !== 'object' || value === null) return false
  const result = value as Record<string, unknown>
  return (typeof result.previous_balance === 'number' || typeof result.previous_balance === 'string')
    && (typeof result.new_balance === 'number' || typeof result.new_balance === 'string')
    && typeof result.transaction_id === 'string'
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

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ success: false, error: 'Método não permitido' } as ApiResponse), {
        status: 405,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    const role = await getUserRole(authResult.id)
    if (!hasPermission(role, 'canAddBalance')) {
      return new Response(JSON.stringify({ success: false, error: 'Acesso negado' } as ApiResponse), {
        status: 403,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const userId = typeof body.userId === 'string' ? body.userId : ''
    const amount = Number(body.amount)
    const type = body.type
    const description = typeof body.description === 'string' ? body.description : ''

    if (!userId || !Number.isFinite(amount) || amount <= 0 || !['credit', 'debit'].includes(type)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Dados inválidos: userId, amount e type (credit/debit) são obrigatórios',
      } as ApiResponse), {
        status: 400,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    const roundedAmount = roundMoney(amount)
    if (roundedAmount <= 0) {
      return new Response(JSON.stringify({ success: false, error: 'Valor deve ser maior que zero' } as ApiResponse), {
        status: 400,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    const supabase = createSupabaseClient()
    const { data, error } = await supabase.rpc('adjust_account_balance', {
      p_user_id: userId,
      p_amount: roundedAmount,
      p_type: type,
      p_description: description,
      p_created_by: authResult.id,
    }).single()

    if (error) {
      console.error('Account balance adjustment failed:', error.message)
      const status = error.code === 'P0002' ? 404 : error.message.includes('INSUFFICIENT_BALANCE') ? 400 : 500
      const message = status === 404
        ? 'Conta não encontrada'
        : status === 400
          ? 'Saldo insuficiente'
          : 'Erro ao atualizar saldo'

      return new Response(JSON.stringify({ success: false, error: message } as ApiResponse), {
        status,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    if (!isBalanceUpdateResult(data)) {
      console.error('Account balance adjustment returned an invalid result')
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao confirmar atualização do saldo',
      } as ApiResponse), {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        userId,
        previousBalance: Number(data.previous_balance),
        newBalance: Number(data.new_balance),
        amount: roundedAmount,
        type,
        transactionId: data.transaction_id,
      },
    } as ApiResponse), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Error in update-balance:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor',
    } as ApiResponse), {
      status: 500,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })
  }
})
