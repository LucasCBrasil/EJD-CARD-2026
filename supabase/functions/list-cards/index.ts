/**
 * Edge Function: list-cards
 * 
 * Lista cartões de forma segura com autenticação obrigatória
 * Respeita RLS - usuários só veem seus próprios cartões ou todos (se admin/comunicação)
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
    const cardNumber = url.searchParams.get('cardNumber')
    const userId = url.searchParams.get('userId')
    const userName = url.searchParams.get('userName')

    // Verificar se é role privilegiado (pode ver todos os cartões)
    const isPrivileged = userRole === 'admin' || userRole === 'lojinha' || userRole === 'lanchonete' || userRole === 'comunicacao'

    let query = supabase.from('cards').select('*')

    // Filtro por nome (busca parcial, case-insensitive)
    if (userName) {
      query = query.ilike('user_name', `%${userName}%`)
      
      if (!isPrivileged) {
        // Usuários normais só podem buscar seus próprios cartões
        query = query.eq('user_id', authResult.id)
      }
      
      // Limitar resultados para busca por nome (performance)
      query = query.limit(10)
    }
    // Filtro por número do cartão
    else if (cardNumber) {
      query = query.eq('card_number', cardNumber)
      
      if (!isPrivileged) {
        // Usuários normais só podem ver seus próprios cartões mesmo buscando por número
        query = query.eq('user_id', authResult.id)
      }
    }
    // Filtro por userId
    else if (userId) {
      query = query.eq('user_id', userId)
      if (!isPrivileged) {
        // Usuários normais só veem seus próprios cartões
        query = query.eq('user_id', authResult.id)
      }
    } 
    // Sem filtro específico
    else {
      if (!isPrivileged) {
        // Usuários normais só veem seus próprios cartões
        query = query.eq('user_id', authResult.id)
      }
      // Se for admin/lojinha/lanchonete/comunicacao, pode ver todos os cartões
    }

    query = query.order('user_name', { ascending: true })

    const { data: cards, error } = await query

    if (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro ao buscar cartões'
        } as ApiResponse),
        {
          status: 500,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    // Se buscar por cardNumber e retornar 1, retornar como objeto único
    if (cardNumber && cards && cards.length === 1) {
      return new Response(
        JSON.stringify({
          success: true,
          data: cards[0]
        } as ApiResponse),
        {
          status: 200,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    // Se buscar por userId e retornar 1, retornar como objeto único
    if (userId && cards && cards.length === 1) {
      return new Response(
        JSON.stringify({
          success: true,
          data: cards[0]
        } as ApiResponse),
        {
          status: 200,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: cards || []
      } as ApiResponse),
      {
        status: 200,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error in list-cards:', error)
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

