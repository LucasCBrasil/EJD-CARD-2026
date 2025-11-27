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

    let query = supabase.from('cards').select('*')

    // Filtros
    if (cardNumber) {
      query = query.eq('card_number', cardNumber)
      
      // Se não for role privilegiado, verificar propriedade após buscar
      if (userRole !== 'admin' && userRole !== 'lojinha' && userRole !== 'lanchonete' && userRole !== 'comunicacao') {
        // Usuários normais só podem ver seus próprios cartões mesmo buscando por número
        query = query.eq('user_id', authResult.id)
      }
    }
    
    if (userId) {
      query = query.eq('user_id', userId)
      if (userRole !== 'admin' && userRole !== 'lojinha' && userRole !== 'lanchonete' && userRole !== 'comunicacao') {
        // Usuários normais só veem seus próprios cartões
        query = query.eq('user_id', authResult.id)
      }
    } else if (!cardNumber) {
      // Se não passar userId nem cardNumber, usuários normais só veem seus próprios cartões
      if (userRole !== 'admin' && userRole !== 'lojinha' && userRole !== 'lanchonete' && userRole !== 'comunicacao') {
        query = query.eq('user_id', authResult.id)
      }
      // Se for admin/lojinha/lanchonete/comunicacao, pode ver todos os cartões
    }

    query = query.order('created_at', { ascending: false })

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

