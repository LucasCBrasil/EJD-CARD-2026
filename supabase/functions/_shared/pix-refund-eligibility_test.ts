import { isOriginalPixRefundEligible } from './pix-refund-eligibility.ts'
const baseTime = Date.now() - 4 * 86400000
const tx = { id: 'tx1', type: 'credit', amount: 3, created_by: 'mercadopago_webhook', created_at: new Date(baseTime).toISOString() }
const payment = { id: 'payment1', amount: 3, status: 'confirmed', external_id: '123', confirmed_at: tx.created_at, webhook_data: { provider: 'mercadopago' } }
Deno.test('recarga Pix conciliada é elegível', () => {
  if (!isOriginalPixRefundEligible([tx], [payment], 3, [])) throw new Error('Pix elegível rejeitado')
})
Deno.test('crédito manual impede uso do fluxo exclusivo Pix', () => {
  const manual = { ...tx, id: 'manual', created_by: '12345678-1234-1234-1234-123456789012', created_at: new Date(baseTime + 86400000).toISOString(), description: 'Crédito manual' }
  if (isOriginalPixRefundEligible([tx, manual], [payment], 6, [])) throw new Error('Conta mista aceita')
})
Deno.test('pagamento ausente ou ambíguo não é elegível', () => {
  if (isOriginalPixRefundEligible([tx], [], 3, []) || isOriginalPixRefundEligible([tx], [payment, { ...payment, id: 'payment2' }], 3, [])) throw new Error('Origem não verificada aceita')
})
Deno.test('não oferece fluxo quando são necessários múltiplos reembolsos', () => {
  const tx2 = { ...tx, id: 'tx2', created_at: new Date(baseTime + 86400000).toISOString() }
  const payment2 = { ...payment, id: 'payment2', external_id: '124', confirmed_at: tx2.created_at }
  if (isOriginalPixRefundEligible([tx, tx2], [payment, payment2], 6, [])) throw new Error('Múltiplos pagamentos aceitos sem suporte')
})
Deno.test('reserva devolvida corretamente não conta como crédito manual', () => {
  const op = { id: 'op1', status: 'cancelled', amount: 3 }
  const debit = { id: 'tx2', type: 'debit', amount: -3, created_by: 'admin', created_at: new Date(baseTime + 86400000).toISOString(), description: 'Reserva para ressarcimento Pix op1' }
  const credit = { id: 'tx3', type: 'credit', amount: 3, created_by: 'admin', created_at: new Date(baseTime + 2 * 86400000).toISOString(), description: 'Liberação de reserva Pix não enviada op1' }
  if (!isOriginalPixRefundEligible([tx, debit, credit], [payment], 3, [op])) throw new Error('Reserva compensada rejeitada')
})
