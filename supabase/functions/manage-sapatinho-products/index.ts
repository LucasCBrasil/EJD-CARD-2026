/**
 * Edge Function: manage-sapatinho-products
 * 
 * Gerencia produtos de forma segura (CRUD):
 * - Criar produto (admin only)
 * - Atualizar produto (admin only)
 * - Deletar produto / Desativar (admin only)
 * - Listar produtos (público)
 * 
 * Este código roda NA NUVEM, inacessível via DevTools!
 */

import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth, isAdmin } from '../_shared/auth.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
// ==================== CORS ====================
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS, DELETE'
};
// ==================== FUNÇÃO ====================
Deno.serve(async (req)=>{
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: getCorsHeaders(origin)
    });
  }
  try {
    // 1. VALIDAR AUTENTICAÇÃO
    const authResult = await requireAuth(req);
    if (authResult instanceof Response) {
      return authResult;
    }
    // 2. VALIDAR PERMISSÕES DE ADMIN (exceto para GET)
    if (req.method !== 'GET') {
      const userIsAdmin = await isAdmin(req);
      if (!userIsAdmin) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Acesso negado: apenas administradores podem gerenciar produtos'
        }), {
          status: 403,
          headers: {
            ...getCorsHeaders(origin),
            'Content-Type': 'application/json'
          }
        });
      }
    }
    const supabase = createSupabaseClient();
    // 3. ROTEAMENTO POR MÉTODO HTTP
    switch(req.method){
      case 'GET':
        {
          // LISTAR PRODUTOS (público)
          const url = new URL(req.url);
          let query = supabase.from('sapatinho_products').select('*').eq('active', true).order('created_at', {
            ascending: false
          });
          const { data: products, error } = await query;
          if (error) {
            return new Response(JSON.stringify({
              success: false,
              error: `Erro ao buscar produtos: ${error.message}`
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
            data: products
          }), {
            status: 200,
            headers: {
              ...getCorsHeaders(origin),
              'Content-Type': 'application/json'
            }
          });
        }
      case 'POST':
        {
          // CRIAR PRODUTO (admin only)
          const { name, price, description, stock } = await req.json();
          // Validações
          if (!name || price === undefined) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Dados inválidos: name, price e category são obrigatórios'
            }), {
              status: 400,
              headers: {
                ...getCorsHeaders(origin),
                'Content-Type': 'application/json'
              }
            });
          }
          if (price <= 0) {
            return new Response(JSON.stringify({
              success: false,
              error: 'Preço deve ser maior que zero'
            }), {
              status: 400,
              headers: {
                ...getCorsHeaders(origin),
                'Content-Type': 'application/json'
              }
            });
          }
          // Criar produto
          const { data: product, error } = await supabase.from('sapatinho_products').insert({
            name,
            price,
            description,
            stock,
            active: true
          }).select().single();
          if (error) {
            return new Response(JSON.stringify({
              success: false,
              error: `Erro ao criar produto: ${error.message}`
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
            data: product,
            message: 'Produto criado com sucesso!'
          }), {
            status: 201,
            headers: {
              ...getCorsHeaders(origin),
              'Content-Type': 'application/json'
            }
          });
        }
      case 'PUT':
        {
          // ATUALIZAR PRODUTO (admin only)
          const { id, name, price, description, stock, active } = await req.json();
          if (!id) {
            return new Response(JSON.stringify({
              success: false,
              error: 'ID do produto é obrigatório'
            }), {
              status: 400,
              headers: {
                ...getCorsHeaders(origin),
                'Content-Type': 'application/json'
              }
            });
          }
          // Montar objeto de atualização (apenas campos fornecidos)
          const updates = {
            updated_at: new Date().toISOString()
          };
          if (name !== undefined) updates.name = name;
          if (price !== undefined) {
            if (price <= 0) {
              return new Response(JSON.stringify({
                success: false,
                error: 'Preço deve ser maior que zero'
              }), {
                status: 400,
                headers: {
                  ...getCorsHeaders(origin),
                  'Content-Type': 'application/json'
                }
              });
            }
            updates.price = price;
          }
          if (description !== undefined) updates.description = description;
          if (stock !== undefined) updates.stock = stock;
          if (active !== undefined) updates.active = active;
          const { data: product, error } = await supabase.from('sapatinho_products').update(updates).eq('id', id).select().single();
          if (error) {
            return new Response(JSON.stringify({
              success: false,
              error: `Erro ao atualizar produto: ${error.message}`
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
            data: product,
            message: 'Produto atualizado com sucesso!'
          }), {
            status: 200,
            headers: {
              ...getCorsHeaders(origin),
              'Content-Type': 'application/json'
            }
          });
        }
      case 'DELETE':
        {
          // DELETAR/DESATIVAR PRODUTO (admin only)
          const url = new URL(req.url);
          const id = url.searchParams.get('id');
          if (!id) {
            return new Response(JSON.stringify({
              success: false,
              error: 'ID do produto é obrigatório'
            }), {
              status: 400,
              headers: {
                ...getCorsHeaders(origin),
                'Content-Type': 'application/json'
              }
            });
          }
          // Soft delete: marcar como inativo
          const { error } = await supabase.from('sapatinho_products').update({
            active: false,
            updated_at: new Date().toISOString()
          }).eq('id', id);
          if (error) {
            return new Response(JSON.stringify({
              success: false,
              error: `Erro ao deletar produto: ${error.message}`
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
            message: 'Produto deletado com sucesso!'
          }), {
            status: 200,
            headers: {
              ...getCorsHeaders(origin),
              'Content-Type': 'application/json'
            }
          });
        }
      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Método não suportado'
        }), {
          status: 405,
          headers: {
            ...getCorsHeaders(origin),
            'Content-Type': 'application/json'
          }
        });
    }
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
