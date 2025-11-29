/**
 * Edge Function: my-card-history
 * 
 * Retorna o cartão e histórico de compras do usuário autenticado.
 * 
 * SEGURANÇA:
 * - Sempre retorna APENAS dados do usuário logado
 * - Não aceita parâmetros externos (cardId, userId, etc)
 * - Busca pelo user_id do token JWT
 * 
 * Retorna:
 * - card: dados do cartão (ou null se não associado)
 * - transactions: histórico de transações (créditos/débitos)
 * - sales: histórico de compras (lojinha/lanchonete)
 * - sapatinhoSales: histórico de compras do sapatinho veloz
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders } from '../_shared/cors.ts'

interface ApiResponse {
  success: boolean
  data?: any
  error?: string
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) })
  }

  try {
    // Apenas GET é permitido
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

    // Configurar clientes Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error('Missing environment variables')
    }

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Autenticação obrigatória
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || null

    if (!token) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Não autenticado'
        } as ApiResponse),
        {
          status: 401,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(token)
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Token inválido'
        } as ApiResponse),
        {
          status: 401,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    const userId = user.id
    console.log(`[my-card-history] Buscando dados para user_id: ${userId}`)

    // 1. Buscar cartão do usuário pelo user_id
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    if (cardError) {
      console.error('[my-card-history] Erro ao buscar cartão:', cardError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro ao buscar cartão'
        } as ApiResponse),
        {
          status: 500,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    // Se não tem cartão associado, retornar null
    if (!card) {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            card: null,
            transactions: [],
            sales: [],
            sapatinhoSales: []
          }
        } as ApiResponse),
        {
          status: 200,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    const cardId = card.id

    // 2. Buscar transações do cartão (últimas 50)
    const { data: transactions, error: transactionsError } = await supabase
      .from('transactions')
      .select('*')
      .eq('card_id', cardId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (transactionsError) {
      console.error('[my-card-history] Erro ao buscar transações:', transactionsError)
    }

    // 3. Buscar vendas normais (lojinha/lanchonete) do cartão (últimas 30)
    const { data: sales, error: salesError } = await supabase
      .from('sales')
      .select(`
        *,
        sale_items (*)
      `)
      .eq('card_id', cardId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (salesError) {
      console.error('[my-card-history] Erro ao buscar vendas:', salesError)
    }

    // 4. Buscar vendas do sapatinho veloz (últimas 30)
    const { data: sapatinhoSales, error: sapatinhoError } = await supabase
      .from('sapatinho_sales')
      .select(`
        *,
        sapatinho_sale_items (*)
      `)
      .eq('card_id', cardId)
      .order('created_at', { ascending: false })
      .limit(30)

    if (sapatinhoError) {
      console.error('[my-card-history] Erro ao buscar vendas sapatinho:', sapatinhoError)
    }

    // Retornar todos os dados
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          card: card,
          transactions: transactions || [],
          sales: sales || [],
          sapatinhoSales: sapatinhoSales || []
        }
      } as ApiResponse),
      {
        status: 200,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('[my-card-history] Erro inesperado:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro interno do servidor'
      } as ApiResponse),
      {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    )
  }
})

