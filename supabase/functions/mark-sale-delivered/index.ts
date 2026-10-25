import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { requireAuth, getUserRole } from '../_shared/auth.ts';
import { hasPermission } from '../_shared/roles.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import type { ApiResponse } from '../_shared/types.ts';

// --- Supabase client com service role ---
const createSupabaseClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !supabaseServiceKey) throw new Error('Missing env vars');
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
};

// --- Função principal ---
Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  
  // ✅ Pré-flight OPTIONS
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(origin) });
  }

  try {
    // 1. VALIDAR AUTENTICAÇÃO
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) {
      return new Response(authResult.body, {
        status: authResult.status,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      });
    }

    // 2. VERIFICAR PERMISSÃO PARA MARCAR COMO ENTREGUE
    const userRole = await getUserRole(authResult.id);
    if (!hasPermission(userRole, 'canMarkAsDelivered')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Acesso negado: você não tem permissão para marcar vendas como entregues'
        } as ApiResponse),
        {
          status: 403,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      );
    }

    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Método não permitido'
        } as ApiResponse),
        {
          status: 405,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createSupabaseClient();

    // 3. EXTRAIR DADOS
    const { saleId } = await req.json();
    if (!saleId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'saleId obrigatório'
        } as ApiResponse),
        {
          status: 400,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      );
    }

    // 4. ATUALIZAR VENDA
    const { data, error } = await supabase
      .from('sales')
      .update({ status: 'delivered', delivered_at: new Date().toISOString() })
      .eq('id', saleId)
      // Pedidos do autoatendimento seguem o fluxo próprio (lanchonete-orders)
      .eq('origin', 'balcao')
      .select()
      .single();

    if (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: error.message || 'Venda não encontrada'
        } as ApiResponse),
        {
          status: 404,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data
      } as ApiResponse),
      {
        status: 200,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in mark-sale-delivered:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      } as ApiResponse),
      {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    );
  }
});
