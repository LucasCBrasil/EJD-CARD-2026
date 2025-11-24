import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const createSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing environment variables: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
};

const getAuthUser = async (req: Request) => {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return null;

    const token = authHeader.replace('Bearer ', '');
    if (!token) return null;

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing Supabase credentials');
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      console.error('Auth error:', error);
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role
    };
  } catch (error) {
    console.error('Error validating auth:', error);
    return null;
  }
};

const requireAuth = async (req: Request) => {
  const user = await getAuthUser(req);

  if (!user) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Unauthorized: Authentication required'
    }), {
      status: 401,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  return user;
};

// ==================== CORS ====================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

// ==================== MAIN FUNCTION ====================
Deno.serve(async (req: Request) => {
  // Tratar OPTIONS (CORS preflight)
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
      status: 200
    });
  }

  try {
    // 1. VALIDAR AUTENTICAÇÃO
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) {
      return authResult;
    }
    const user = authResult;

    // 2. EXTRAIR DADOS DA REQUISIÇÃO
    const { cardId, items, category, coupon, discountedTotal } = await req.json();

    // 3. VALIDAÇÕES BÁSICAS
    if (!cardId || !items || items.length === 0 || !category) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Dados inválidos: cardId, items e category são obrigatórios'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 4. CRIAR CLIENTE SUPABASE
    const supabase = createSupabaseClient();

    // 5. BUSCAR CARTÃO
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, balance, user_id, user_name')
      .eq('id', cardId)
      .single();

    if (cardError || !card) {
      console.error('Card not found:', cardError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Cartão não encontrado'
      }), {
        status: 404,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 6. VALIDAR PREÇOS DOS PRODUTOS
    const productIds = items.map((item: any) => item.productId);
    let productsQuery = supabase
      .from('products')
      .select('id, name, price, active, stock, category')
      .in('id', productIds);
    
    if (category && category !== 'sapatinho') {
      productsQuery = productsQuery.eq('category', category);
    }
    
    const { data: products, error: productsError } = await productsQuery;

    if (productsError || !products) {
      console.error('Products not found:', productsError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao buscar produtos'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // VALIDAR TODOS OS PRODUTOS ANTES DE FAZER QUALQUER OPERAÇÃO
    const validationErrors: string[] = [];
    let calculatedTotal = 0;
    
    for (const item of items) {
      const product = products.find((p: any) => p.id === item.productId);

      if (!product) {
        validationErrors.push(`Produto não encontrado: ${item.productName || item.productId}`);
        continue;
      }

      if (!product.active) {
        validationErrors.push(`O produto "${product.name}" está inativo e não pode ser vendido.`);
        continue;
      }

      if (Math.abs(item.price - product.price) > 0.01) {
        validationErrors.push(`Preço inválido para "${product.name}". Esperado: R$ ${product.price.toFixed(2)}, Recebido: R$ ${item.price.toFixed(2)}`);
        continue;
      }

      // Validar estoque (se o produto tiver controle de estoque)
      if (product.stock !== null && product.stock !== undefined) {
        if (product.stock === 0) {
          validationErrors.push(`O produto "${product.name}" não está mais disponível em estoque.`);
          continue;
        }
        if (product.stock < item.quantity) {
          validationErrors.push(`Estoque insuficiente para "${product.name}". Temos apenas ${product.stock} unidade${product.stock > 1 ? 's' : ''} disponível${product.stock > 1 ? 'eis' : ''}, mas você está tentando comprar ${item.quantity}.`);
          continue;
        }
      }

      calculatedTotal += product.price * item.quantity;
    }

    // Se houver erros de validação, retornar TODOS de uma vez
    if (validationErrors.length > 0) {
      const errorMessage = validationErrors.length === 1
        ? validationErrors[0]
        : `Não é possível finalizar a venda:\n${validationErrors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`;
      
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    let finalTotal = calculatedTotal;
    if (coupon && discountedTotal < calculatedTotal) {
      const { data: couponData } = await supabase
        .from('coupons')
        .select('name, discount_percent')
        .eq('name', coupon)
        .single();

      if (couponData) {
        const expectedDiscount = calculatedTotal * (couponData.discount_percent / 100);
        const expectedTotal = calculatedTotal - expectedDiscount;

        if (Math.abs(discountedTotal - expectedTotal) < 0.01) {
          finalTotal = discountedTotal;
        }
      }
    }

    // 7. VALIDAR SALDO
    if (card.balance < finalTotal) {
      return new Response(JSON.stringify({
        success: false,
        error: `Saldo insuficiente. Saldo: R$ ${card.balance.toFixed(2)}, Total: R$ ${finalTotal.toFixed(2)}`
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 8. CRIAR VENDA
    // A tabela sales tem: id, card_id, seller_id, sale_id, category, total, status, created_at
    // NÃO tem: user_id, coupon (coupon está em tabela separada)
    const saleIdUnique = `sale_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        card_id: cardId,
        seller_id: user.id,
        sale_id: saleIdUnique,
        category: category,
        total: finalTotal,
        status: 'completed'
      })
      .select('id')
      .single();

    if (saleError || !saleData) {
      console.error('Sale creation error:', saleError);
      return new Response(JSON.stringify({
        success: false,
        error: `Erro ao criar venda: ${saleError?.message || 'Erro desconhecido'}`
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const saleId = saleData.id;

    // 9. CRIAR ITENS DA VENDA
    const saleItems = items.map((item: any) => ({
      sale_id: saleId,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      price: item.price
    }));

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems);

    if (itemsError) {
      console.error('Sale items creation error:', itemsError);
      await supabase.from('sales').delete().eq('id', saleId);
      return new Response(JSON.stringify({
        success: false,
        error: `Erro ao criar itens da venda: ${itemsError.message}`
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 10. DIMINUIR ESTOQUE DOS PRODUTOS
    for (const item of items) {
      const product = products.find((p: any) => p.id === item.productId);
      
      if (product && product.stock !== null && product.stock !== undefined) {
        const newStock = product.stock - item.quantity;
        
        const { error: stockError } = await supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', item.productId);
        
        if (stockError) {
          console.error('Stock update error:', stockError);
          // Não falhar a venda por causa do estoque, apenas logar
        }
      }
    }

    // 11. ATUALIZAR SALDO
    const { error: balanceError } = await supabase
      .from('cards')
      .update({
        balance: card.balance - finalTotal
      })
      .eq('id', cardId);

    if (balanceError) {
      console.error('Balance update error:', balanceError);
      await supabase.from('sale_items').delete().eq('sale_id', saleId);
      await supabase.from('sales').delete().eq('id', saleId);
      return new Response(JSON.stringify({
        success: false,
        error: `Erro ao atualizar saldo: ${balanceError.message}`
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 12. CRIAR TRANSAÇÃO
    await supabase.from('transactions').insert({
      card_id: cardId,
      amount: -finalTotal,
      type: 'debit',
      description: `Venda ${category} - ${items.length} itens`
    });

    // 13. CRIAR PEDIDO SE FOR LOJINHA
    if (category === 'lojinha') {
      // Buscar o último código de pedido para gerar o próximo
      const { data: lastOrder } = await supabase
        .from('orders')
        .select('order_code')
        .not('order_code', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      
      let nextNumber = 1
      if (lastOrder?.order_code) {
        const lastNumber = parseInt(lastOrder.order_code, 10)
        if (!isNaN(lastNumber)) {
          nextNumber = lastNumber + 1
        }
      }
      const orderCode = nextNumber.toString().padStart(5, '0')
      
      const { error: orderError } = await supabase
        .from('orders')
        .insert({
          sale_id: saleId,
          card_id: cardId,
          customer_name: card.user_name || 'Cliente',
          total: finalTotal,
          status: 'completed',
          order_code: orderCode,
          delivered_at: null
        })

      if (orderError) {
        console.error('Erro ao criar pedido (não crítico):', orderError)
        // Não falhar a venda se o pedido não for criado, apenas logar
      }
    }

    // 14. SUCESSO
    return new Response(JSON.stringify({
      success: true,
      data: {
        saleId,
        total: finalTotal,
        message: 'Venda realizada com sucesso!'
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});

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

    // 12. CRIAR TRANSAÇÃO NO HISTÓRICO
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

    // 13. RETORNAR SUCESSO
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

