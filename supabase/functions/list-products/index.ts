/**
 * Edge Function: list-products
 * 
 * Lista produtos de forma segura com autenticação obrigatória
 * 
 * Este código roda NA NUVEM, inacessível via DevTools!
 */

import { createSupabaseClient } from '../_shared/supabase.ts'
import { getUserRole, requireAuth } from '../_shared/auth.ts'
import { sanitizeProductForRole } from '../_shared/lojinha-catalog.ts'
import type { ApiResponse } from '../_shared/types.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) })
  }

  try {
    // 1. VALIDAR AUTENTICAÇÃO OBRIGATÓRIA
    const authResult = await requireAuth(req)
    if (authResult instanceof Response) {
      return new Response(authResult.body, {
        status: authResult.status,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      })
    }

    // 2. VALIDAR MÉTODO
    if (req.method !== 'GET') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Método não permitido'
        } as ApiResponse),
        {
          status: 405,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    const supabase = createSupabaseClient()
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
      console.error('Error listing products:', error.message)
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro ao buscar produtos'
        } as ApiResponse),
        {
          status: 500,
          headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
        }
      )
    }

    const combos = (products || []).filter((product) => product.is_combo)
    if (combos.length > 0) {
      const { data: comboItems, error: comboItemsError } = await supabase
        .from('product_combo_items')
        .select('combo_id, component_product_id, quantity')
        .in('combo_id', combos.map((combo) => combo.id))

      if (comboItemsError) {
        console.error('Error listing combo components:', {
          code: comboItemsError.code,
          message: comboItemsError.message,
          details: comboItemsError.details,
          hint: comboItemsError.hint,
        })
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao buscar composição dos combos' } as ApiResponse),
          { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
        )
      }

      const componentIds = [...new Set((comboItems || []).map((item) => item.component_product_id))]
      const { data: components, error: componentsError } = componentIds.length > 0
        ? await supabase.from('products').select('id, name, stock, active').in('id', componentIds)
        : { data: [], error: null }

      if (componentsError) {
        console.error('Error listing combo inventory:', componentsError.message)
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao buscar estoque dos combos' } as ApiResponse),
          { status: 500, headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' } }
        )
      }

      const componentById = new Map((components || []).map((component) => [component.id, component]))
      const itemsByCombo = new Map<string, typeof comboItems>()
      for (const item of comboItems || []) {
        const items = itemsByCombo.get(item.combo_id) || []
        items.push(item)
        itemsByCombo.set(item.combo_id, items)
      }

      for (const combo of combos) {
        const items = itemsByCombo.get(combo.id) || []
        const availability = items.map((item) => {
          const component = componentById.get(item.component_product_id)
          if (!component || !component.active) return 0
          return component.stock === null ? null : Math.floor(component.stock / item.quantity)
        })
        combo.stock = availability.length === 0
          ? 0
          : availability.includes(0)
            ? 0
            : availability.every((stock) => stock === null)
              ? null
              : Math.min(...availability.filter((stock): stock is number => stock !== null))
        combo.combo_items = items.map((item) => ({
          product_id: item.component_product_id,
          name: componentById.get(item.component_product_id)?.name || 'Item indisponível',
          quantity: item.quantity,
        }))
      }
    }

    const userRole = await getUserRole(authResult.id)
    const sanitizedProducts = (products || []).map((product) =>
      sanitizeProductForRole(product, userRole),
    )

    return new Response(
      JSON.stringify({
        success: true,
        data: sanitizedProducts
      } as ApiResponse),
      {
        status: 200,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('Error in list-products:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Erro interno do servidor'
      } as ApiResponse),
      {
        status: 500,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
      }
    )
  }
})
