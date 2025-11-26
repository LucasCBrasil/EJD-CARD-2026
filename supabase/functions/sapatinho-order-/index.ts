import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ==================== SUPABASE CLIENT ====================

const createSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing environment variables');
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

    if (error || !user) return null;

    return {
      id: user.id,
      email: user.email
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
      error: 'Unauthorized'
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

    // 2. EXTRAIR DADOS
    const { senderTeam, recipientName, recipientAddress, message, isAnonymous, items } = await req.json();

    // 3. VALIDAÇÕES
    if (!senderTeam || !recipientName || !recipientAddress || !items || items.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Dados inválidos'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const supabase = createSupabaseClient();

    // 4. BUSCAR CARTÃO DO USUÁRIO
    const { data: card, error: cardError } = await supabase
      .from('cards')
      .select('id, balance, user_name')
      .eq('user_id', user.id)
      .single();

    if (cardError || !card) {
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

    // 5. VALIDAR PRODUTOS E ESTOQUE (✅ TABELA CORRETA: sapatinho_products)
    const productIds = items.map((item: any) => item.productId);
    console.log('Buscando produtos com IDs:', productIds);
    
    const { data: products, error: productsError } = await supabase
      .from('sapatinho_products') // ✅ TABELA CORRETA!
      .select('id, name, price, active, stock')
      .in('id', productIds);

    if (productsError) {
      console.error('Products error:', productsError);
      return new Response(JSON.stringify({
        success: false,
        error: `Erro ao buscar produtos: ${productsError.message}`
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!products || products.length === 0) {
      console.error('Nenhum produto encontrado para os IDs:', productIds);
      return new Response(JSON.stringify({
        success: false,
        error: 'Nenhum produto encontrado. Verifique se os produtos existem e estão ativos.'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    console.log('Produtos encontrados:', products.length);

    // VALIDAR TODOS OS PRODUTOS E ESTOQUE ANTES DE FAZER QUALQUER OPERAÇÃO
    const validationErrors: string[] = [];
    let calculatedTotal = 0;

    for (const item of items) {
      const product = products.find((p: any) => p.id === item.productId);

      if (!product) {
        console.error(`Produto não encontrado: ${item.productName || item.productId} (ID: ${item.productId})`);
        validationErrors.push(`Produto não encontrado: ${item.productName || item.productId}`);
        continue;
      }

      console.log(`Validando produto: ${product.name}, ativo: ${product.active}, estoque: ${product.stock}, quantidade solicitada: ${item.quantity}`);

      if (!product.active) {
        validationErrors.push(`O produto "${product.name}" está inativo e não pode ser vendido.`);
        continue;
      }

      const priceDiff = Math.abs(parseFloat(item.price) - parseFloat(product.price));
      if (priceDiff > 0.01) {
        console.error(`Preço inválido para ${product.name}. Esperado: ${product.price}, Recebido: ${item.price}`);
        validationErrors.push(`Preço inválido para "${product.name}". Esperado: R$ ${parseFloat(product.price).toFixed(2)}, Recebido: R$ ${parseFloat(item.price).toFixed(2)}`);
        continue;
      }

      // ✅ VALIDAR ESTOQUE (se o produto tiver controle de estoque)
      if (product.stock !== null && product.stock !== undefined) {
        const stock = parseInt(product.stock) || 0;
        const quantity = parseInt(item.quantity) || 0;
        
        if (stock === 0) {
          validationErrors.push(`O produto "${product.name}" não está mais disponível em estoque.`);
          continue;
        }
        if (stock < quantity) {
          validationErrors.push(`Estoque insuficiente para "${product.name}". Temos apenas ${stock} unidade${stock > 1 ? 's' : ''} disponível${stock > 1 ? 'eis' : ''}, mas você está tentando comprar ${quantity}.`);
          continue;
        }
      }

      calculatedTotal += parseFloat(product.price) * parseInt(item.quantity);
    }

    // Se houver erros de validação, retornar TODOS de uma vez
    if (validationErrors.length > 0) {
      const errorMessage = validationErrors.length === 1
        ? validationErrors[0]
        : `Não é possível finalizar o pedido:\n${validationErrors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`;
      
      console.error('Erros de validação:', validationErrors);
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

    console.log(`Validação OK. Total calculado: R$ ${calculatedTotal.toFixed(2)}`);

    // 6. VALIDAR SALDO
    if (card.balance < calculatedTotal) {
      return new Response(JSON.stringify({
        success: false,
        error: `Saldo insuficiente. Saldo: R$ ${card.balance.toFixed(2)}, Total: R$ ${calculatedTotal.toFixed(2)}`
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 7. CRIAR VENDA (sapatinho_sales)
    const { data: saleData, error: saleError } = await supabase
      .from('sapatinho_sales')
      .insert({
        card_id: card.id,
        seller_id: user.id,
        total: calculatedTotal,
        status: 'completed'
      })
      .select('id')
      .single();

    if (saleError || !saleData) {
      console.error('Sale creation error:', saleError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao criar venda'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const saleId = saleData.id;

    // 8. CRIAR ITENS DA VENDA
    const saleItems = items.map((item: any) => ({
      sale_id: saleId,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      price: item.price
    }));

    const { error: itemsError } = await supabase
      .from('sapatinho_sale_items')
      .insert(saleItems);

    if (itemsError) {
      console.error('Sale items error:', itemsError);
      await supabase.from('sapatinho_sales').delete().eq('id', saleId);
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao criar itens da venda'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 9. ✅ DIMINUIR ESTOQUE DOS PRODUTOS (antes de criar o pedido)
    const productsWithStock = items
      .map((item: any) => {
        const product = products.find((p: any) => p.id === item.productId);
        return product && product.stock !== null && product.stock !== undefined 
          ? { product, item } 
          : null;
      })
      .filter((p): p is { product: any; item: any } => p !== null);

    // Variável para armazenar os updates de estoque (para possível reversão)
    let stockUpdates: Array<{ id: string; newStock: number; oldStock: number; name: string }> = [];

    if (productsWithStock.length > 0) {
      // Buscar estoques atuais de todos os produtos de uma vez (para evitar race conditions)
      const productIdsToUpdate = productsWithStock.map(p => p.product.id);
      const { data: currentProducts, error: fetchError } = await supabase
        .from('sapatinho_products')
        .select('id, stock, name')
        .in('id', productIdsToUpdate);
      
      if (fetchError || !currentProducts) {
        console.error('Error fetching product stocks:', fetchError);
        await supabase.from('sapatinho_sale_items').delete().eq('sale_id', saleId);
        await supabase.from('sapatinho_sales').delete().eq('id', saleId);
        return new Response(JSON.stringify({
          success: false,
          error: 'Erro ao verificar estoque dos produtos'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }

      // Verificar estoque novamente e preparar updates
      stockUpdates = [];
      for (const { product, item } of productsWithStock) {
        const currentProduct = currentProducts.find((p: any) => p.id === product.id);
        if (!currentProduct) {
          await supabase.from('sapatinho_sale_items').delete().eq('sale_id', saleId);
          await supabase.from('sapatinho_sales').delete().eq('id', saleId);
          return new Response(JSON.stringify({
            success: false,
            error: `Produto "${product.name}" não encontrado no banco`
          }), {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }

        // Verificar se ainda tem estoque suficiente (pode ter mudado desde a validação inicial)
        if (currentProduct.stock < item.quantity) {
          await supabase.from('sapatinho_sale_items').delete().eq('sale_id', saleId);
          await supabase.from('sapatinho_sales').delete().eq('id', saleId);
          return new Response(JSON.stringify({
            success: false,
            error: `Estoque insuficiente para "${currentProduct.name}". Disponível: ${currentProduct.stock}, Solicitado: ${item.quantity}. O pedido foi cancelado.`
          }), {
            status: 400,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }

        stockUpdates.push({
          id: product.id,
          newStock: currentProduct.stock - item.quantity,
          oldStock: currentProduct.stock,
          name: currentProduct.name
        });
      }

      // Atualizar todos os estoques em paralelo (com optimistic locking)
      const updatePromises = stockUpdates.map(({ id, newStock, oldStock, name }) =>
        supabase
          .from('sapatinho_products')
          .update({ stock: newStock })
          .eq('id', id)
          .eq('stock', oldStock) // Optimistic locking para evitar race conditions
          .then(({ error }) => ({ id, name, error }))
      );

      const updateResults = await Promise.all(updatePromises);
      const failedUpdates = updateResults.filter(r => r.error);

      if (failedUpdates.length > 0) {
        console.error('Stock update errors:', failedUpdates);
        await supabase.from('sapatinho_sale_items').delete().eq('sale_id', saleId);
        await supabase.from('sapatinho_sales').delete().eq('id', saleId);
        return new Response(JSON.stringify({
          success: false,
          error: `Erro ao atualizar estoque de: ${failedUpdates.map(u => u.name).join(', ')}. O pedido foi cancelado.`
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
    }

    // 10. CRIAR PEDIDO SAPATINHO VELOZ
    const { data: orderData, error: orderError } = await supabase
      .from('sapatinho_veloz_orders')
      .insert({
        sale_id: saleId,
        sender_user_id: user.id,
        sender_name: isAnonymous ? null : card.user_name,
        sender_team: senderTeam,
        recipient_name: recipientName,
        recipient_address: recipientAddress,
        message: message || null,
        total: calculatedTotal,
        status: 'completed'
      })
      .select('id')
      .single();

    if (orderError || !orderData) {
      console.error('Order creation error:', orderError);
      // Reverter estoque se o pedido falhar
      if (productsWithStock.length > 0 && stockUpdates.length > 0) {
        for (const stockUpdate of stockUpdates) {
          await supabase
            .from('sapatinho_products')
            .update({ stock: stockUpdate.oldStock })
            .eq('id', stockUpdate.id);
        }
      }
      await supabase.from('sapatinho_sale_items').delete().eq('sale_id', saleId);
      await supabase.from('sapatinho_sales').delete().eq('id', saleId);
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao criar pedido'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const orderId = orderData.id;

    // 11. CRIAR ITENS DO PEDIDO
    const orderItems = items.map((item: any) => ({
      order_id: orderId,
      product_id: item.productId,
      product_name: item.productName,
      quantity: item.quantity,
      price: item.price
    }));

    const { error: orderItemsError } = await supabase
      .from('sapatinho_veloz_order_items')
      .insert(orderItems);

    if (orderItemsError) {
      console.error('Order items error:', orderItemsError);
      // Continuar mesmo com erro nos itens do pedido (já foi criado)
    }

    // 12. ATUALIZAR SALDO DO CARTÃO
    const { error: balanceError } = await supabase
      .from('cards')
      .update({
        balance: card.balance - calculatedTotal
      })
      .eq('id', card.id);

    if (balanceError) {
      console.error('Balance update error:', balanceError);
      // Tentar deletar tudo e reverter estoque
      if (productsWithStock.length > 0 && stockUpdates.length > 0) {
        for (const stockUpdate of stockUpdates) {
          await supabase
            .from('sapatinho_products')
            .update({ stock: stockUpdate.oldStock })
            .eq('id', stockUpdate.id);
        }
      }
      await supabase.from('sapatinho_veloz_order_items').delete().eq('order_id', orderId);
      await supabase.from('sapatinho_veloz_orders').delete().eq('id', orderId);
      await supabase.from('sapatinho_sale_items').delete().eq('sale_id', saleId);
      await supabase.from('sapatinho_sales').delete().eq('id', saleId);
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao atualizar saldo'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 13. CRIAR TRANSAÇÃO
    const { error: transactionError } = await supabase.from('transactions').insert({
      card_id: card.id,
      amount: -calculatedTotal,
      type: 'debit',
      description: `Pedido Sapatinho Veloz - ${items.length} itens`
    });

    if (transactionError) {
      console.error('Transaction creation error:', transactionError);
      // Não falhar o pedido por causa da transação, mas logar o erro
      // O saldo já foi atualizado, então o pedido está válido
    }

    // 14. VERIFICAR SE TUDO FOI CRIADO CORRETAMENTE
    // Fazer uma verificação final para garantir que o pedido existe
    const { data: verifyOrder, error: verifyError } = await supabase
      .from('sapatinho_veloz_orders')
      .select('id')
      .eq('id', orderId)
      .single();

    if (verifyError || !verifyOrder) {
      console.error('Verificação final falhou:', verifyError);
      // Tentar reverter tudo
      if (productsWithStock.length > 0 && stockUpdates.length > 0) {
        for (const stockUpdate of stockUpdates) {
          await supabase
            .from('sapatinho_products')
            .update({ stock: stockUpdate.oldStock })
            .eq('id', stockUpdate.id);
        }
      }
      await supabase.from('sapatinho_veloz_order_items').delete().eq('order_id', orderId);
      await supabase.from('sapatinho_veloz_orders').delete().eq('id', orderId);
      await supabase.from('sapatinho_sale_items').delete().eq('sale_id', saleId);
      await supabase.from('sapatinho_sales').delete().eq('id', saleId);
      
      // Reverter saldo
      await supabase
        .from('cards')
        .update({ balance: card.balance })
        .eq('id', card.id);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao verificar pedido criado. O pedido foi cancelado.'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    // 15. SUCESSO! Tudo foi criado e verificado
    return new Response(JSON.stringify({
      success: true,
      data: {
        orderId,
        saleId,
        total: calculatedTotal,
        message: 'Pedido criado com sucesso!'
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

