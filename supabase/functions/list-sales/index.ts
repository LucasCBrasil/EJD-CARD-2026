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
      let query = supabase
        .from('sales')
        .select(`
          *,
          sale_items (*)
        `)
        .order('created_at', { ascending: false })

      // Se cardId foi passado, filtrar por cartão (usuário vendo próprio histórico)
      if (cardId) {
        query = query.eq('card_id', cardId)
      }
      
      // Se categoria foi especificada (para histórico geral), podemos filtrar
      // Por enquanto retornamos todas as vendas e o frontend pode filtrar por categoria

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

      // Retornar todas as vendas (filtragem por categoria pode ser feita no frontend
      // ou através de query mais complexa no futuro)
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

