import { requestMercadoPagoRefund } from './mercadopago-refund.ts'
const operationId = 'cebe5d5d-e34b-45ac-b7ce-f18ee54eb7be'
Deno.test('envia valor, pagamento e chave idempotente sem reembolsar a taxa', async () => {
  let calls = 0
  const mock: typeof fetch = async (url, options) => {
    calls++
    if (url !== 'https://api.mercadopago.com/v1/payments/123/refunds') throw new Error('URL incorreta')
    const headers = new Headers(options?.headers)
    if (headers.get('X-Idempotency-Key') !== operationId || headers.get('Authorization') !== 'Bearer test' || headers.get('X-Render-In-Process-Refunds') !== 'true') throw new Error('Cabeçalhos incorretos')
    if (options?.body !== JSON.stringify({amount: 3})) throw new Error('Valor incorreto')
    return new Response(JSON.stringify({id: 456,payment_id: 123,amount: 3,status:'approved'}), {status: 201})
  }
  const result = await requestMercadoPagoRefund({token:'test',paymentId:'123',amountCents:300,operationId}, mock)
  if (result.status !== 'approved' || calls !== 1) throw new Error('Resultado incorreto')
})
Deno.test('erro do provedor não é tratado como devolução confirmada', async () => {
  let failed = false
  try { await requestMercadoPagoRefund({token:'test',paymentId:'123',amountCents:300,operationId}, async () => new Response('{}', {status:500})) } catch { failed = true }
  if (!failed) throw new Error('Falha do provedor foi aceita')
})
