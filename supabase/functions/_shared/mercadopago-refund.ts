import { validateRefundResponse } from './refund-validation.ts'

/** Caller must persist operationId and reserve funds before invoking this function. */
export async function requestMercadoPagoRefund(input: {
  token: string; paymentId: string; amountCents: number; operationId: string
}, fetcher: typeof fetch = fetch) {
  if (!input.token || !/^\d+$/.test(input.paymentId) ||
      !Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.operationId)) {
    throw new Error('Dados de reembolso inválidos')
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20000)
  try {
  const response = await fetcher(`https://api.mercadopago.com/v1/payments/${input.paymentId}/refunds`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${input.token}`, 'Content-Type': 'application/json', 'X-Idempotency-Key': input.operationId, 'X-Render-In-Process-Refunds': 'true' },
    body: JSON.stringify({ amount: input.amountCents / 100 }),
    signal: controller.signal,
  })
  if (!response.ok) throw new Error(`Mercado Pago não confirmou o reembolso (HTTP ${response.status})`)
  return validateRefundResponse(await response.json(), input.paymentId, input.amountCents)
  } finally { clearTimeout(timer) }
}
