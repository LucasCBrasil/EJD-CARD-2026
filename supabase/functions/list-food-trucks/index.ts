/**
 * Edge Function: list-food-trucks
 *
 * Lista os food trucks parceiros com os itens do cardápio.
 * Somente leitura: a compra é feita direto no food truck, não pelo site.
 *
 * - Qualquer usuário autenticado vê os food trucks ativos.
 * - ?includeInactive=true retorna também os ocultos (só canManageFoodTrucks).
 */

import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth, getUserRole } from '../_shared/auth.ts'
import { hasPermission } from '../_shared/roles.ts'
import type { ApiResponse } from '../_shared/types.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

interface FoodTruckRow {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  sort_order: number
  active: boolean
  items: Array<{
    id: string
    section: string
    name: string
    description: string | null
    price: number | string
    image_url: string | null
    sort_order: number
  }> | null
}

const byOrderThenName = (a: { sort_order: number; name: string }, b: { sort_order: number; name: string }) =>
  a.sort_order - b.sort_order || a.name.localeCompare(b.name, 'pt-BR')

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')
  const json = (body: ApiResponse, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
    })

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(origin) })
  }

  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof Response) {
      return new Response(authResult.body, {
        status: authResult.status,
        headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' },
      })
    }

    if (req.method !== 'GET') {
      return json({ success: false, error: 'Método não permitido' }, 405)
    }

    const includeInactive = new URL(req.url).searchParams.get('includeInactive') === 'true'
    if (includeInactive) {
      const role = await getUserRole(authResult.id)
      if (!hasPermission(role, 'canManageFoodTrucks')) {
        return json({ success: false, error: 'Acesso negado' }, 403)
      }
    }

    const supabase = createSupabaseClient()
    let query = supabase
      .from('food_trucks')
      .select(
        'id, name, description, logo_url, sort_order, active, ' +
          'items:food_truck_menu_items(id, section, name, description, price, image_url, sort_order)'
      )

    if (!includeInactive) {
      query = query.eq('active', true)
    }

    const { data, error } = await query
    if (error) {
      console.error('[list-food-trucks] Erro ao buscar food trucks:', error.message)
      return json({ success: false, error: 'Erro ao buscar food trucks' }, 500)
    }

    const trucks = ((data || []) as unknown as FoodTruckRow[])
      .sort(byOrderThenName)
      .map((truck) => ({
        id: truck.id,
        name: truck.name,
        description: truck.description,
        logoUrl: truck.logo_url,
        sortOrder: truck.sort_order,
        active: truck.active,
        items: (truck.items || []).sort(byOrderThenName).map((item) => ({
          id: item.id,
          section: item.section,
          name: item.name,
          description: item.description,
          price: Number(item.price),
          imageUrl: item.image_url,
          sortOrder: item.sort_order,
        })),
      }))

    return json({ success: true, data: trucks })
  } catch (error) {
    console.error('[list-food-trucks] Erro inesperado:', error)
    return json({ success: false, error: 'Erro interno do servidor' }, 500)
  }
})
