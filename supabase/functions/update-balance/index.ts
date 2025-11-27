/**
 * Edge Function: update-balance
 * 
 * Gerencia cartões de forma segura:
 * - Criar cartão (com saldo inicial opcional)
 * - Atualizar saldo (crédito/débito)
 * - Criar transações no histórico
 * 
 * OTIMIZADO para performance:
 * - Reutiliza clientes Supabase
 * - Operações em paralelo quando possível
 * - Validações antes de chamadas ao banco
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

import { getCorsHeaders } from '../_shared/cors.ts';

Deno.serve(async (req: Request) => {
  // OPTIONS primeiro (sem logs para performance)
  const origin = req.headers.get('origin')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      headers: getCorsHeaders(origin),
      status: 200
    })
  }

  try {
    // Criar clientes uma vez e reutilizar
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

    // Autenticação e permissões em paralelo
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '') || null

    if (!token) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    // Validar token e buscar role em paralelo
    const [authResult, body] = await Promise.all([
      supabaseAnon.auth.getUser(token),
      req.json()
    ])

    const { data: { user }, error: authError } = authResult
    if (authError || !user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    // Buscar role do usuário
    const { data: appUser } = await supabase
      .from('app_users')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = (appUser?.role as string) || 'servico'
    if (userRole !== 'admin' && userRole !== 'comunicacao') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Acesso negado'
      }), {
        status: 403,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    const { 
      action,
      cardId,
      amount,
      type,
      description,
      name,
      cardNumber,
      cardCode,
      phoneNumber,
      initialBalance
    } = body

    // ==================== CRIAR CARTÃO ====================
    const isCreate = action === 'create' || (!cardId && name && cardNumber && phoneNumber)

    if (isCreate) {
      // Validações antes de chamadas ao banco
      if (!name || !cardNumber || !phoneNumber || !cardCode) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Dados inválidos: name, cardNumber, phoneNumber e cardCode são obrigatórios'
        }), {
          status: 400,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        })
      }

      const balance = initialBalance ? parseFloat(initialBalance.toString()) : 0

      // Verificar se existe e criar em sequência (precisa verificar antes)
      const { data: existingCard } = await supabase
        .from('cards')
        .select('id')
        .eq('card_number', cardNumber)
        .maybeSingle()

      if (existingCard) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Cartão com este número já existe'
        }), {
          status: 400,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        })
      }

      // Criar cartão
      const { data: newCard, error: createError } = await supabase
        .from('cards')
        .insert({
          user_name: name,
          card_number: cardNumber,
          card_code: cardCode,
          phone_number: phoneNumber,
          balance: balance,
          user_id: null
        })
        .select()
        .single()

      if (createError || !newCard) {
        return new Response(JSON.stringify({
          success: false,
          error: `Erro ao criar cartão: ${createError?.message || 'Erro desconhecido'}`
        }), {
          status: 500,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        })
      }

      // Criar transação em paralelo (não espera resposta)
      if (balance > 0) {
        supabase.from('transactions').insert({
          card_id: newCard.id,
          amount: balance,
          type: 'credit',
          description: description || 'Saldo inicial',
          created_by: user.id
        }).then(() => {}).catch(() => {}) // Fire and forget
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          card: newCard,
          message: `Cartão criado com sucesso${balance > 0 ? ` com saldo inicial de R$ ${balance.toFixed(2)}` : ''}!`
        }
      }), {
        status: 200,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    // ==================== ASSOCIAR CARTÃO ====================
    if (action === 'associate') {
      // Validações
      if (!cardNumber || !cardCode) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Dados inválidos: cardNumber e cardCode são obrigatórios'
        }), {
          status: 400,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        })
      }

      // Buscar cartão por número e código
      const { data: existingCard, error: findError } = await supabase
        .from('cards')
        .select('id, is_associated, card_code, user_name')
        .eq('card_number', cardNumber)
        .maybeSingle()

      if (findError || !existingCard) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Cartão não encontrado'
        }), {
          status: 404,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        })
      }

      if (existingCard.card_code !== cardCode) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Código do cartão inválido'
        }), {
          status: 400,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        })
      }

      if (existingCard.is_associated) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Cartão já associado. Fale com a coordenação do encontro se quiser mudar a conta do cartão associado.'
        }), {
          status: 400,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        })
      }

      // Obter nome do usuário
      const { data: authUser } = await supabaseAnon.auth.getUser(token)
      const userName = authUser?.user?.user_metadata?.name || null

      // Associar cartão ao usuário
      const { data: updatedCard, error: updateError } = await supabase
        .from('cards')
        .update({
          user_id: user.id,
          user_name: userName,
          is_associated: true,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingCard.id)
        .eq('is_associated', false)
        .select('*')
        .single()

      if (updateError || !updatedCard) {
        return new Response(JSON.stringify({
          success: false,
          error: `Erro ao associar cartão: ${updateError?.message || 'Erro desconhecido'}`
        }), {
          status: 500,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        })
      }

      return new Response(JSON.stringify({
        success: true,
        data: updatedCard
      }), {
        status: 200,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    // ==================== ATUALIZAR SALDO ====================
    // Validações antes de chamadas ao banco
    if (!cardId || amount === undefined || !type) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Dados inválidos: cardId, amount e type são obrigatórios'
      }), {
        status: 400,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    if (amount <= 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Valor deve ser maior que zero'
      }), {
        status: 400,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    if (type !== 'credit' && type !== 'debit') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Tipo inválido: deve ser "credit" ou "debit"'
      }), {
        status: 400,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    // Buscar cartão
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, balance, user_name')
      .eq('id', cardId)
      .single()

    if (cardError || !card) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Cartão não encontrado'
      }), {
        status: 404,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    const currentBalance = parseFloat(card.balance.toString())
    const newBalance = type === 'credit' 
      ? currentBalance + amount 
      : currentBalance - amount

    if (type === 'debit' && newBalance < 0) {
      return new Response(JSON.stringify({
        success: false,
        error: `Saldo insuficiente. Saldo atual: R$ ${currentBalance.toFixed(2)}, Débito: R$ ${amount.toFixed(2)}`
      }), {
        status: 400,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    // Atualizar saldo e criar transação em paralelo
    const [updateResult, transactionResult] = await Promise.all([
      supabase
        .from('cards')
        .update({
          balance: newBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', cardId),
      supabase.from('transactions').insert({
        card_id: cardId,
        amount: type === 'credit' ? amount : -amount,
        type,
        description: description || `${type === 'credit' ? 'Crédito' : 'Débito'} realizado por admin`,
        created_by: user.id
      })
    ])

    if (updateResult.error) {
      return new Response(JSON.stringify({
        success: false,
        error: `Erro ao atualizar saldo: ${updateResult.error.message}`
      }), {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    // Ignorar erro na transação (não crítico)
    if (transactionResult.error) {
      console.error('Erro ao criar transação (não crítico):', transactionResult.error)
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        cardId,
        previousBalance: currentBalance,
        newBalance,
        amount,
        type,
        message: `Saldo ${type === 'credit' ? 'creditado' : 'debitado'} com sucesso!`
      }
    }), {
      status: 200,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Erro inesperado:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
    })
  }
})
