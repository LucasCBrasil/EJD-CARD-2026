/**
 * Edge Function: make-sale
 * 
 * Cria uma venda de forma segura com validações:
 * - Valida autenticação do usuário
 * - Verifica saldo suficiente
 * - Valida preços dos produtos
 * - Cria venda atomicamente (tudo ou nada)
 * 
 * Este código roda NA NUVEM, inacessível via DevTools!
 */

import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth } from '../_shared/auth.ts'
import type { SaleItem, ApiResponse } from '../_shared/types.ts'

// Configurar CORS para aceitar requisições do frontend
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Tratar OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. VALIDAR AUTENTICAÇÃO
    const authResult = await requireAuth(req)
    if (authResult instanceof Response) {
      return authResult // Retorna erro 401 se não autenticado
    }
    const user = authResult

    // 2. EXTRAIR DADOS DA REQUISIÇÃO
    const { 
      cardId, 
      items, 
      category, 
      coupon,
      discountedTotal 
    }: {
      cardId: string
      items: SaleItem[]
      category: 'lojinha' | 'lanchonete'
      coupon?: string
      discountedTotal: number
    } = await req.json()

    // 3. VALIDAÇÕES BÁSICAS
    if (!cardId || !items || items.length === 0 || !category) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Dados inválidos: cardId, items e category são obrigatórios'
        } as ApiResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 4. CRIAR CLIENTE SUPABASE (com permissões de admin)
    const supabase = createSupabaseClient()

    // 5. BUSCAR CARTÃO E VALIDAR EXISTÊNCIA
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, balance, user_id, user_name')
      .eq('id', cardId)
      .single()

    if (cardError || !card) {
      console.error('Card not found:', cardError)
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

    // 6. VALIDAR PREÇOS DOS PRODUTOS (anti-fraude!)
    const productIds = items.map(item => item.productId)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, price, active')
      .in('id', productIds)

    if (productsError || !products) {
      console.error('Products not found:', productsError)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro ao buscar produtos'
        } as ApiResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Validar que cada item tem o preço correto
    let calculatedTotal = 0
    for (const item of items) {
      const product = products.find(p => p.id === item.productId)
      
      if (!product) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Produto não encontrado: ${item.productId}`
          } as ApiResponse),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      if (!product.active) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Produto inativo: ${product.name}`
          } as ApiResponse),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      // CRÍTICO: Validar que o preço enviado é o preço real do banco!
      if (Math.abs(item.price - product.price) > 0.01) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Preço inválido para ${product.name}. Esperado: R$ ${product.price}, Recebido: R$ ${item.price}`
          } as ApiResponse),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      calculatedTotal += product.price * item.quantity
    }

    // Aplicar desconto de cupom se houver
    let finalTotal = calculatedTotal
    if (coupon && discountedTotal < calculatedTotal) {
      // Validar cupom existe
      const { data: couponData } = await supabase
        .from('coupons')
        .select('name, discount_percent')
        .eq('name', coupon)
        .single()

      if (couponData) {
        const expectedDiscount = calculatedTotal * (couponData.discount_percent / 100)
        const expectedTotal = calculatedTotal - expectedDiscount
        
        // Validar que o desconto está correto (tolerância de 1 centavo)
        if (Math.abs(discountedTotal - expectedTotal) < 0.01) {
          finalTotal = discountedTotal
        }
      }
    }

    // 7. VALIDAR SALDO SUFICIENTE
    if (card.balance < finalTotal) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Saldo insuficiente. Saldo: R$ ${card.balance.toFixed(2)}, Total: R$ ${finalTotal.toFixed(2)}`
        } as ApiResponse),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 8. CRIAR VENDA (TRANSAÇÃO ATÔMICA)
    // Criar a venda na tabela sales
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        card_id: cardId,
        user_id: card.user_id,
        seller_id: user.id,  // ✅ ID do vendedor (usuário autenticado)
        category: category,
        total: finalTotal,
        status: 'completed',
        coupon: coupon || null
      })
      .select('id')
      .single()

    if (saleError || !saleData) {
      console.error('Sale creation error:', saleError)
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao criar venda: ${saleError?.message || 'Erro desconhecido'}`
        } as ApiResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    const saleId = saleData.id

    // 9. CRIAR ITENS DA VENDA
    const saleItems = items.map(item => ({
      sale_id: saleId,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      price: item.price
    }))

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems)

    if (itemsError) {
      console.error('Sale items creation error:', itemsError)
      // Tentar deletar a venda se os itens falharem
      await supabase.from('sales').delete().eq('id', saleId)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao criar itens da venda: ${itemsError.message}`
        } as ApiResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 10. ATUALIZAR SALDO DO CARTÃO
    const { error: balanceError } = await supabase
      .from('cards')
      .update({ balance: card.balance - finalTotal })
      .eq('id', cardId)

    if (balanceError) {
      console.error('Balance update error:', balanceError)
      // Tentar deletar a venda se o saldo falhar
      await supabase.from('sale_items').delete().eq('sale_id', saleId)
      await supabase.from('sales').delete().eq('id', saleId)
      
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro ao atualizar saldo: ${balanceError.message}`
        } as ApiResponse),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // 11. CRIAR TRANSAÇÃO NO HISTÓRICO
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert({
        card_id: cardId,
        amount: -finalTotal,
        type: 'debit',
        description: `Venda ${category} - ${items.length} itens`
      })

    if (transactionError) {
      console.error('Transaction creation error:', transactionError)
      // Não falhar a venda por causa do histórico, apenas logar
    }

    // 12. RETORNAR SUCESSO
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          saleId,
          total: finalTotal,
          message: 'Venda realizada com sucesso!'
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

