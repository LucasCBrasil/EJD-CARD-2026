/**
 * Edge Function: list-orders
 * 
 * Lista pedidos de forma segura com autenticação obrigatória
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
    const category = url.searchParams.get('category') as 'lojinha' | 'sapatinho' | null

    // REGRA: Apenas admin e lojinha podem ver pedidos (tanto da lojinha quanto do sapatinho)
    if (!['admin', 'lojinha'].includes(userRole)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Acesso negado: apenas administradores e lojinha podem ver pedidos'
        } as ApiResponse),
        {
          status: 403,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    if (category === 'sapatinho') {
      // Pedidos do Sapatinho (apenas admin e lojinha podem ver)

      const { data: orders, error } = await supabase
        .from('sapatinho_veloz_orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao buscar pedidos'
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
          data: orders || []
        } as ApiResponse),
        {
          status: 200,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    } else {
      // Pedidos da Lojinha (apenas admin e lojinha podem ver - já validado acima)

      const { data: orders, error } = await supabase
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Erro ao buscar pedidos'
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
          data: orders || []
        } as ApiResponse),
        {
          status: 200,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }
  } catch (error) {
    console.error('Error in list-orders:', error)
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

