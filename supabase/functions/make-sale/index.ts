import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { roundMoney, hasSufficientBalance } from '../_shared/money.ts';
import { type UserRole, hasPermission } from '../_shared/roles.ts';

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

import { getCorsHeaders } from '../_shared/cors.ts';

// ==================== MAIN FUNCTION ====================
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin')
  
  // Tratar OPTIONS (CORS preflight)
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

    // 2. VERIFICAR PERMISSÃO PARA VENDER (encontrista NÃO pode vender)
    const supabaseForRole = createSupabaseClient();
    
    const { data: appUser } = await supabaseForRole
      .from('app_users')
      .select('role')
      .eq('id', user.id)
      .single();

    const userRole = (appUser?.role as UserRole) || 'encontrista';

    const { userId, items, category, coupon, discountedTotal } = await req.json();

    if (!['lojinha', 'lanchonete'].includes(category)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Categoria de venda inválida'
      }), {
        status: 400,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    const salePermission = category === 'lojinha' ? 'canSellLojinha' : 'canSellLanchonete';
    if (!hasPermission(userRole, salePermission)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Acesso negado: usuário sem permissão para esta categoria de venda'
      }), {
        status: 403,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    // 4. VALIDAÇÕES BÁSICAS
    if (!userId || !items || items.length === 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Dados inválidos: userId, items e category são obrigatórios'
      }), {
        status: 400,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    // 5. CRIAR CLIENTE SUPABASE
    const supabase = createSupabaseClient();

    // 6. BUSCAR CONTA
    const { data: account, error: accountError } = await supabase
      .from('app_users')
      .select('id, balance, name')
      .eq('id', userId)
      .single();

    if (accountError || !account) {
      console.error('Account not found:', accountError);
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

    // 7. VALIDAR PREÇOS DOS PRODUTOS
    const productIds = items.map((item: any) => item.productId);
    const productsQuery = supabase
      .from('products')
      .select('id, name, price, active, stock, category')
      .in('id', productIds)
      .eq('category', category);
    
    const { data: products, error: productsError } = await productsQuery;

    if (productsError || !products) {
      console.error('Products not found:', productsError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao buscar produtos'
      }), {
        status: 500,
        headers: {
          ...getCorsHeaders(origin),
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
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    let finalTotal = calculatedTotal;
    if (coupon && discountedTotal < calculatedTotal) {
      if (category === 'lanchonete') {
        // Cupons da lanchonete têm valor fixo
        const { data: couponData, error: couponError } = await supabase
          .from('lanchonete_coupons')
          .select('name, discount_amount')
          .eq('name', coupon)
          .eq('active', true)
          .maybeSingle();

        if (couponError) {
          console.error('Error fetching lanchonete coupon:', couponError);
          return new Response(JSON.stringify({
            success: false,
            error: `Erro ao validar cupom: ${couponError.message}`
          }), {
            status: 500,
            headers: {
              ...getCorsHeaders(origin),
              'Content-Type': 'application/json'
            }
          });
        }

        if (couponData) {
          const discountAmount = parseFloat(couponData.discount_amount.toString());
          const expectedTotal = calculatedTotal - discountAmount;

          if (Math.abs(discountedTotal - expectedTotal) < 0.01) {
            finalTotal = discountedTotal;
          } else {
            return new Response(JSON.stringify({
              success: false,
              error: `Valor do desconto inválido. Esperado: R$ ${expectedTotal.toFixed(2)}, Recebido: R$ ${discountedTotal.toFixed(2)}`
            }), {
              status: 400,
              headers: {
                ...getCorsHeaders(origin),
                'Content-Type': 'application/json'
              }
            });
          }
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: 'Cupom não encontrado ou inativo'
          }), {
            status: 400,
            headers: {
              ...getCorsHeaders(origin),
              'Content-Type': 'application/json'
            }
          });
        }
      } else {
        // Cupons da lojinha têm desconto fixo de R$ 10,00
        const { data: couponData, error: couponError } = await supabase
          .from('coupons')
          .select('name')
          .eq('name', coupon)
          .maybeSingle();

        if (couponError) {
          console.error('Error fetching lojinha coupon:', couponError);
          return new Response(JSON.stringify({
            success: false,
            error: `Erro ao validar cupom: ${couponError.message}`
          }), {
            status: 500,
            headers: {
              ...getCorsHeaders(origin),
              'Content-Type': 'application/json'
            }
          });
        }

        if (couponData) {
          const discountAmount = 10.00; // Valor fixo para lojinha
          const expectedTotal = calculatedTotal - discountAmount;

          if (Math.abs(discountedTotal - expectedTotal) < 0.01) {
            finalTotal = discountedTotal;
          } else {
            return new Response(JSON.stringify({
              success: false,
              error: `Valor do desconto inválido. Esperado: R$ ${expectedTotal.toFixed(2)}, Recebido: R$ ${discountedTotal.toFixed(2)}`
            }), {
              status: 400,
              headers: {
                ...getCorsHeaders(origin),
                'Content-Type': 'application/json'
              }
            });
          }
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: 'Cupom não encontrado ou inativo'
          }), {
            status: 400,
            headers: {
              ...getCorsHeaders(origin),
              'Content-Type': 'application/json'
            }
          });
        }
      }
    }

    // 7. VALIDAR SALDO (usando operações monetárias seguras)
    const safeBalance = roundMoney(account.balance)
    const safeFinalTotal = roundMoney(finalTotal)

    if (safeFinalTotal <= 0) {
      return new Response(JSON.stringify({
        success: false,
        error: 'O total da venda deve ser maior que zero'
      }), {
        status: 400,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }
    
    if (!hasSufficientBalance(safeBalance, safeFinalTotal)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Saldo insuficiente. Saldo: R$ ${safeBalance.toFixed(2)}, Total: R$ ${safeFinalTotal.toFixed(2)}`
      }), {
        status: 400,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    // 9. CRIAR VENDA
    // sale_number é gerado automaticamente pelo trigger trg_set_sale_number no banco
    const { data: saleData, error: saleError } = await supabase
      .from('sales')
      .insert({
        user_id: userId,
        seller_id: user.id,
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
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    const saleId = saleData.id;

    // 10. CRIAR ITENS DA VENDA
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
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    // 11. DIMINUIR ESTOQUE DOS PRODUTOS (otimizado - busca todos de uma vez)
    const productsWithStock = items
      .map((item: any) => {
        const product = products.find((p: any) => p.id === item.productId);
        return product && product.stock !== null && product.stock !== undefined 
          ? { product, item } 
          : null;
      })
      .filter((p: { product: any; item: any } | null): p is { product: any; item: any } => p !== null);

    const stockUpdates: Array<{ id: string; newStock: number; oldStock: number; name: string }> = [];
    if (productsWithStock.length > 0) {
      // Buscar estoques atuais de todos os produtos de uma vez
      const productIdsToUpdate = productsWithStock.map((p: { product: any; item: any }) => p.product.id);
      const { data: currentProducts, error: fetchError } = await supabase
        .from('products')
        .select('id, stock, name')
        .in('id', productIdsToUpdate);
      
      if (fetchError || !currentProducts) {
        console.error('Error fetching product stocks:', fetchError);
        await supabase.from('sale_items').delete().eq('sale_id', saleId);
        await supabase.from('sales').delete().eq('id', saleId);
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

      // Verificar estoque e preparar updates
      for (const { product, item } of productsWithStock) {
        const currentProduct = currentProducts.find((p: any) => p.id === product.id);
        if (!currentProduct) {
          await supabase.from('sale_items').delete().eq('sale_id', saleId);
          await supabase.from('sales').delete().eq('id', saleId);
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

        // Verificar se ainda tem estoque suficiente
        if (currentProduct.stock < item.quantity) {
          await supabase.from('sale_items').delete().eq('sale_id', saleId);
          await supabase.from('sales').delete().eq('id', saleId);
          return new Response(JSON.stringify({
            success: false,
            error: `Estoque insuficiente para "${currentProduct.name}". Disponível: ${currentProduct.stock}, Solicitado: ${item.quantity}. A venda foi cancelada.`
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

      // Atualizar todos os estoques em paralelo
      const updatePromises = stockUpdates.map(({ id, newStock, oldStock, name }) =>
        supabase
          .from('products')
          .update({ stock: newStock })
          .eq('id', id)
          .eq('stock', oldStock) // Optimistic locking
          .then(({ error }) => ({ id, name, error }))
      );

      const updateResults = await Promise.all(updatePromises);
      const failedUpdates = updateResults.filter(r => r.error);

      if (failedUpdates.length > 0) {
        console.error('Stock update errors:', failedUpdates);
        await supabase.from('sale_items').delete().eq('sale_id', saleId);
        await supabase.from('sales').delete().eq('id', saleId);
        return new Response(JSON.stringify({
          success: false,
          error: `Erro ao atualizar estoque de: ${failedUpdates.map(u => u.name).join(', ')}. A venda foi cancelada.`
        }), {
          status: 500,
          headers: {
            ...getCorsHeaders(origin),
            'Content-Type': 'application/json'
          }
        });
      }
    }

    // 12. DEBITAR A CONTA E REGISTRAR A TRANSAÇÃO ATOMICAMENTE
    const { error: balanceError } = await supabase.rpc('adjust_account_balance', {
      p_user_id: userId,
      p_amount: safeFinalTotal,
      p_type: 'debit',
      p_description: `Venda ${category} - ${items.length} itens`,
      p_created_by: user.id,
    });

    if (balanceError) {
      console.error('Balance update error:', balanceError);
      for (const stockUpdate of stockUpdates) {
        const { error: restoreError } = await supabase
          .from('products')
          .update({ stock: stockUpdate.oldStock })
          .eq('id', stockUpdate.id)
          .eq('stock', stockUpdate.newStock);
        if (restoreError) {
          console.error('Failed to restore product stock after debit failure:', {
            productId: stockUpdate.id,
            error: restoreError.message,
          });
        }
      }
      await supabase.from('sale_items').delete().eq('sale_id', saleId);
      await supabase.from('sales').delete().eq('id', saleId);
      return new Response(JSON.stringify({
        success: false,
        error: balanceError.message.includes('INSUFFICIENT_BALANCE')
          ? `Saldo insuficiente. Saldo: R$ ${safeBalance.toFixed(2)}, Total: R$ ${safeFinalTotal.toFixed(2)}`
          : 'Erro ao atualizar saldo da conta'
      }), {
        status: 500,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

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
          user_id: userId,
          customer_name: account.name || 'Cliente',
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

    // 15. SUCESSO
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
        ...getCorsHeaders(origin),
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('Unexpected error:', error);
    const errorMessage = error instanceof Error 
      ? `${error.message}${error.stack ? `\nStack: ${error.stack}` : ''}`
      : String(error);
    
    return new Response(JSON.stringify({
      success: false,
      error: `Erro interno: ${errorMessage}`
    }), {
      status: 500,
      headers: {
        ...getCorsHeaders(origin),
        'Content-Type': 'application/json'
      }
    });
  }
});
