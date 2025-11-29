/**
 * Edge Function: list-transactions
 * 
 * Lista transações de forma segura com autenticação obrigatória
 * Usuários só veem transações de seus próprios cartões (ou todos se admin/comunicação)
 */

import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth, getUserRole } from '../_shared/auth.ts'
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
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Método não permitido'
        } as ApiResponse),
        {
          status: 405,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    const userRole = await getUserRole(authResult.id)
    const supabase = createSupabaseClient()
    const url = new URL(req.url)
    const cardId = url.searchParams.get('cardId')

    // BLOQUEAR ENCONTRISTA - encontrista só pode ver saldo, não transações
    if (userRole === 'encontrista') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Acesso negado: encontristas não podem ver histórico de transações'
        } as ApiResponse),
        {
          status: 403,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    // Parâmetros de paginação
    const limit = url.searchParams.get('limit')
    const limitNum = limit ? parseInt(limit, 10) : 1000 // Default 1000 para monitoramento

    let query = supabase
      .from('transactions')
      .select(`
        *,
        cards!inner(user_id, user_name, card_number)
      `)
      .order('created_at', { ascending: false })
      .limit(limitNum)

    if (cardId) {
      query = query.eq('card_id', cardId)
      
      // Se não for admin/comunicação, verificar se o cartão pertence ao usuário
      if (!['admin', 'comunicacao'].includes(userRole)) {
        const { data: card } = await supabase
          .from('cards')
          .select('user_id')
          .eq('id', cardId)
          .single()
        
        if (!card || card.user_id !== authResult.id) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Acesso negado'
            } as ApiResponse),
            {
              status: 403,
              headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
            }
          )
        }
      }
    } else {
      // Sem cardId - usuários normais só veem transações de seus cartões
      if (!['admin', 'comunicacao'].includes(userRole)) {
        // Buscar cartões do usuário primeiro
        const { data: userCards } = await supabase
          .from('cards')
          .select('id')
          .eq('user_id', authResult.id)
        
        if (userCards && userCards.length > 0) {
          const cardIds = userCards.map(c => c.id)
          query = query.in('card_id', cardIds)
        } else {
          // Sem cartões, retornar vazio
          return new Response(
            JSON.stringify({
              success: true,
              data: []
            } as ApiResponse),
            {
              status: 200,
              headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
            }
          )
        }
      }
    }

    const { data: transactions, error } = await query

    if (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro ao buscar transações'
        } as ApiResponse),
        {
          status: 500,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    // Formatar dados para incluir informações do card no nível principal
    const formattedTransactions = (transactions || []).map((t: any) => ({
      id: t.id,
      card_id: t.card_id,
      amount: t.amount,
      type: t.type,
      description: t.description,
      created_by: t.created_by,
      created_at: t.created_at,
      user_name: t.cards?.user_name || null,
      card_number: t.cards?.card_number || null
    }))

    return new Response(
      JSON.stringify({
        success: true,
        data: formattedTransactions
      } as ApiResponse),
      {
        status: 200,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error in list-transactions:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Erro interno do servidor'
      } as ApiResponse),
      {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    )
  }
})

