/**
 * Edge Function: list-sales
 * 
 * Lista vendas de forma segura com autenticação obrigatória
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
    const category = url.searchParams.get('category') as 'lojinha' | 'lanchonete' | 'sapatinho' | null
    const cardId = url.searchParams.get('cardId')
    const pageParam = url.searchParams.get('page')
    const limitParam = url.searchParams.get('limit')
    
    // Paginação: padrão 20 itens por página, página 1
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1
    const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : 20
    const offset = (page - 1) * limit

    // REGRA: Se cardId foi passado, usuário quer ver vendas do SEU cartão
    //        Se cardId NÃO foi passado, precisa ser admin/lojinha/lanchonete para ver histórico geral

    // BLOQUEAR ENCONTRISTA - não pode ver histórico de vendas
    if (userRole === 'encontrista') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Acesso negado: encontristas não podem ver histórico de vendas'
        } as ApiResponse),
        {
          status: 403,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    if (cardId) {
      // Usuário está pedindo vendas de um cartão específico
      // Verificar se o cartão pertence ao usuário (exceto se for admin/lojinha/lanchonete)
      if (!['admin', 'lojinha', 'lanchonete'].includes(userRole)) {
        // Usuário normal - só pode ver vendas do próprio cartão
        const { data: card } = await supabase
          .from('cards')
          .select('user_id')
          .eq('id', cardId)
          .single()
        
        if (!card || card.user_id !== authResult.id) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Acesso negado: você só pode ver vendas do seu próprio cartão'
            } as ApiResponse),
            {
              status: 403,
              headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
            }
          )
        }
      }
      // Se passou a verificação, pode ver vendas desse cartão
    } else {
      // Sem cardId - está pedindo histórico geral
      // Apenas admin, lojinha ou lanchonete podem ver histórico geral
      if (!['admin', 'lojinha', 'lanchonete'].includes(userRole)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Acesso negado: apenas administradores, lojinha e lanchonete podem ver histórico geral'
          } as ApiResponse),
          {
            status: 403,
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
          }
        )
      }

      // Verificar permissões específicas por categoria para histórico geral
      if (category === 'lojinha' && !['admin', 'lojinha'].includes(userRole)) {
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

      if (category === 'lanchonete' && !['admin', 'lanchonete'].includes(userRole)) {
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

      if (category === 'sapatinho' && !['admin', 'lojinha'].includes(userRole)) {
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

    // Buscar vendas
    if (category === 'sapatinho') {
      // Vendas do Sapatinho
      let query = supabase
        .from('sapatinho_sales')
        .select(`
          *,
          sapatinho_sale_items (*)
        `)
        .order('created_at', { ascending: false })

      if (cardId) {
        query = query.eq('card_id', cardId)
      }

      const { data: sales, error } = await query

      if (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao buscar vendas'
          } as ApiResponse),
          {
            status: 500,
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
          }
        )
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: sales || []
        } as ApiResponse),
        {
          status: 200,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    } else {
      // Vendas normais (lojinha/lanchonete)
      // Primeiro buscar o total para paginação
      let countQuery = supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })

      // Se cardId foi passado, filtrar por cartão
      if (cardId) {
        countQuery = countQuery.eq('card_id', cardId)
      }
      
      // Se categoria foi especificada, filtrar por categoria
      if (category) {
        countQuery = countQuery.eq('category', category)
      }

      const { count, error: countError } = await countQuery

      if (countError) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao contar vendas'
          } as ApiResponse),
          {
            status: 500,
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
          }
        )
      }

      // Agora buscar os dados com paginação
      let query = supabase
        .from('sales')
        .select(`
          *,
          sale_items (*),
          app_users:seller_id (
            id,
            name,
            email
          ),
          cards:card_id (
            id,
            card_number,
            user_name,
            user_id
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      // Se cardId foi passado, filtrar por cartão (usuário vendo próprio histórico)
      if (cardId) {
        query = query.eq('card_id', cardId)
      }
      
      // Se categoria foi especificada, filtrar por categoria
      if (category) {
        query = query.eq('category', category)
      }

      const { data: sales, error } = await query

      if (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao buscar vendas'
          } as ApiResponse),
          {
            status: 500,
            headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
          }
        )
      }

      // Retornar vendas paginadas com total
      return new Response(
        JSON.stringify({
          success: true,
          data: sales || [],
          total: count || 0
        } as ApiResponse),
        {
          status: 200,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }
  } catch (error) {
    console.error('Error in list-sales:', error)
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

