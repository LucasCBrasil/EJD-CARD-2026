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
    const userId = url.searchParams.get('userId')
    const pageParam = url.searchParams.get('page')
    const limitParam = url.searchParams.get('limit')
    
    // Paginação: padrão 20 itens por página, página 1
    const page = pageParam ? Math.max(1, parseInt(pageParam, 10)) : 1
    const limit = limitParam ? Math.max(1, Math.min(100, parseInt(limitParam, 10))) : 20
    const offset = (page - 1) * limit

    const canViewAllSales = ['admin', 'lojinha', 'lanchonete'].includes(userRole)
    if (userId) {
      if (userId !== authResult.id && !canViewAllSales) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Acesso negado: você só pode consultar o histórico da sua conta'
        } as ApiResponse), {
          status: 403,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        })
      }
    } else {
      if (!canViewAllSales) {
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
          sapatinho_sale_items (*),
          user:app_users!sapatinho_sales_user_id_fkey (name, email)
        `)
        .order('created_at', { ascending: false })

      if (userId) {
        query = query.eq('user_id', userId)
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
          data: (sales || []).map((sale) => ({
            ...sale,
            user_name: sale.user?.name || null,
            user_email: sale.user?.email || null,
          }))
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

      if (userId) {
        countQuery = countQuery.eq('user_id', userId)
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
          seller:app_users!sales_seller_id_fkey (
            id,
            name,
            email
          ),
          user:app_users!sales_user_id_fkey (
            id,
            name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1)

      if (userId) {
        query = query.eq('user_id', userId)
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
          data: (sales || []).map((sale) => ({
            ...sale,
            user_name: sale.user?.name || null,
            user_email: sale.user?.email || null,
          })),
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
