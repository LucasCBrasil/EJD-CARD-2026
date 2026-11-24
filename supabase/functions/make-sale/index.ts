import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { type UserRole, hasPermission } from '../_shared/roles.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

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

// ==================== MAIN FUNCTION ====================
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');

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

    const { userId, items, category, coupon, cartId, cartVersion } = await req.json();

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
    if (!userId || (category === 'lojinha'
      ? typeof cartId !== 'string' || !Number.isInteger(cartVersion) || cartVersion < 0
      : !Array.isArray(items) || items.length === 0)) {
      return new Response(JSON.stringify({
        success: false,
        error: category === 'lojinha'
          ? 'Dados inválidos: userId, cartId, cartVersion e category são obrigatórios'
          : 'Dados inválidos: userId, items e category são obrigatórios'
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

    const { data: securityFlag, error: securityFlagError } = await supabase
      .from('feature_flags').select('enabled').eq('key', 'require_security_code').maybeSingle();
    if (securityFlagError) throw securityFlagError;
    if (securityFlag?.enabled !== false) {
    const { data: authorization, error: authorizationError } = await supabase
      .from('sale_security_authorizations').select('authorized_until')
      .eq('seller_id', user.id).eq('customer_id', userId)
      .gt('authorized_until', new Date().toISOString()).maybeSingle();
    if (authorizationError || !authorization) {
      return new Response(JSON.stringify({ success: false, error: 'Código de segurança necessário ou expirado. Selecione o cliente novamente.' }), {
        status: 403, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      });
    }
    }

    // O estoque da lojinha já foi reservado ao adicionar os itens no carrinho.
    // O RPC conclui venda, débito, pedido e carrinho na mesma transação.
    if (category === 'lojinha') {
      const { data: checkoutData, error: checkoutError } = await supabase.rpc('checkout_lojinha_cart', {
        p_cart_id: cartId,
        p_user_id: userId,
        p_seller_id: user.id,
        p_expected_version: cartVersion,
        p_coupon: coupon || null,
      });

      if (checkoutError) {
        const message = checkoutError.message.includes('INSUFFICIENT_BALANCE')
          ? 'Saldo insuficiente para finalizar a venda.'
          : checkoutError.message.includes('EMPTY_CART')
            ? 'O carrinho está vazio.'
            : checkoutError.message.includes('CART_NOT_OPEN')
              ? 'Este carrinho não está mais aberto.'
              : checkoutError.message.includes('CART_CHANGED')
                ? 'O carrinho foi alterado por outro vendedor. Revise os itens e confirme novamente.'
                : checkoutError.message.includes('COUPON_MINIMUM_NOT_MET')
                  ? 'O total mínimo de R$ 150,00 não foi atingido para este cupom.'
                  : checkoutError.message.includes('COUPON_NOT_FOUND')
                    ? 'Cupom não encontrado ou inativo.'
                    : checkoutError.message;

        return new Response(JSON.stringify({
          success: false,
          error: message,
        }), {
          status: 400,
          headers: {
            ...getCorsHeaders(origin),
            'Content-Type': 'application/json'
          }
        });
      }

      const checkout = Array.isArray(checkoutData) ? checkoutData[0] : null;
      if (!checkout?.sale_id) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Não foi possível concluir o carrinho.'
        }), {
          status: 500,
          headers: {
            ...getCorsHeaders(origin),
            'Content-Type': 'application/json'
          }
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          saleId: checkout.sale_id,
          total: checkout.total,
          alreadyCompleted: checkout.already_completed,
          message: 'Venda realizada com sucesso!'
        }
      }), {
        status: 200,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json'
        }
      });
    }

    // 6. LANCHONETE: VENDA AMBULANTE (deduz da bag do vendedor logado)
    const { data: ambulanteData, error: ambulanteError } = await supabase.rpc('make_ambulante_sale', {
      p_user_id: userId,
      p_seller_id: user.id,
      p_items: items.map((item: any) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      p_coupon: coupon || null,
    });

    if (ambulanteError) {
      const message = ambulanteError.message.includes('INSUFFICIENT_BALANCE')
        ? 'Saldo insuficiente para finalizar a venda.'
        : ambulanteError.message.includes('INSUFFICIENT_BAG_STOCK')
          ? 'Estoque insuficiente na sua bag para um ou mais produtos.'
          : ambulanteError.message.includes('PRODUCT_UNAVAILABLE')
            ? 'Um ou mais produtos estão inativos ou indisponíveis.'
            : ambulanteError.message.includes('COUPON_NOT_FOUND')
              ? 'Cupom não encontrado ou inativo.'
              : ambulanteError.message.includes('EMPTY_CART')
                ? 'O carrinho está vazio.'
                : ambulanteError.message;

      return new Response(JSON.stringify({
        success: false,
        error: message,
      }), {
        status: 400,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json',
        },
      });
    }

    const saleResult = Array.isArray(ambulanteData) ? ambulanteData[0] : null;
    if (!saleResult?.sale_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Não foi possível concluir a venda ambulante.',
      }), {
        status: 500,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        saleId: saleResult.sale_id,
        saleNumber: saleResult.sale_number,
        total: saleResult.total,
        message: 'Venda ambulante realizada com sucesso!',
      },
    }), {
      status: 200,
      headers: {
        ...getCorsHeaders(origin),
        'Content-Type': 'application/json',
      },
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
