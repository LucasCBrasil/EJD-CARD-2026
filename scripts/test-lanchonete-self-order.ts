/**
 * Teste ponta a ponta do pedido de autoatendimento da Lanchonete
 * (Edge Functions + RPCs) contra o Supabase LOCAL.
 *
 * Pré-requisitos:
 *   supabase start                  (banco com supabase-setup.sql + migrations)
 *   supabase functions serve
 *
 * Uso (as chaves vêm de `supabase status -o env`, nunca de produção):
 *   API_URL=http://127.0.0.1:54321 ANON_KEY=... SERVICE_ROLE_KEY=... \
 *     npx tsx scripts/test-lanchonete-self-order.ts
 *
 * Cria usuários e produtos de teste e liga a flag lanchonete_self_order.
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
const FUNCTIONS_URL = `${API_URL}/functions/v1`
const RUN = Date.now()
const PASSWORD = `Teste-${randomUUID()}`

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

const createUser = async (label: string, balance: number, role = 'encontrista') => {
  const email = `${label}-${RUN}@teste.local`
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: `Teste ${label}` },
  })
  if (error || !data.user) throw new Error(`createUser ${label}: ${error?.message}`)

  const { error: updateError } = await admin.from('app_users').update({ balance, role }).eq('id', data.user.id)
  if (updateError) throw new Error(`update app_users ${label}: ${updateError.message}`)

  const client = createClient(API_URL, ANON_KEY, { auth: { persistSession: false } })
  const { data: session, error: signInError } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (signInError || !session.session) throw new Error(`signIn ${label}: ${signInError?.message}`)

  return { id: data.user.id, token: session.session.access_token }
}

const createProduct = async (name: string, price: number, stock: number | null) => {
  const { data, error } = await admin
    .from('products')
    .insert({ name: `${name} ${RUN}`, price, category: 'lanchonete', stock, active: true })
    .select('id')
    .single()
  if (error) throw new Error(`createProduct ${name}: ${error.message}`)
  return data.id as string
}

const balanceOf = async (userId: string) => {
  const { data } = await admin.from('app_users').select('balance').eq('id', userId).single()
  return Number(data?.balance)
}

const stockOf = async (productId: string) => {
  const { data } = await admin.from('products').select('stock').eq('id', productId).single()
  return data?.stock as number | null
}

const setFlag = async (enabled: boolean) => {
  const { error } = await admin.from('feature_flags').update({ enabled }).eq('key', 'lanchonete_self_order')
  if (error) throw new Error(`setFlag: ${error.message}`)
}

const order = (token: string | null, items: unknown, requestId: string = randomUUID(), extra: object = {}) =>
  call('create-self-order', token, { body: { items, requestId, ...extra } })

const main = async () => {
  console.log('🍔 Teste ponta a ponta: autoatendimento da Lanchonete (Supabase local)\n')

  const coxinha = await createProduct('Coxinha', 5, 50)
  const refri = await createProduct('Refri', 4.5, null)
  const bolo = await createProduct('Bolo', 6, 1)

  const buyer = await createUser('buyer', 50)
  const poor = await createUser('poor', 5)
  const victim = await createUser('victim', 30)
  const racer = await createUser('racer', 5)
  const idem = await createUser('idem', 50)
  const stockA = await createUser('stocka', 20)
  const stockB = await createUser('stockb', 20)
  const staff = await createUser('staff', 0, 'lanchonete')
  const lojinhaStaff = await createUser('lojinha', 0, 'lojinha')

  console.log('Usuário não logado / flag')
  await setFlag(false)
  const noToken = await order(null, [{ productId: coxinha, quantity: 1 }])
  check(noToken.status === 401, 'sem token → 401', noToken)
  const badToken = await call('create-self-order', 'token-invalido', { body: { items: [], requestId: randomUUID() } })
  check(badToken.status === 401, 'token inválido → 401', badToken)
  const disabled = await order(buyer.token, [{ productId: coxinha, quantity: 1 }])
  check(disabled.status === 423 && disabled.body.code === 'SELF_ORDER_DISABLED', 'flag desligada → 423', disabled)
  await setFlag(true)

  console.log('\nCarrinho vazio e quantidades inválidas')
  const empty = await order(buyer.token, [])
  check(empty.status === 400 && empty.body.code === 'EMPTY_CART', 'carrinho vazio → 400 EMPTY_CART', empty)
  const zero = await order(buyer.token, [{ productId: coxinha, quantity: 0 }])
  check(zero.status === 400 && zero.body.code === 'INVALID_QUANTITY', 'quantidade 0 → 400', zero)
  const tooMany = await order(buyer.token, [{ productId: coxinha, quantity: 11 }])
  check(tooMany.status === 400 && tooMany.body.code === 'INVALID_QUANTITY', '11 unidades → 400', tooMany)
  const noRequestId = await call('create-self-order', buyer.token, { body: { items: [{ productId: coxinha, quantity: 1 }] } })
  check(noRequestId.status === 400, 'sem requestId → 400', noRequestId)

  console.log('\nSaldo suficiente')
  const ok = await order(buyer.token, [
    { productId: coxinha, quantity: 2, price: 0.01, productName: 'hack' },
    { productId: refri, quantity: 1 },
  ])
  check(ok.status === 201 && ok.body.success, 'pedido criado → 201', ok)
  check(ok.body.data?.total === 14.5, 'total calculado no servidor (preço do body ignorado)', ok.body.data)
  check(ok.body.data?.newBalance === 35.5 && (await balanceOf(buyer.id)) === 35.5, 'saldo debitado: 50 → 35,50')
  check((await stockOf(coxinha)) === 48, 'estoque baixado')
  const firstOrderId = ok.body.data?.saleId as string

  console.log('\nSaldo insuficiente')
  const poorStock = await stockOf(coxinha)
  const insufficient = await order(poor.token, [{ productId: coxinha, quantity: 2 }])
  check(insufficient.status === 400 && insufficient.body.code === 'INSUFFICIENT_BALANCE', 'saldo insuficiente → 400', insufficient)
  check((await balanceOf(poor.id)) === 5, 'saldo continua 5,00')
  check((await stockOf(coxinha)) === poorStock, 'estoque não mudou')
  const { count: poorSales } = await admin.from('sales').select('id', { count: 'exact', head: true }).eq('user_id', poor.id)
  check(poorSales === 0, 'nenhuma venda criada')

  console.log('\nItem removido do cardápio durante o pedido')
  const temp = await createProduct('Pastel', 7, null)
  await admin.from('products').update({ active: false }).eq('id', temp)
  const removed = await order(buyer.token, [{ productId: coxinha, quantity: 1 }, { productId: temp, quantity: 1 }])
  check(removed.status === 409 && removed.body.code === 'PRODUCT_UNAVAILABLE', 'produto desativado → 409', removed)
  check(removed.body.details?.productId === temp, 'details identifica o produto removido', removed.body.details)
  check((await balanceOf(buyer.id)) === 35.5, 'nada debitado')

  console.log('\nUsuário tentando debitar o saldo de outro')
  const spoof = await order(buyer.token, [{ productId: refri, quantity: 1 }], randomUUID(), { userId: victim.id })
  check(spoof.status === 201, 'pedido aceito, mas para o próprio usuário', spoof)
  check((await balanceOf(victim.id)) === 30, 'saldo da vítima intacto (30,00)')
  check((await balanceOf(buyer.id)) === 31, 'debitado do próprio usuário (35,50 → 31,00)')
  const spoofOrderId = spoof.body.data?.saleId as string

  const victimView = await call('my-lanchonete-orders', victim.token)
  check(victimView.status === 200 && victimView.body.data.length === 0, 'vítima não vê pedidos de outra pessoa', victimView.body)
  const crossCancel = await call('my-lanchonete-orders', victim.token, { body: { saleId: spoofOrderId, action: 'cancel' } })
  check(crossCancel.status === 404, 'não cancela pedido de outra pessoa → 404', crossCancel)

  console.log('\nPermissões da fila')
  const queueAsUser = await call('lanchonete-orders', buyer.token)
  check(queueAsUser.status === 403, 'encontrista não lê a fila → 403', queueAsUser)
  const advanceAsUser = await call('lanchonete-orders', buyer.token, { body: { saleId: firstOrderId, status: 'preparing' } })
  check(advanceAsUser.status === 403, 'encontrista não muda status → 403', advanceAsUser)
  const queueNoToken = await call('lanchonete-orders', null)
  check(queueNoToken.status === 401, 'fila sem token → 401', queueNoToken)

  console.log('\nFila da equipe e acompanhamento')
  const queue = await call('lanchonete-orders', staff.token)
  const queued = queue.body.data?.find((o: any) => o.id === firstOrderId)
  check(queue.status === 200 && !!queued, 'pedido aparece na fila', queue.body)
  check(queued?.customerName === 'Teste buyer' && queued?.items?.length === 2, 'fila mostra nome e itens', queued)
  const skip = await call('lanchonete-orders', staff.token, { body: { saleId: firstOrderId, status: 'delivered' } })
  check(skip.status === 409 && skip.body.code === 'INVALID_STATUS_TRANSITION', 'não pula etapas → 409', skip)
  for (const status of ['preparing', 'ready']) {
    const step = await call('lanchonete-orders', staff.token, { body: { saleId: firstOrderId, status } })
    check(step.status === 200 && step.body.data?.status === status, `equipe avança para ${status}`, step)
  }
  const mine = await call('my-lanchonete-orders', buyer.token)
  check(mine.body.data?.find((o: any) => o.id === firstOrderId)?.status === 'ready', 'usuário vê o pedido como pronto')
  const lateCancel = await call('my-lanchonete-orders', buyer.token, { body: { saleId: firstOrderId, action: 'cancel' } })
  check(lateCancel.status === 409, 'usuário não cancela pedido pronto → 409', lateCancel)
  const delivered = await call('lanchonete-orders', staff.token, { body: { saleId: firstOrderId, status: 'delivered' } })
  check(delivered.status === 200 && delivered.body.data?.status === 'delivered', 'equipe marca entregue', delivered)

  console.log('\nCancelamento com estorno')
  const cancel = await call('my-lanchonete-orders', buyer.token, { body: { saleId: spoofOrderId, action: 'cancel' } })
  check(cancel.status === 200 && cancel.body.data?.refundedAmount === 4.5, 'usuário cancela pedido pendente', cancel)
  check((await balanceOf(buyer.id)) === 35.5, 'saldo estornado (31,00 → 35,50)')
  const cancelAgain = await call('lanchonete-orders', staff.token, { body: { saleId: spoofOrderId, action: 'cancel' } })
  check(cancelAgain.status === 409, 'estorno duplo bloqueado → 409', cancelAgain)

  console.log('\nRegressão: venda de balcão e mark-sale-delivered')
  const counter = await call('make-sale', staff.token, {
    body: {
      userId: victim.id,
      category: 'lanchonete',
      items: [{ productId: coxinha, productName: `Coxinha ${RUN}`, quantity: 1, price: 5 }],
    },
  })
  check(counter.status === 200 && counter.body.success, 'make-sale (balcão) continua funcionando', counter)
  check((await balanceOf(victim.id)) === 25, 'balcão debitou a conta escolhida pela equipe')
  const markSelfOrder = await call('mark-sale-delivered', lojinhaStaff.token, { body: { saleId: spoofOrderId } })
  check(markSelfOrder.status === 404, 'mark-sale-delivered não altera pedido do app (cancelado)', markSelfOrder)
  const { data: spoofSale } = await admin.from('sales').select('status').eq('id', spoofOrderId).single()
  check(spoofSale?.status === 'cancelled', 'pedido cancelado continua cancelado')

  console.log('\nConcorrência: 10 pedidos simultâneos, saldo para 1')
  const race = await Promise.all(
    Array.from({ length: 10 }, () => order(racer.token, [{ productId: coxinha, quantity: 1 }])),
  )
  const raceOk = race.filter((r) => r.status === 201)
  check(raceOk.length === 1, 'exatamente 1 pedido aprovado', race.map((r) => r.body.code || r.status))
  check(race.filter((r) => r.status !== 201).every((r) => r.body.code === 'INSUFFICIENT_BALANCE'), 'demais recusados por saldo')
  check((await balanceOf(racer.id)) === 0, 'saldo final 0,00 (nunca negativo)')

  console.log('\nConcorrência: mesmo requestId 5x (duplo toque/retry)')
  const sameId = randomUUID()
  const dup = await Promise.all(Array.from({ length: 5 }, () => order(idem.token, [{ productId: refri, quantity: 1 }], sameId)))
  const dupIds = new Set(dup.map((r) => r.body.data?.saleId))
  check(dup.every((r) => r.body.success) && dupIds.size === 1, 'todas respondem o mesmo pedido', dup.map((r) => r.status))
  check((await balanceOf(idem.id)) === 45.5, 'debitado uma única vez')

  console.log('\nConcorrência: último item em estoque disputado por 2 usuários')
  const contest = await Promise.all([
    order(stockA.token, [{ productId: bolo, quantity: 1 }]),
    order(stockB.token, [{ productId: bolo, quantity: 1 }]),
  ])
  check(contest.filter((r) => r.status === 201).length === 1, 'só um leva o último bolo', contest.map((r) => r.body.code || r.status))
  check(contest.some((r) => r.body.code === 'OUT_OF_STOCK'), 'o outro recebe OUT_OF_STOCK')
  check((await stockOf(bolo)) === 0, 'estoque final 0')
  check((await balanceOf(stockA.id)) + (await balanceOf(stockB.id)) === 34, 'só um saldo debitado')

  console.log('\nLimite de pedidos em aberto')
  for (let i = 0; i < 2; i++) await order(idem.token, [{ productId: refri, quantity: 1 }])
  const fourth = await order(idem.token, [{ productId: refri, quantity: 1 }])
  check(fourth.status === 409 && fourth.body.code === 'TOO_MANY_OPEN_ORDERS', '4º pedido em aberto → 409', fourth)

  await setFlag(false)

  console.log(`\n${failed === 0 ? '🎉' : '⚠️'}  ${passed} passaram, ${failed} falharam`)
  process.exit(failed === 0 ? 0 : 1)
}

main().catch(async (error) => {
  console.error('❌ Erro inesperado:', error)
  await setFlag(false).catch(() => {})
  process.exit(1)
})
