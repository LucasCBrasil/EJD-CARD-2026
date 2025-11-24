/**
 * Edge Function: manage-products
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
import type { ApiResponse } from '../_shared/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. VALIDAR AUTENTICAÇÃO
    const authResult = await requireAuth(req)
    if (authResult instanceof Response) {
      return authResult
    }

    // 2. VALIDAR PERMISSÕES DE ADMIN (exceto para GET)
    if (req.method !== 'GET') {
      const userIsAdmin = await isAdmin(req)
      if (!userIsAdmin) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Acesso negado: apenas administradores podem gerenciar produtos'
          } as ApiResponse),
          {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }
    }

    const supabase = createSupabaseClient()

    // 3. ROTEAMENTO POR MÉTODO HTTP
    switch (req.method) {
      case 'GET': {
        // LISTAR PRODUTOS (público)
        const url = new URL(req.url)
        const category = url.searchParams.get('category') as 'lojinha' | 'lanchonete' | null

        let query = supabase
          .from('products')
          .select('*')
          .eq('active', true)
          .order('created_at', { ascending: false })

        if (category) {
          query = query.eq('category', category)
        }

        const { data: products, error } = await query

        if (error) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Erro ao buscar produtos: ${error.message}`
            } as ApiResponse),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: products
          } as ApiResponse),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      case 'POST': {
        // CRIAR PRODUTO (admin only)
        const {
          name,
          price,
          category,
          description,
          stock
        }: {
          name: string
          price: number
          category: 'lojinha' | 'lanchonete'
          description?: string
          stock?: number
        } = await req.json()

        // Validações
        if (!name || price === undefined || !category) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Dados inválidos: name, price e category são obrigatórios'
            } as ApiResponse),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        if (price <= 0) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Preço deve ser maior que zero'
            } as ApiResponse),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        // Criar produto
        const { data: product, error } = await supabase
          .from('products')
          .insert({
            name,
            price,
            category,
            description,
            stock,
            active: true
          })
          .select()
          .single()

        if (error) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Erro ao criar produto: ${error.message}`
            } as ApiResponse),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: product,
            message: 'Produto criado com sucesso!'
          } as ApiResponse),
          {
            status: 201,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      case 'PUT': {
        // ATUALIZAR PRODUTO (admin only)
        const {
          id,
          name,
          price,
          description,
          stock,
          active
        } = await req.json()

        if (!id) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'ID do produto é obrigatório'
            } as ApiResponse),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        // Montar objeto de atualização (apenas campos fornecidos)
        const updates: any = {
          updated_at: new Date().toISOString()
        }
        if (name !== undefined) updates.name = name
        if (price !== undefined) {
          if (price <= 0) {
            return new Response(
              JSON.stringify({
                success: false,
                error: 'Preço deve ser maior que zero'
              } as ApiResponse),
              {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              }
            )
          }
          updates.price = price
        }
        if (description !== undefined) updates.description = description
        if (stock !== undefined) updates.stock = stock
        if (active !== undefined) updates.active = active

        const { data: product, error } = await supabase
          .from('products')
          .update(updates)
          .eq('id', id)
          .select()
          .single()

        if (error) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Erro ao atualizar produto: ${error.message}`
            } as ApiResponse),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            data: product,
            message: 'Produto atualizado com sucesso!'
          } as ApiResponse),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      case 'DELETE': {
        // DELETAR/DESATIVAR PRODUTO (admin only)
        const url = new URL(req.url)
        const id = url.searchParams.get('id')

        if (!id) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'ID do produto é obrigatório'
            } as ApiResponse),
            {
              status: 400,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        // Soft delete: marcar como inativo
        const { error } = await supabase
          .from('products')
          .update({
            active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', id)

        if (error) {
          return new Response(
            JSON.stringify({
              success: false,
              error: `Erro ao deletar produto: ${error.message}`
            } as ApiResponse),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
        }

        return new Response(
          JSON.stringify({
            success: true,
            message: 'Produto deletado com sucesso!'
          } as ApiResponse),
          {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
      }

      default:
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Método não suportado'
          } as ApiResponse),
          {
            status: 405,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        )
    }

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

