/**
 * Edge Function: manage-food-trucks
 *
 * Cadastro dos food trucks parceiros e dos seus cardápios (somente admin,
 * permissão canManageFoodTrucks).
 *
 * Body JSON com `entity`:
 *   POST   { entity: 'truck', name, description?, logoUrl?, sortOrder?, active? }
 *   PUT    { entity: 'truck', id, ...campos a alterar }
 *   DELETE { entity: 'truck', id }                 (apaga os itens em cascata)
 *   POST   { entity: 'item', foodTruckId, section?, name, description?, price, imageUrl?, sortOrder? }
 *   PUT    { entity: 'item', id, ...campos a alterar }
 *   DELETE { entity: 'item', id }
 *   POST   { entity: 'upload', kind: 'logo' | 'item', contentType }
 *          -> { path, token } para o front enviar a imagem com uploadToSignedUrl
 *
 * As imagens ficam no bucket público 'food-trucks'. Só são aceitas URLs desse
 * bucket, e o arquivo antigo é removido quando a imagem é trocada ou o
 * registro é apagado.
 */

import { createSupabaseClient } from '../_shared/supabase.ts'
import { requireAuth, getUserRole } from '../_shared/auth.ts'
import { hasPermission } from '../_shared/roles.ts'
import { roundMoney } from '../_shared/money.ts'
import type { ApiResponse } from '../_shared/types.ts'
import { getCorsHeaders } from '../_shared/cors.ts'

const BUCKET = 'food-trucks'
const PUBLIC_MARKER = `/storage/v1/object/public/${BUCKET}/`
const IMAGE_PATH_RE = /^(logo|item)\/[0-9a-f-]{36}\.(jpg|png|webp)$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

const LIMITS = { name: 80, description: 300, section: 40 }
const MAX_PRICE = 10000

class ValidationError extends Error {}

type Body = Record<string, unknown>

