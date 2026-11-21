import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
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
      persistSession: false,
    },
  });
};

const jsonResponse = (body: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });

const mapBagError = (message: string): string => {
  if (message.includes('OUT_OF_STOCK')) {
    return 'Estoque geral insuficiente para um ou mais produtos selecionados.';
  }
  if (message.includes('INSUFFICIENT_BAG_STOCK')) {
    return 'Quantidade insuficiente na bag para realizar a devolução.';
  }
  if (message.includes('PRODUCT_UNAVAILABLE')) {
    return 'Um ou mais produtos estão inativos ou indisponíveis.';
  }
  if (message.includes('EMPTY_CART') || message.includes('INVALID_ITEM') || message.includes('INVALID_REQUEST')) {
    return 'Selecione ao menos um produto com quantidade válida.';
  }
  return message;
};

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin), status: 200 });
  }

  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) {
      return new Response(authResult.body, {
        status: authResult.status,
        headers: {
          ...getCorsHeaders(origin),
          'Content-Type': 'application/json',
        },
      });
    }
    const user = authResult;
    const supabase = createSupabaseClient();

    const { data: appUser } = await supabase
      .from('app_users')
      .select('role')
      .eq('id', user.id)
      .single();

    const userRole = (appUser?.role as UserRole) || 'encontrista';
    const canSell = hasPermission(userRole, 'canSellLanchonete');
    const canManage = hasPermission(userRole, 'canManageProductsLanchonete');

    if (!canSell && !canManage) {
      return jsonResponse(
        { success: false, error: 'Acesso negado: usuário sem permissão para vendas da lanchonete' },
        403,
        origin
      );
    }

    const url = new URL(req.url);
    const view = url.searchParams.get('view');

    // GET ?view=all: Visão da coordenação com todas as bags ativas agrupadas por ambulante
    if (req.method === 'GET' && view === 'all') {
      if (!canManage) {
        return jsonResponse(
          { success: false, error: 'Acesso negado: apenas coordenação pode visualizar todas as bags' },
          403,
          origin
        );
      }

      const { data: allRows, error: allError } = await supabase
        .from('lanchonete_ambulante_bags')
        .select(`
          user_id,
          product_id,
          quantity,
          updated_at,
          app_users:user_id (
            id,
            name,
            email
          ),
          products:product_id (
            id,
            name,
            price,
            stock
          )
        `)
        .gt('quantity', 0);

      if (allError) {
        console.error('Erro ao listar todas as bags:', allError);
        return jsonResponse({ success: false, error: 'Erro ao carregar bags dos ambulantes' }, 500, origin);
      }

      const grouped = new Map<string, any>();

      for (const row of allRows || []) {
        if (!row.products) continue;
        const sellerId = row.user_id;
        const sellerInfo = Array.isArray(row.app_users) ? row.app_users[0] : row.app_users;

        if (!grouped.has(sellerId)) {
          grouped.set(sellerId, {
            sellerId,
            sellerName: sellerInfo?.name || 'Sem nome',
            sellerEmail: sellerInfo?.email || '',
            totalUnits: 0,
            totalValue: 0,
            lastUpdatedAt: row.updated_at,
            items: [],
          });
        }

        const entry = grouped.get(sellerId);
        const unitPrice = Number(row.products.price || 0);
        entry.totalUnits += row.quantity;
        entry.totalValue += unitPrice * row.quantity;
        if (row.updated_at && (!entry.lastUpdatedAt || row.updated_at > entry.lastUpdatedAt)) {
          entry.lastUpdatedAt = row.updated_at;
        }

        entry.items.push({
          productId: row.product_id,
          productName: row.products.name,
          price: unitPrice,
          quantity: row.quantity,
          generalStock: row.products.stock,
        });
      }

      const sellers = Array.from(grouped.values())
        .map((s) => ({
          ...s,
          items: s.items.sort((a: any, b: any) => a.productName.localeCompare(b.productName, 'pt-BR')),
        }))
        .sort((a, b) => a.sellerName.localeCompare(b.sellerName, 'pt-BR'));

      return jsonResponse({ success: true, data: sellers }, 200, origin);
    }

    // GET padrão: Retornar itens atuais da bag do vendedor logado
    if (req.method === 'GET') {
      const { data: bagRows, error: bagError } = await supabase
        .from('lanchonete_ambulante_bags')
        .select(`
          product_id,
          quantity,
          updated_at,
          products (
            id,
            name,
            price,
            category,
            description,
            stock,
            active
          )
        `)
        .eq('user_id', user.id)
        .gt('quantity', 0);

      if (bagError) {
        console.error('Erro ao buscar bag do ambulante:', bagError);
        return jsonResponse({ success: false, error: 'Erro ao buscar itens da bag' }, 500, origin);
      }

      const items = (bagRows || [])
        .filter((row: any) => row.products)
        .map((row: any) => ({
          productId: row.product_id,
          quantity: row.quantity,
          updatedAt: row.updated_at,
          product: {
            id: row.products.id,
            name: row.products.name,
            price: Number(row.products.price),
            category: row.products.category,
            description: row.products.description,
            generalStock: row.products.stock,
            stock: row.quantity,
            active: row.products.active,
          },
        }))
        .sort((a: any, b: any) => a.product.name.localeCompare(b.product.name, 'pt-BR'));

      return jsonResponse({ success: true, data: items }, 200, origin);
    }

    // POST: Retirar ('take') ou devolver ('return') itens
    if (req.method === 'POST') {
      const body = await req.json();
      const { action, items, targetUserId } = body;

      if (!['take', 'return'].includes(action)) {
        return jsonResponse({ success: false, error: 'Ação inválida. Use "take" ou "return".' }, 400, origin);
      }

      if (!Array.isArray(items) || items.length === 0) {
        return jsonResponse({ success: false, error: 'Informe ao menos um item.' }, 400, origin);
      }

      // Se targetUserId for informado e diferente do usuário logado, exige permissão de coordenação
      const sellerId = targetUserId && typeof targetUserId === 'string' ? targetUserId : user.id;
      if (sellerId !== user.id && !canManage) {
        return jsonResponse(
          { success: false, error: 'Acesso negado: apenas coordenação pode movimentar a bag de outro vendedor.' },
          403,
          origin
        );
      }

      const rpcName = action === 'take' ? 'take_to_ambulante_bag' : 'return_from_ambulante_bag';
      const { error: rpcError } = await supabase.rpc(rpcName, {
        p_seller_id: sellerId,
        p_items: items,
      });

      if (rpcError) {
        console.error(`Erro ao executar ${rpcName}:`, rpcError);
        return jsonResponse({ success: false, error: mapBagError(rpcError.message) }, 400, origin);
      }

      return jsonResponse(
        {
          success: true,
          message:
            action === 'take'
              ? 'Itens adicionados à bag com sucesso!'
              : 'Itens devolvidos ao estoque geral com sucesso!',
        },
        200,
        origin
      );
    }

    return jsonResponse({ success: false, error: 'Método não permitido' }, 405, origin);
  } catch (error) {
    console.error('Erro inesperado em ambulante-bag:', error);
    return jsonResponse(
      { success: false, error: error instanceof Error ? error.message : 'Erro interno' },
      500,
      origin
    );
  }
});