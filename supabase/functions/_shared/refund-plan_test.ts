import { buildRefundPlan } from './refund-plan.ts'
const tx = { id:'tx1',type:'credit',amount:3,created_by:'mercadopago_webhook',created_at:'2026-01-01T00:00:00Z' }
const payment = { id:'payment1',amount:3,status:'confirmed',external_id:'123',confirmed_at:tx.created_at,webhook_data:{provider:'mercadopago'} }
Deno.test('liga crédito ao Pix confirmado quando há correspondência exata', () => {
  const result = buildRefundPlan([tx], [payment], 3)
  if (result.pix[0]?.paymentId !== 'payment1' || result.pix[0]?.cents !== 300) throw new Error('Plano incorreto')
})
Deno.test('bloqueia dois pagamentos candidatos', () => {
  let failed = false
  try { buildRefundPlan([tx], [payment,{...payment,id:'payment2'}], 3) } catch { failed = true }
  if (!failed) throw new Error('Vínculo ambíguo aceito')
})
Deno.test('bloqueia origem sem pagamento correspondente', () => {
  let failed = false
  try { buildRefundPlan([tx], [], 3) } catch { failed = true }
  if (!failed) throw new Error('Crédito sem pagamento aceito')
})
Deno.test('reserva cancelada e devolvida não consome o Pix original', () => {
  const op = {id:'op1',status:'cancelled',amount:3}
  const debit = {id:'tx2',type:'debit',amount:-3,created_by:'admin',created_at:'2026-01-02T00:00:00Z',description:'Reserva para ressarcimento Pix op1'}
  const credit = {id:'tx3',type:'credit',amount:3,created_by:'reconciliacao_manual',created_at:'2026-01-03T00:00:00Z',description:'Liberação de reserva Pix não enviada op1'}
  const plan = buildRefundPlan([tx,debit,credit],[payment],3,[op])
  if (plan.pix[0]?.cents !== 300) throw new Error('Pix não restaurado')
})
Deno.test('não ignora reserva cancelada sem crédito compensatório', () => {
  let failed = false
  try { buildRefundPlan([tx],[payment],3,[{id:'op1',status:'cancelled',amount:3}]) } catch { failed = true }
  if (!failed) throw new Error('Reserva inconsistente aceita')
})
Deno.test('não classifica estorno de pedido como recarga manual', () => {
  let failed = false
  const saleRefund = {id:'tx4',type:'credit',amount:1,created_by:'12345678-1234-1234-1234-123456789012',created_at:'2026-01-02T00:00:00Z',description:'Estorno pedido Lanchonete #5'}
  try { buildRefundPlan([tx,saleRefund],[payment],4) } catch { failed = true }
  if (!failed) throw new Error('Estorno de pedido foi tratado como recarga manual')
})
