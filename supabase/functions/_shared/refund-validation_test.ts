import { validateRefundResponse } from './refund-validation.ts'
const valid = { id: 123, payment_id: 456, amount: 3, status: 'approved' }
Deno.test('valida reembolso do pagamento e valor esperados', () => {
  if (validateRefundResponse(valid, '456', 300).status !== 'approved') throw new Error('Estado incorreto')
})
for (const [name, change] of Object.entries({
  'pagamento diferente': { payment_id: 457 }, 'valor diferente': { amount: 3.01 },
  'identificador ausente': { id: null }, 'estado desconhecido': { status: 'unknown' },
})) {
  Deno.test(`rejeita ${name}`, () => {
    let rejected = false
    try { validateRefundResponse({ ...valid, ...change }, '456', 300) } catch { rejected = true }
    if (!rejected) throw new Error('Resposta incompatível aceita')
  })
}
Deno.test('não trata reembolso em processamento como aprovado', () => {
  if (validateRefundResponse({ ...valid, status: 'in_process' }, '456', 300).status === 'approved') throw new Error('Estado incorreto')
})
