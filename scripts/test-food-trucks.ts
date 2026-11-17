/**
 * Teste ponta a ponta dos cardápios dos food trucks
 * (Edge Functions list-food-trucks e manage-food-trucks + Storage) contra o
 * Supabase LOCAL.
 *
 * Pré-requisitos:
 *   supabase start                  (banco com supabase-setup.sql + migrations)
 *   supabase functions serve
 *
 * Uso (as chaves vêm de `supabase status -o env`, nunca de produção):
 *   API_URL=http://127.0.0.1:54321 ANON_KEY=... SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/test-food-trucks.ts
 *
 * Cria usuários, food trucks e imagens de teste e apaga os food trucks no fim.
 * Por isso só roda contra localhost.
 */

import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const API_URL = process.env.API_URL || ''
const ANON_KEY = process.env.ANON_KEY || ''
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY || ''

if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(API_URL)) {
  console.error('❌ API_URL precisa ser o Supabase local (localhost/127.0.0.1). Abortando.')
  process.exit(1)
}
if (!ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('❌ Defina ANON_KEY e SERVICE_ROLE_KEY do Supabase local.')
  process.exit(1)
}

const admin = createClient(API_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const anon = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } })
const FUNCTIONS_URL = `${API_URL}/functions/v1`
const RUN = Date.now()
const PASSWORD = `Teste-${randomUUID()}`
const createdTruckIds: string[] = []

let passed = 0
let failed = 0

const check = (condition: boolean, description: string, extra?: unknown) => {
  if (condition) {
    passed++
    console.log(`  ✅ ${description}`)
  } else {
    failed++
    console.log(`  ❌ ${description}`, extra === undefined ? '' : JSON.stringify(extra))
  }
}

interface CallResult {
  status: number
  body: any
}

const call = async (
  fn: string,
  token: string | null,
  options: { method?: string; body?: unknown; query?: string } = {},
): Promise<CallResult> => {
  const response = await fetch(`${FUNCTIONS_URL}/${fn}${options.query ? `?${options.query}` : ''}`, {
    method: options.method || (options.body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const text = await response.text()
  let body: any
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  return { status: response.status, body }
}

const createUser = async (label: string, role: string) => {
  const email = `ft-${label}-${RUN}@teste.local`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: `Teste ${label}` },
  })
  if (error || !data.user) throw new Error(`createUser ${label}: ${error?.message}`)

  const { error: updateError } = await admin.from('app_users').update({ role }).eq('id', data.user.id)
  if (updateError) throw new Error(`update app_users ${label}: ${updateError.message}`)

  const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } })
  const { data: session, error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (signInError || !session.session) throw new Error(`signIn ${label}: ${signInError?.message}`)

  return { id: data.user.id, token: session.session.access_token }
}

const manage = (token: string | null, method: string, body: unknown) =>
  call('manage-food-trucks', token, { method, body })

const list = (token: string | null, includeInactive = false) =>
  call('list-food-trucks', token, { query: includeInactive ? 'includeInactive=true' : undefined })

const truckIn = (res: CallResult, id: string) =>
  (res.body?.data || []).find((t: { id: string }) => t.id === id)

// PNG 1x1 transparente
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
)

/** Faz o fluxo do front: pede URL assinada, envia e devolve a URL pública. */
const uploadImage = async (token: string, kind: 'logo' | 'item') => {
  const signed = await manage(token, 'POST', { entity: 'upload', kind, contentType: 'image/png' })
  if (!signed.body?.success) throw new Error(`upload-url: ${JSON.stringify(signed.body)}`)
  const { bucket, path, token: uploadToken } = signed.body.data
  const storage = anon.storage.from(bucket)
  const { error } = await storage.uploadToSignedUrl(path, uploadToken, PNG_1X1, { contentType: 'image/png' })
  if (error) throw new Error(`uploadToSignedUrl: ${error.message}`)
  return { path: path as string, url: storage.getPublicUrl(path).data.publicUrl }
}

const fileExists = async (path: string) => {
  const [folder, name] = path.split('/')
  const { data } = await admin.storage.from('food-trucks').list(folder, { search: name })
  return (data || []).some((f) => f.name === name)
}

