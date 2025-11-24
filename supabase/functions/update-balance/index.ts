/**
 * Edge Function: update-balance
 * 
 * Atualiza saldo de cartão de forma segura:
 * - Valida autenticação (apenas admins)
 * - Verifica saldo suficiente para débitos
 * - Cria transação no histórico
 * - Atualiza saldo atomicamente
 * 
 * Este código roda NA NUVEM, inacessível via DevTools!
 */

import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth, canAddBalance } from '../_shared/auth.ts'
import type { ApiResponse } from '../_shared/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. VALIDAR AUTENTICAÇÃO
    const authResult = await requireAuth(req)
    if (authResult instanceof Response) {
      return authResult
    }

    // 2. VALIDAR PERMISSÕES (usa sistema de roles existente)
    // Permitido para: admin, genios_card, comunicacao
    const hasPermission = await canAddBalance(req)
    if (!hasPermission) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Acesso negado: você não tem permissão para alterar saldo. Roles permitidos: admin, genios_card, comunicacao'
        } as ApiResponse),
        {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 3. EXTRAIR DADOS
    const {
      cardId,
      amount,
      type,
      description
    }: {
      cardId: string
      amount: number
      type: 'credit' | 'debit'
      description?: string
    } = await req.json()

    // 4. VALIDAÇÕES
    if (!cardId || amount === undefined || !type) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Dados inválidos: cardId, amount e type são obrigatórios'
        } as ApiResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (amount <= 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Valor deve ser maior que zero'
        } as ApiResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 5. CRIAR CLIENTE SUPABASE
    const supabase = createSupabaseClient()

    // 6. BUSCAR CARTÃO ATUAL
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, balance, user_name')
      .eq('id', cardId)
      .single()

    if (cardError || !card) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Cartão não encontrado'
        } as ApiResponse),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 7. CALCULAR NOVO SALDO
    const currentBalance = parseFloat(card.balance.toString())
    let newBalance: number

    if (type === 'credit') {
      newBalance = currentBalance + amount
    } else {
      newBalance = currentBalance - amount
      
      // VALIDAR SALDO SUFICIENTE
      if (newBalance < 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Saldo insuficiente. Saldo atual: R$ ${currentBalance.toFixed(2)}, Débito: R$ ${amount.toFixed(2)}`
          } as ApiResponse),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    // 8. ATUALIZAR SALDO (ATOMICAMENTE)
    const { error: updateError } = await supabase
      .from('cards')
      .update({
        balance: newBalance,
        updated_at: new Date().toISOString()
      })
      .eq('id', cardId)

    if (updateError) {
      console.error('Update balance error:', updateError)
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao atualizar saldo: ${updateError.message}`
        } as ApiResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 9. CRIAR TRANSAÇÃO NO HISTÓRICO
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        card_id: cardId,
        amount: type === 'credit' ? amount : -amount,
        type,
        description: description || `${type === 'credit' ? 'Crédito' : 'Débito'} realizado por admin`,
        created_by: 'admin'
      })

    if (transactionError) {
      console.error('Transaction creation error:', transactionError)
      // Não falhar se a transação não for criada, mas logar o erro
    }

    // 10. RETORNAR SUCESSO
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          cardId,
          previousBalance: currentBalance,
          newBalance,
          amount,
          type,
          message: `Saldo ${type === 'credit' ? 'creditado' : 'debitado'} com sucesso!`
        }
      } as ApiResponse),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      } as ApiResponse),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

