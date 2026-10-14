import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { roundMoney, hasSufficientBalance } from '../_shared/money.ts';

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

import { getCorsHeaders } from '../_shared/cors.ts';

// ==================== MAIN FUNCTION ====================
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: getCorsHeaders(origin),
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

    // 2. VERIFICAR PERMISSÃO - ENCONTRISTA NÃO PODE FAZER PEDIDOS
    const supabaseForRole = createSupabaseClient();
    const { data: appUser } = await supabaseForRole
      .from('app_users')
      .select('role')
      .eq('id', user.id)
      .single();

    const userRole = (appUser?.role as string) || 'encontrista';

    // Encontrista não pode fazer pedidos no Sapatinho
    if (userRole === 'encontrista') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Acesso negado: encontristas não podem fazer pedidos no Sapatinho Veloz'
      }), {
        status: 403,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    // 3. EXTRAIR DADOS
    const { senderTeam, recipientName, recipientAddress, message, isAnonymous, items } = await req.json();

    // 4. VALIDAÇÕES
    if (!senderTeam || !recipientName || !recipientAddress || !items || items.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Dados inválidos'
      }), {
        status: 400,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    const supabase = createSupabaseClient();

    // 5. BUSCAR CONTA DO USUÁRIO
    const { data: account, error: accountError } = await supabase
      .from('app_users')
      .select('id, balance, name')
      .eq('id', user.id)
      .single();

    if (accountError || !account) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Conta não encontrada'
      }), {
        status: 404,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    // 6. VALIDAR PRODUTOS E ESTOQUE (✅ TABELA CORRETA: sapatinho_products)
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
          ...getCorsHeaders(origin),
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
          ...getCorsHeaders(origin),
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
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    // ⚠️ Operações monetárias seguras
    const safeBalance = roundMoney(account.balance)
    const safeTotal = roundMoney(calculatedTotal)
    
    console.log(`Validação OK. Total calculado: R$ ${safeTotal.toFixed(2)}`);

    if (safeTotal <= 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'O total do pedido deve ser maior que zero'
      }), {
        status: 400,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    // 6. VALIDAR SALDO (usando operações monetárias seguras)
    if (!hasSufficientBalance(safeBalance, safeTotal)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Saldo insuficiente. Saldo: R$ ${safeBalance.toFixed(2)}, Total: R$ ${safeTotal.toFixed(2)}`
      }), {
        status: 400,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    // 7. CRIAR VENDA (sapatinho_sales)
    const { data: saleData, error: saleError } = await supabase
      .from('sapatinho_sales')
      .insert({
        user_id: user.id,
        seller_id: user.id,
        total: roundMoney(safeTotal),
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
          ...getCorsHeaders(origin),
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
          ...getCorsHeaders(origin),
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
      .filter((p: { product: any; item: any } | null): p is { product: any; item: any } => p !== null);

    // Variável para armazenar os updates de estoque (para possível reversão)
    let stockUpdates: Array<{ id: string; newStock: number; oldStock: number; name: string }> = [];

    if (productsWithStock.length > 0) {
      // Buscar estoques atuais de todos os produtos de uma vez (para evitar race conditions)
      const productIdsToUpdate = productsWithStock.map((p: { product: any; item: any }) => p.product.id);
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
            ...getCorsHeaders(origin),
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
              ...getCorsHeaders(origin),
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
              ...getCorsHeaders(origin),
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
            ...getCorsHeaders(origin),
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
        sender_name: isAnonymous ? null : account.name,
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
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    const orderId = orderData.id;

    // 11. CRIAR ITENS DO PEDIDO
    // Garantir que os tipos estão corretos
    const orderItems = items.map((item: any) => {
      const product = products.find((p: any) => p.id === item.productId);
      if (!product) {
        throw new Error(`Produto não encontrado: ${item.productId}`);
      }
      
      return {
        order_id: orderId,
        product_id: item.productId,
        product_name: item.productName || product.name,
        quantity: parseInt(String(item.quantity)) || 0,
        price: parseFloat(String(item.price)) || parseFloat(String(product.price)) || 0
      };
    });

    console.log('Tentando inserir orderItems:', JSON.stringify(orderItems, null, 2));

    const { error: orderItemsError, data: insertedOrderItems } = await supabase
      .from('sapatinho_veloz_order_items')
      .insert(orderItems)
      .select();

    if (orderItemsError) {
      console.error('❌ Order items error:', orderItemsError);
      console.error('❌ Order items que falharam:', JSON.stringify(orderItems, null, 2));
      console.error('❌ Erro completo:', JSON.stringify(orderItemsError, null, 2));
      // NÃO continuar se houver erro - isso é crítico!
      // Reverter tudo se os itens não foram criados
      await supabase.from('sapatinho_veloz_orders').delete().eq('id', orderId);
      await supabase.from('sapatinho_sale_items').delete().eq('sale_id', saleId);
      await supabase.from('sapatinho_sales').delete().eq('id', saleId);
      
      // Reverter estoque
      if (productsWithStock.length > 0 && stockUpdates.length > 0) {
        for (const stockUpdate of stockUpdates) {
          await supabase
            .from('sapatinho_products')
            .update({ stock: stockUpdate.oldStock })
            .eq('id', stockUpdate.id);
        }
      }
      
      return new Response(JSON.stringify({
        success: false,
        error: `Erro ao criar itens do pedido: ${orderItemsError.message || orderItemsError.details || 'Erro desconhecido'}`
      }), {
        status: 500,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    } else {
      console.log('✅ Order items criados com sucesso:', insertedOrderItems?.length || 0);
      console.log('✅ Itens criados:', JSON.stringify(insertedOrderItems, null, 2));
    }

    // 12. VERIFICAR SE TUDO FOI CRIADO CORRETAMENTE
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

      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao verificar pedido criado. O pedido foi cancelado.'
      }), {
        status: 500,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    // 13. DEBITAR A CONTA E REGISTRAR A TRANSAÇÃO ATOMICAMENTE
    const { error: balanceError } = await supabase.rpc('adjust_account_balance', {
      p_user_id: user.id,
      p_amount: safeTotal,
      p_type: 'debit',
      p_description: `Pedido Sapatinho Veloz - ${items.length} itens`,
      p_created_by: user.id,
    });

    if (balanceError) {
      console.error('Account balance update error:', balanceError);
      if (productsWithStock.length > 0 && stockUpdates.length > 0) {
        for (const stockUpdate of stockUpdates) {
          const { error: restoreError } = await supabase
            .from('sapatinho_products')
            .update({ stock: stockUpdate.oldStock })
            .eq('id', stockUpdate.id)
            .eq('stock', stockUpdate.newStock);
          if (restoreError) {
            console.error('Failed to restore Sapatinho stock after debit failure:', {
              productId: stockUpdate.id,
              error: restoreError.message,
            });
          }
        }
      }
      await supabase.from('sapatinho_veloz_order_items').delete().eq('order_id', orderId);
      await supabase.from('sapatinho_veloz_orders').delete().eq('id', orderId);
      await supabase.from('sapatinho_sale_items').delete().eq('sale_id', saleId);
      await supabase.from('sapatinho_sales').delete().eq('id', saleId);

      const insufficientBalance = balanceError.message.includes('INSUFFICIENT_BALANCE');
      return new Response(JSON.stringify({
        success: false,
        error: insufficientBalance
          ? `Saldo insuficiente. Saldo: R$ ${safeBalance.toFixed(2)}, Total: R$ ${safeTotal.toFixed(2)}`
          : 'Erro ao atualizar saldo da conta'
      }), {
        status: insufficientBalance ? 400 : 500,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    // 14. SUCESSO! Tudo foi criado e verificado
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
        ...getCorsHeaders(origin),
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
        ...getCorsHeaders(origin),
        'Content-Type': 'application/json'
      }
    });
  }
});