/** Texto obrigatório: string não vazia após trim, até `max` caracteres. */
function requiredText(value: unknown, field: string, max: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${field} é obrigatório`)
  }
  const text = value.trim()
  if (text.length > max) throw new ValidationError(`${field} deve ter no máximo ${max} caracteres`)
  return text
}

/** Texto opcional: vazio vira null. */
function optionalText(value: unknown, field: string, max: number): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new ValidationError(`${field} inválido`)
  const text = value.trim()
  if (!text) return null
  if (text.length > max) throw new ValidationError(`${field} deve ter no máximo ${max} caracteres`)
  return text
}

function sortOrder(value: unknown): number {
  const n = Number(value ?? 0)
  if (!Number.isInteger(n) || n < -10000 || n > 10000) throw new ValidationError('Ordem inválida')
  return n
}

function price(value: unknown): number {
  const n = typeof value === 'string' ? Number(value.replace(',', '.')) : Number(value)
  if (!Number.isFinite(n) || n <= 0) throw new ValidationError('Preço deve ser maior que zero')
  if (n > MAX_PRICE) throw new ValidationError('Preço muito alto')
  return roundMoney(n)
}

/** Extrai o caminho no bucket de uma URL pública; null se não for do bucket. */
function storagePath(url: string | null | undefined): string | null {
  if (!url) return null
  const idx = url.indexOf(PUBLIC_MARKER)
  if (idx === -1) return null
  let path: string
  try {
    path = decodeURIComponent(url.slice(idx + PUBLIC_MARKER.length).split('?')[0])
  } catch {
    return null // %xx malformado: trata como URL inválida (400), não erro interno
  }
  return IMAGE_PATH_RE.test(path) ? path : null
}

/** URL de imagem opcional: precisa ser do bucket food-trucks. */
function imageUrl(value: unknown, field: string): string | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'string' || !storagePath(value)) {
    throw new ValidationError(`${field} inválida: envie a imagem pelo formulário`)
  }
  return value
}

function uuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    throw new ValidationError(`${field} inválido`)
  }
  return value
}

const has = (body: Body, key: string) => Object.prototype.hasOwnProperty.call(body, key)

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

    const role = await getUserRole(authResult.id)
    if (!hasPermission(role, 'canManageFoodTrucks')) {
      return json({ success: false, error: 'Acesso negado: apenas administradores gerenciam os food trucks' }, 403)
    }

    if (!['POST', 'PUT', 'DELETE'].includes(req.method)) {
      return json({ success: false, error: 'Método não permitido' }, 405)
    }

    let body: Body
    try {
      body = await req.json()
    } catch {
      return json({ success: false, error: 'JSON inválido' }, 400)
    }
    if (!body || typeof body !== 'object') {
      return json({ success: false, error: 'JSON inválido' }, 400)
    }

    const supabase = createSupabaseClient()

    /** Remove arquivos do bucket sem quebrar a operação principal. */
    const removeImages = async (urls: Array<string | null | undefined>) => {
      const paths = urls.map(storagePath).filter((p): p is string => !!p)
      if (!paths.length) return
      const { error } = await supabase.storage.from(BUCKET).remove(paths)
      if (error) console.error('[manage-food-trucks] Falha ao remover imagens:', error.message)
    }

    const entity = body.entity

    // -----------------------------------------------------------------------
    // Upload: URL assinada para o front enviar a imagem
    // -----------------------------------------------------------------------
    if (entity === 'upload') {
      if (req.method !== 'POST') return json({ success: false, error: 'Método não permitido' }, 405)
      const kind = body.kind
      if (kind !== 'logo' && kind !== 'item') throw new ValidationError('Tipo de imagem inválido')
      const ext = CONTENT_TYPES[String(body.contentType || '')]
      if (!ext) throw new ValidationError('Formato de imagem não suportado (use JPG, PNG ou WEBP)')

      const path = `${kind}/${crypto.randomUUID()}.${ext}`
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path)
      if (error || !data) {
        console.error('[manage-food-trucks] Erro ao gerar URL de upload:', error?.message)
        return json({ success: false, error: 'Erro ao preparar o envio da imagem' }, 500)
      }
      return json({ success: true, data: { bucket: BUCKET, path: data.path, token: data.token } })
    }

    // -----------------------------------------------------------------------
    // Food truck
    // -----------------------------------------------------------------------
    if (entity === 'truck') {
      if (req.method === 'POST') {
        const row = {
          name: requiredText(body.name, 'Nome', LIMITS.name),
          description: optionalText(body.description, 'Descrição', LIMITS.description),
          logo_url: imageUrl(body.logoUrl, 'Logo'),
          sort_order: sortOrder(body.sortOrder),
          active: body.active === undefined ? true : body.active === true,
        }
        const { data, error } = await supabase.from('food_trucks').insert(row).select().single()
        if (error) {
          console.error('[manage-food-trucks] Erro ao criar food truck:', error.message)
          return json({ success: false, error: 'Erro ao criar food truck' }, 500)
        }
        return json({ success: true, data }, 201)
      }

      const id = uuid(body.id, 'Food truck')
      const { data: existing, error: fetchError } = await supabase
        .from('food_trucks')
        .select('id, logo_url')
        .eq('id', id)
        .maybeSingle()
      if (fetchError) {
        console.error('[manage-food-trucks] Erro ao buscar food truck:', fetchError.message)
        return json({ success: false, error: 'Erro ao buscar food truck' }, 500)
      }
      if (!existing) return json({ success: false, error: 'Food truck não encontrado' }, 404)

      if (req.method === 'PUT') {
        const patch: Record<string, unknown> = {}
        if (has(body, 'name')) patch.name = requiredText(body.name, 'Nome', LIMITS.name)
        if (has(body, 'description')) patch.description = optionalText(body.description, 'Descrição', LIMITS.description)
        if (has(body, 'logoUrl')) patch.logo_url = imageUrl(body.logoUrl, 'Logo')
        if (has(body, 'sortOrder')) patch.sort_order = sortOrder(body.sortOrder)
        if (has(body, 'active')) {
          if (typeof body.active !== 'boolean') throw new ValidationError('Ativo inválido')
          patch.active = body.active
        }
        if (!Object.keys(patch).length) throw new ValidationError('Nada para atualizar')

        const { data, error } = await supabase.from('food_trucks').update(patch).eq('id', id).select().single()
        if (error) {
          console.error('[manage-food-trucks] Erro ao atualizar food truck:', error.message)
          return json({ success: false, error: 'Erro ao atualizar food truck' }, 500)
        }
        if (has(patch, 'logo_url') && existing.logo_url && existing.logo_url !== patch.logo_url) {
          await removeImages([existing.logo_url])
        }
        return json({ success: true, data })
      }

      // DELETE
      const { data: items } = await supabase
        .from('food_truck_menu_items')
        .select('image_url')
        .eq('food_truck_id', id)
      const { error } = await supabase.from('food_trucks').delete().eq('id', id)
      if (error) {
        console.error('[manage-food-trucks] Erro ao excluir food truck:', error.message)
        return json({ success: false, error: 'Erro ao excluir food truck' }, 500)
      }
      await removeImages([existing.logo_url, ...(items || []).map((i) => i.image_url)])
      return json({ success: true, data: { id } })
    }

    // -----------------------------------------------------------------------
    // Item do cardápio
    // -----------------------------------------------------------------------
    if (entity === 'item') {
      if (req.method === 'POST') {
        const foodTruckId = uuid(body.foodTruckId, 'Food truck')
        const { data: truck, error: truckError } = await supabase
          .from('food_trucks')
          .select('id')
          .eq('id', foodTruckId)
          .maybeSingle()
        if (truckError) {
          console.error('[manage-food-trucks] Erro ao buscar food truck:', truckError.message)
          return json({ success: false, error: 'Erro ao buscar food truck' }, 500)
        }
        if (!truck) return json({ success: false, error: 'Food truck não encontrado' }, 404)

        const row = {
          food_truck_id: foodTruckId,
          section: optionalText(body.section, 'Seção', LIMITS.section) || 'Cardápio',
          name: requiredText(body.name, 'Nome', LIMITS.name),
          description: optionalText(body.description, 'Descrição', LIMITS.description),
          price: price(body.price),
          image_url: imageUrl(body.imageUrl, 'Foto'),
          sort_order: sortOrder(body.sortOrder),
        }
        const { data, error } = await supabase.from('food_truck_menu_items').insert(row).select().single()
        if (error) {
          console.error('[manage-food-trucks] Erro ao criar item:', error.message)
          return json({ success: false, error: 'Erro ao criar item do cardápio' }, 500)
        }
        return json({ success: true, data }, 201)
      }

      const id = uuid(body.id, 'Item')
      const { data: existing, error: fetchError } = await supabase
        .from('food_truck_menu_items')
        .select('id, image_url')
        .eq('id', id)
        .maybeSingle()
      if (fetchError) {
        console.error('[manage-food-trucks] Erro ao buscar item:', fetchError.message)
        return json({ success: false, error: 'Erro ao buscar item do cardápio' }, 500)
      }
      if (!existing) return json({ success: false, error: 'Item não encontrado' }, 404)

      if (req.method === 'PUT') {
        const patch: Record<string, unknown> = {}
        if (has(body, 'section')) patch.section = optionalText(body.section, 'Seção', LIMITS.section) || 'Cardápio'
        if (has(body, 'name')) patch.name = requiredText(body.name, 'Nome', LIMITS.name)
        if (has(body, 'description')) patch.description = optionalText(body.description, 'Descrição', LIMITS.description)
        if (has(body, 'price')) patch.price = price(body.price)
        if (has(body, 'imageUrl')) patch.image_url = imageUrl(body.imageUrl, 'Foto')
        if (has(body, 'sortOrder')) patch.sort_order = sortOrder(body.sortOrder)
        if (!Object.keys(patch).length) throw new ValidationError('Nada para atualizar')

        const { data, error } = await supabase
          .from('food_truck_menu_items')
          .update(patch)
          .eq('id', id)
          .select()
          .single()
        if (error) {
          console.error('[manage-food-trucks] Erro ao atualizar item:', error.message)
          return json({ success: false, error: 'Erro ao atualizar item do cardápio' }, 500)
        }
        if (has(patch, 'image_url') && existing.image_url && existing.image_url !== patch.image_url) {
          await removeImages([existing.image_url])
        }
        return json({ success: true, data })
      }

      // DELETE
      const { error } = await supabase.from('food_truck_menu_items').delete().eq('id', id)
      if (error) {
        console.error('[manage-food-trucks] Erro ao excluir item:', error.message)
        return json({ success: false, error: 'Erro ao excluir item do cardápio' }, 500)
      }
      await removeImages([existing.image_url])
      return json({ success: true, data: { id } })
    }

    return json({ success: false, error: "entity deve ser 'truck', 'item' ou 'upload'" }, 400)
  } catch (error) {
    if (error instanceof ValidationError) {
      return json({ success: false, error: error.message }, 400)
    }
    console.error('[manage-food-trucks] Erro inesperado:', error)
    return json({ success: false, error: 'Erro interno do servidor' }, 500)
  }
})
