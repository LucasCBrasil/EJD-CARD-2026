import { selectRefundPayment } from './refund-payment-selection.ts'

const now = Date.parse('2026-11-24T12:00:00Z')
const times = ['2026-11-20T10:00:00Z', '2026-11-20T11:00:00Z', '2026-11-20T12:00:00Z', '2026-11-20T13:00:00Z', '2026-11-20T14:00:00Z']
const amounts = [40, 5, 2]
const payments = amounts.map((amount, i) => ({ id: `p${i}`, amount, status: 'confirmed', external_id: `${100 + i}`, confirmed_at: times[i], webhook_data: { provider: 'mercadopago' } }))
const transactions = [
  ...payments.map((p, i) => ({ id: `t${i}`, type: 'credit', amount: p.amount, created_by: 'mercadopago_webhook', created_at: p.confirmed_at })),
  { id: 'manual', type: 'credit', amount: 5, created_by: '12345678-1234-1234-1234-123456789012', description: 'Crédito manual', created_at: times[3] },
  { id: 'debit', type: 'debit', amount: 41, created_by: 'admin', created_at: times[4] },
]

Deno.test('devolve saldo misto integral pela maior recarga, mesmo após seu consumo contábil', () => {
  const result = selectRefundPayment(transactions, payments, 11, [], now)
  if (result?.id !== 'p0') throw new Error('Pagamento de R$ 40 deveria ser selecionado')
})
Deno.test('não escolhe pagamento sem valor disponível suficiente', () => {
  const operations = [{ id: 'op', payment_id: 'p0', status: 'approved', amount: 30 }]
  if (selectRefundPayment(transactions, payments, 11, operations, now) !== null) throw new Error('Pagamento não cobre o saldo')
})
Deno.test('não escolhe pagamento fora do prazo', () => {
  if (selectRefundPayment(transactions, payments, 11, [], now + 181 * 86400000) !== null) throw new Error('Pagamento expirado foi selecionado')
})
Deno.test('rejeita histórico que não corresponde ao saldo', () => {
  let rejected = false
  try { selectRefundPayment(transactions, payments, 12, [], now) } catch { rejected = true }
  if (!rejected) throw new Error('Histórico divergente foi aceito')
})
