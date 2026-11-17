/**
 * Upload das imagens dos food trucks (logo e fotos dos itens).
 *
 * O arquivo nunca é enviado com a chave anônima direto para o bucket: a Edge
 * Function manage-food-trucks confere se o usuário é admin e devolve um token
 * de upload assinado, válido só para um caminho. O bucket não tem policy de
 * escrita para anon/authenticated.
 */

import { createClient } from '@supabase/supabase-js'
import { api } from '../lib/api-client'

export const FOOD_TRUCK_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const FOOD_TRUCK_IMAGE_MAX_BYTES = 5 * 1024 * 1024

/** Retorna a mensagem de erro, ou null se o arquivo puder ser enviado. */
export function validateFoodTruckImage(file: File): string | null {
  if (!FOOD_TRUCK_IMAGE_TYPES.includes(file.type)) {
    return 'Use uma imagem JPG, PNG ou WEBP.'
  }
  if (file.size > FOOD_TRUCK_IMAGE_MAX_BYTES) {
    return 'A imagem deve ter no máximo 5MB.'
  }
  return null
}

let storageClient: ReturnType<typeof createClient> | null = null

function getStorageClient() {
  if (storageClient) return storageClient
  const supabaseUrl = import.meta.env.DEV
    ? (import.meta.env.VITE_SUPABASE_LOCAL_URL || import.meta.env.VITE_SUPABASE_URL)
    : import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase não configurado')
  }
  storageClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return storageClient
}

/** Envia a imagem e retorna a URL pública para salvar no food truck/item. */
export async function uploadFoodTruckImage(file: File, kind: 'logo' | 'item'): Promise<string> {
  const invalid = validateFoodTruckImage(file)
  if (invalid) throw new Error(invalid)

  const signed = await api.getFoodTruckUploadUrl(kind, file.type)
  if (!signed.success || !signed.data) {
    throw new Error(signed.error || 'Erro ao preparar o envio da imagem')
  }

  const { bucket, path, token } = signed.data
  const storage = getStorageClient().storage.from(bucket)
  const { error } = await storage.uploadToSignedUrl(path, token, file, { contentType: file.type })
  if (error) {
    throw new Error('Erro ao enviar a imagem. Tente novamente.')
  }

  return storage.getPublicUrl(path).data.publicUrl
}
