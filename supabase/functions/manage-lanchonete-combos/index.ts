import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth, getUserRole } from '../_shared/auth.ts'
import { hasPermission } from '../_shared/roles.ts'
import { getCorsHeaders } from '../_shared/cors.ts'
import { isUuid, jsonResponse } from '../_shared/lanchonete-orders.ts'

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')

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

    const role = await getUserRole(authResult.id)
    if (!hasPermission(role, 'canManageProductsLanchonete')) {
      return jsonResponse(origin, { success: false, error: 'Acesso negado' }, 403)
    }

    if (req.method !== 'POST') {
      return jsonResponse(origin, { success: false, error: 'Método não permitido' }, 405)
    }

    let input: unknown
    try {
      input = await req.json()
    } catch {
      return jsonResponse(origin, { success: false, error: 'JSON inválido' }, 400)
    }

    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      return jsonResponse(origin, { success: false, error: 'Dados inválidos para criar o combo' }, 400)
    }

    const body = input as Record<string, unknown>
    if (
      typeof body.name !== 'string'
      || !body.name.trim()
      || body.name.trim().length > 120
      || typeof body.price !== 'number'
      || !Number.isFinite(body.price)
      || body.price <= 0
      || body.price >= 100000000
      || !Array.isArray(body.components)
      || body.components.some((component) => {
        if (typeof component !== 'object' || component === null) return true
        const value = component as Record<string, unknown>
        return !isUuid(value.productId)
          || !Number.isInteger(value.quantity)
          || Number(value.quantity) < 1
          || Number(value.quantity) > 10
      })
    ) {
      return jsonResponse(origin, { success: false, error: 'Dados inválidos para criar o combo' }, 400)
    }

    const supabase = createSupabaseClient()
    const { data, error } = await supabase.rpc('create_lanchonete_combo', {
      p_name: body.name.trim(),
      p_price: body.price,
      p_components: body.components,
    }).single()

    if (error) {
      if (error.message === 'COMBO_COMPONENT_UNAVAILABLE') {
        return jsonResponse(origin, {
          success: false,
          error: 'Selecione apenas itens ativos da lanchonete que não sejam outros combos.',
        }, 400)
      }
      if (error.message === 'INVALID_COMBO' || error.message === 'INVALID_COMBO_COMPONENTS' || error.message === 'DUPLICATE_COMBO_COMPONENT') {
        return jsonResponse(origin, { success: false, error: 'Nome, valor ou composição do combo inválidos.' }, 400)
      }
      console.error('Error creating lanchonete combo:', error.message)
      return jsonResponse(origin, { success: false, error: 'Erro ao criar combo' }, 500)
    }

    return jsonResponse(origin, { success: true, data }, 201)
  } catch (error) {
    console.error('Error in manage-lanchonete-combos:', error)
    return jsonResponse(origin, { success: false, error: 'Erro interno do servidor' }, 500)
  }
})
