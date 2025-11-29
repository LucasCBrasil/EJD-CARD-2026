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
import { roundMoney, safeSumMoney, safeSubtractMoney, hasSufficientBalance } from '../_shared/money.ts';

Deno.serve(async (req: Request) => {
  const startTime = Date.now()
  console.log(`[${new Date().toISOString()}] Iniciando processamento - Método: ${req.method}`)
  
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
      console.error(`[${new Date().toISOString()}] Erro de autenticação:`, {
        error: authError?.message || 'Usuário não encontrado',
        hasToken: !!token,
        tokenLength: token?.length || 0
      })
      return new Response(JSON.stringify({
        success: false,
        error: 'Unauthorized'
      }), {
        status: 401,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    console.log(`[${new Date().toISOString()}] Usuário autenticado:`, { userId: user.id, email: user.email })

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

    // ==================== ASSOCIAR CARTÃO (qualquer usuário autenticado) ====================
    // Esta ação deve vir ANTES da verificação de role pois qualquer usuário pode associar
    if (action === 'associate') {
      console.log(`[${new Date().toISOString()}] Iniciando associação de cartão:`, {
        cardNumber,
        hasCardCode: !!cardCode,
        userId: user.id
      })

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

      // Normalizar número do cartão:
      // - Remove zeros à esquerda extras mas mantém formato de 3 dígitos
      // - "0063" -> "063", "63" -> "063", "063" -> "063"
      const normalizeCardNumber = (num: string): string => {
        // Remove todos os zeros à esquerda e converte para número
        const asNumber = parseInt(num, 10)
        if (isNaN(asNumber)) return num
        // Formata de volta com 3 dígitos (padding com zeros)
        return asNumber.toString().padStart(3, '0')
      }
      
      const normalizedCardNumber = normalizeCardNumber(cardNumber)
      
      // Normalizar código do cartão para minúsculo
      const normalizedCardCode = cardCode.toLowerCase().trim()

      console.log(`[${new Date().toISOString()}] Número normalizado: ${cardNumber} -> ${normalizedCardNumber}, Código normalizado para lowercase`)

      // Buscar cartão por número normalizado
      const { data: existingCard, error: findError } = await supabase
        .from('cards')
        .select('id, is_associated, card_code, user_name')
        .eq('card_number', normalizedCardNumber)
        .maybeSingle()

      if (findError || !existingCard) {
        return new Response(JSON.stringify({
          success: false,
          error: `Cartão não encontrado. Verifique se o número está correto (tentamos buscar: ${normalizedCardNumber})`
        }), {
          status: 404,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        })
      }

      // Comparar código em lowercase (banco já está em lowercase)
      const dbCardCode = (existingCard.card_code || '').toLowerCase().trim()
      if (dbCardCode !== normalizedCardCode) {
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

      const elapsedTime = Date.now() - startTime
      console.log(`[${new Date().toISOString()}] Cartão associado com sucesso - Tempo: ${elapsedTime}ms:`, {
        cardId: updatedCard.id,
        cardNumber: updatedCard.card_number,
        userId: user.id
      })

      return new Response(JSON.stringify({
        success: true,
        data: updatedCard
      }), {
        status: 200,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    // ==================== VERIFICAR PERMISSÕES PARA OUTRAS AÇÕES ====================
    // Criar cartão e atualizar saldo requerem admin ou comunicacao
    const { data: appUser } = await supabase
      .from('app_users')
      .select('role')
      .eq('id', user.id)
      .single()

    const userRole = (appUser?.role as string) || 'encontrista'
    if (userRole !== 'admin' && userRole !== 'comunicacao') {
      console.error(`[${new Date().toISOString()}] Acesso negado:`, {
        userId: user.id,
        userEmail: user.email,
        userRole,
        requiredRoles: ['admin', 'comunicacao']
      })
      return new Response(JSON.stringify({
        success: false,
        error: 'Acesso negado'
      }), {
        status: 403,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    console.log(`[${new Date().toISOString()}] Permissão verificada:`, { userId: user.id, role: userRole })

    // ==================== CRIAR CARTÃO ====================
    const isCreate = action === 'create' || (!cardId && name && cardNumber && phoneNumber)

    if (isCreate) {
      console.log(`[${new Date().toISOString()}] Iniciando criação de cartão:`, {
        name,
        cardNumber,
        phoneNumber: phoneNumber ? `${phoneNumber.substring(0, 3)}***` : null,
        hasCardCode: !!cardCode,
        initialBalance
      })

      // Validações antes de chamadas ao banco
      if (!name || !cardNumber || !phoneNumber || !cardCode) {
        console.error(`[${new Date().toISOString()}] Validação falhou ao criar cartão:`, {
          hasName: !!name,
          hasCardNumber: !!cardNumber,
          hasPhoneNumber: !!phoneNumber,
          hasCardCode: !!cardCode
        })
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
        console.error(`[${new Date().toISOString()}] Tentativa de criar cartão duplicado:`, {
          cardNumber,
          existingCardId: existingCard.id,
          requestedBy: user.id
        })
        return new Response(JSON.stringify({
          success: false,
          error: `Não é possível criar um cartão com o número ${cardNumber}. Este número já está cadastrado no sistema. Por favor, use um número diferente.`
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
        console.error(`[${new Date().toISOString()}] Erro ao criar cartão no banco:`, {
          error: createError?.message || 'Cartão não retornado',
          errorCode: createError?.code,
          errorDetails: createError?.details,
          cardNumber,
          requestedBy: user.id,
          stack: createError instanceof Error ? createError.stack : undefined
        })
        return new Response(JSON.stringify({
          success: false,
          error: `Erro ao criar cartão: ${createError?.message || 'Erro desconhecido'}`
        }), {
          status: 500,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        })
      }

      // Criar transação se houver saldo inicial (aguardar para garantir que foi criada)
      if (balance > 0) {
        const { error: transactionError } = await supabase.from('transactions').insert({
          card_id: newCard.id,
          amount: balance,
          type: 'credit',
          description: description || 'Saldo inicial',
          created_by: user.id
        })
        
        if (transactionError) {
          console.error(`[${new Date().toISOString()}] Erro ao criar transação inicial (não crítico):`, {
            error: transactionError.message,
            errorCode: transactionError.code,
            errorDetails: transactionError.details,
            cardId: newCard.id,
            amount: balance,
            requestedBy: user.id
          })
          // Não falhar a criação do cartão por causa da transação
        }
      }

      const elapsedTime = Date.now() - startTime
      console.log(`[${new Date().toISOString()}] Cartão criado com sucesso - Tempo: ${elapsedTime}ms:`, {
        cardId: newCard.id,
        cardNumber: newCard.card_number,
        initialBalance: balance,
        createdBy: user.id
      })

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

    // ==================== ATUALIZAR SALDO ====================
    console.log(`[${new Date().toISOString()}] Iniciando atualização de saldo:`, {
      cardId,
      amount,
      type,
      requestedBy: user.id
    })

    // Validações antes de chamadas ao banco
    if (!cardId || amount === undefined || !type) {
      console.error(`[${new Date().toISOString()}] Validação falhou ao atualizar saldo:`, {
        hasCardId: !!cardId,
        hasAmount: amount !== undefined,
        hasType: !!type,
        requestedBy: user.id
      })
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
      console.error(`[${new Date().toISOString()}] Cartão não encontrado:`, {
        cardId,
        error: cardError?.message || 'Cartão não retornado',
        errorCode: cardError?.code,
        requestedBy: user.id
      })
      return new Response(JSON.stringify({
        success: false,
        error: 'Cartão não encontrado'
      }), {
        status: 404,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    // ⚠️ Operações monetárias seguras (evita erros de precisão float)
    const currentBalance = roundMoney(card.balance)
    const safeAmount = roundMoney(amount)
    const newBalance = type === 'credit' 
      ? safeSumMoney(currentBalance, safeAmount) 
      : safeSubtractMoney(currentBalance, safeAmount)

    if (type === 'debit' && !hasSufficientBalance(currentBalance, safeAmount)) {
      console.error(`[${new Date().toISOString()}] Saldo insuficiente:`, {
        cardId,
        currentBalance,
        debitAmount: amount,
        calculatedNewBalance: newBalance,
        requestedBy: user.id
      })
      return new Response(JSON.stringify({
        success: false,
        error: `Saldo insuficiente. Saldo atual: R$ ${currentBalance.toFixed(2)}, Débito: R$ ${amount.toFixed(2)}`
      }), {
        status: 400,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    // Atualizar saldo e criar transação em paralelo
    // ⚠️ Valores arredondados para garantir precisão
    const [updateResult, transactionResult] = await Promise.all([
      supabase
        .from('cards')
        .update({
          balance: roundMoney(newBalance),
          updated_at: new Date().toISOString()
        })
        .eq('id', cardId),
      supabase.from('transactions').insert({
        card_id: cardId,
        amount: roundMoney(type === 'credit' ? safeAmount : -safeAmount),
        type,
        description: description || `${type === 'credit' ? 'Crédito' : 'Débito'} realizado por admin`,
        created_by: user.id
      })
    ])

    if (updateResult.error) {
      console.error(`[${new Date().toISOString()}] Erro ao atualizar saldo no banco:`, {
        cardId,
        error: updateResult.error.message,
        errorCode: updateResult.error.code,
        errorDetails: updateResult.error.details,
        previousBalance: currentBalance,
        newBalance,
        type,
        amount,
        requestedBy: user.id,
        stack: updateResult.error instanceof Error ? updateResult.error.stack : undefined
      })
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
      console.error(`[${new Date().toISOString()}] Erro ao criar transação (não crítico):`, {
        cardId,
        error: transactionResult.error.message,
        errorCode: transactionResult.error.code,
        type,
        amount,
        requestedBy: user.id
      })
    }

    const elapsedTime = Date.now() - startTime
    console.log(`[${new Date().toISOString()}] Saldo atualizado com sucesso - Tempo: ${elapsedTime}ms:`, {
      cardId,
      previousBalance: currentBalance,
      newBalance,
      amount,
      type,
      requestedBy: user.id
    })

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
    const elapsedTime = Date.now() - startTime
    const errorDetails = {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : 'Unknown',
      stack: error instanceof Error ? error.stack : undefined,
      elapsedTime: `${elapsedTime}ms`,
      timestamp: new Date().toISOString()
    }
    
    console.error(`[${new Date().toISOString()}] Erro inesperado após ${elapsedTime}ms:`, errorDetails)
    
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
    })
  }
})
