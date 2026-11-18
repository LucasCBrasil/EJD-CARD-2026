import { validatePayment } from './mercadopago-validation.ts'
import { pixPricing } from './pix-pricing.ts'

const local = { id: 'recarga-1', external_id: '123', user_id: 'usuario-1', amount: '25.50' }
const remote = { id: 123, external_reference: 'recarga-1', payment_method_id: 'pix', currency_id: 'BRL', transaction_amount: 25.5, metadata: { user_id: 'usuario-1' } }

Deno.test('aceita Pix com valor, referência e usuário correspondentes', () => validatePayment(remote, local))
for (const [name, change] of Object.entries({
  'valor menor': { transaction_amount: 25.49 },
  'valor maior': { transaction_amount: 100 },
  'valor inválido': { transaction_amount: 'NaN' },
  'outra moeda': { currency_id: 'USD' },
  'outro método': { payment_method_id: 'visa' },
  'outro pagamento': { id: 456 },
  'outra recarga': { external_reference: 'recarga-2' },
  'outro usuário': { metadata: { user_id: 'usuario-2' } },
  'sem usuário': { metadata: undefined },
})) {
  Deno.test(`rejeita ${name} antes de creditar saldo`, () => {
    let rejected = false
    try { validatePayment({ ...remote, ...change }, local) } catch { rejected = true }
    if (!rejected) throw new Error('Pagamento incompatível foi aceito')
  })
}

for (const [amount, fee, total] of [[0.01, 0, 0.01], [0.49, 0, 0.49], [0.5, 0.01, 0.51], [1, 0.01, 1.01], [1.49, 0.01, 1.5], [1.5, 0.02, 1.52], [6, 0.06, 6.06], [100, 1, 101], [10001, 100.01, 10101.01]]) {
  Deno.test(`calcula taxa de 1% para recarga de ${amount}`, () => {
    const result = pixPricing(amount)
    if (result.serviceFee !== fee || result.chargedAmount !== total) throw new Error('Taxa ou total incorretos')
  })
}

Deno.test('confere o total com taxa e mantém separado o valor creditado', () => {
  const recharge = { ...local, amount: 100, webhook_data: { amount_charged: 101, service_fee: 1 } }
  validatePayment({ ...remote, transaction_amount: 101 }, recharge)
  let rejected = false
  try { validatePayment({ ...remote, transaction_amount: 100 }, recharge) } catch { rejected = true }
  if (!rejected) throw new Error('Pagamento sem taxa foi aceito')
  if (recharge.amount !== 100) throw new Error('Taxa foi incorporada ao crédito')
})