const main = async () => {
  console.log('🚚 Teste ponta a ponta: cardápios dos food trucks (Supabase local)\n')

  const adminUser = await createUser('admin', 'admin')
  const encontrista = await createUser('encontrista', 'encontrista')
  const comunicacao = await createUser('comunicacao', 'comunicacao')

  console.log('Autenticação e permissões')
  check((await list(null)).status === 401, 'listar sem login → 401')
  check((await list(encontrista.token, true)).status === 403, 'encontrista não pode pedir os ocultos → 403')
  check(
    (await manage(encontrista.token, 'POST', { entity: 'truck', name: 'Invasor' })).status === 403,
    'encontrista não cria food truck → 403',
  )
  check(
    (await manage(comunicacao.token, 'POST', { entity: 'truck', name: 'Invasor' })).status === 403,
    'comunicação não cria food truck → 403',
  )
  check(
    (await manage(encontrista.token, 'POST', { entity: 'upload', kind: 'logo', contentType: 'image/png' })).status === 403,
    'encontrista não pede URL de upload → 403',
  )

  console.log('\nTabelas bloqueadas para acesso direto')
  const direct = await anon.from('food_trucks').insert({ name: 'Direto' })
  check(!!direct.error, 'anon não insere direto na tabela', direct.error?.message)
  const directStorage = await anon.storage.from('food-trucks').upload(`logo/${randomUUID()}.png`, PNG_1X1, { contentType: 'image/png' })
  check(!!directStorage.error, 'anon não envia direto para o bucket', directStorage.error?.message)

  console.log('\nCadastro pelo admin')
  const logo = await uploadImage(adminUser.token, 'logo')
  check(await fileExists(logo.path), 'logo enviada para o bucket pela URL assinada')
  const created = await manage(adminUser.token, 'POST', {
    entity: 'truck',
    name: `  Burguer do Trem ${RUN}  `,
    description: 'Hambúrguer artesanal',
    logoUrl: logo.url,
    sortOrder: 1,
  })
  check(created.status === 201, 'admin cria food truck → 201', created.body)
  const truckId = created.body.data?.id as string
  createdTruckIds.push(truckId)
  check(created.body.data?.name === `Burguer do Trem ${RUN}`, 'nome salvo sem espaços nas pontas')

  const photo = await uploadImage(adminUser.token, 'item')
  const item = await manage(adminUser.token, 'POST', {
    entity: 'item',
    foodTruckId: truckId,
    section: 'Lanches',
    name: 'X-Salada',
    price: 25.999,
    imageUrl: photo.url,
  })
  check(item.status === 201, 'admin cria item → 201', item.body)
  check(Number(item.body.data?.price) === 26, 'preço arredondado para 2 casas', item.body.data?.price)
  const itemId = item.body.data?.id as string

  const noSection = await manage(adminUser.token, 'POST', { entity: 'item', foodTruckId: truckId, name: 'Água', price: 4 })
  check(noSection.body.data?.section === 'Cardápio', 'seção vazia vira "Cardápio"', noSection.body.data)

  console.log('\nValidações')
  const zero = await manage(adminUser.token, 'POST', { entity: 'item', foodTruckId: truckId, name: 'Grátis', price: 0 })
  check(zero.status === 400, 'preço 0 → 400', zero.body)
  const negative = await manage(adminUser.token, 'POST', { entity: 'item', foodTruckId: truckId, name: 'Negativo', price: -5 })
  check(negative.status === 400, 'preço negativo → 400', negative.body)
  const noName = await manage(adminUser.token, 'POST', { entity: 'truck', name: '   ' })
  check(noName.status === 400, 'nome em branco → 400', noName.body)
  const foreignImage = await manage(adminUser.token, 'PUT', { entity: 'truck', id: truckId, logoUrl: 'https://exemplo.com/logo.png' })
  check(foreignImage.status === 400, 'imagem fora do bucket → 400', foreignImage.body)
  const badType = await manage(adminUser.token, 'POST', { entity: 'upload', kind: 'logo', contentType: 'image/svg+xml' })
  check(badType.status === 400, 'URL de upload só para JPG/PNG/WEBP → 400', badType.body)
  const missingTruck = await manage(adminUser.token, 'POST', { entity: 'item', foodTruckId: randomUUID(), name: 'Órfão', price: 5 })
  check(missingTruck.status === 404, 'item em food truck inexistente → 404', missingTruck.body)

  console.log('\nVisualização')
  const visible = truckIn(await list(encontrista.token), truckId)
  check(!!visible, 'encontrista vê o food truck ativo')
  check(visible?.items?.length === 2 && visible.items.some((i: any) => i.name === 'X-Salada' && i.price === 26), 'com os itens e preços', visible)
  check(visible?.logoUrl === logo.url, 'com a logo')

  console.log('\nOcultar / mostrar')
  const hide = await manage(adminUser.token, 'PUT', { entity: 'truck', id: truckId, active: false })
  check(hide.status === 200 && hide.body.data?.active === false, 'admin oculta o food truck', hide.body)
  check(!truckIn(await list(encontrista.token), truckId), 'oculto some para o encontrista')
  check(!!truckIn(await list(adminUser.token, true), truckId), 'admin ainda vê o oculto com includeInactive')
  await manage(adminUser.token, 'PUT', { entity: 'truck', id: truckId, active: true })

  console.log('\nTroca de imagem remove a antiga')
  const newPhoto = await uploadImage(adminUser.token, 'item')
  const swap = await manage(adminUser.token, 'PUT', { entity: 'item', id: itemId, imageUrl: newPhoto.url })
  check(swap.status === 200, 'admin troca a foto do item', swap.body)
  check(!(await fileExists(photo.path)), 'foto antiga removida do bucket')

  console.log('\nExclusão em cascata')
  const del = await manage(adminUser.token, 'DELETE', { entity: 'truck', id: truckId })
  check(del.status === 200, 'admin exclui o food truck', del.body)
  createdTruckIds.splice(createdTruckIds.indexOf(truckId), 1)
  const { count } = await admin
    .from('food_truck_menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('food_truck_id', truckId)
  check(count === 0, 'itens apagados em cascata', count)
  check(!(await fileExists(logo.path)) && !(await fileExists(newPhoto.path)), 'logo e fotos removidas do bucket')

  console.log(`\n${failed === 0 ? '🎉' : '⚠️'}  ${passed} passaram, ${failed} falharam`)
  process.exitCode = failed === 0 ? 0 : 1
}

main()
  .catch((error) => {
    console.error('❌ Erro inesperado:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    if (createdTruckIds.length) {
      await admin.from('food_trucks').delete().in('id', createdTruckIds)
    }
  })
