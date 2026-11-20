/** Validates provider responses before they can affect an account balance. */
export function validateRefundResponse(response: unknown, paymentId: string, amountCents: number) {
  if (!response || typeof response !== 'object') throw new Error('Resposta de reembolso inválida')
  const refund = response as Record<string, unknown>
  const id = String(refund.id ?? '')
  const providerPayment = String(refund.payment_id ?? '')
  const amount = Number(refund.amount)
  if (!/^\d+$/.test(id) || !/^\d+$/.test(paymentId) || providerPayment !== paymentId ||
      !Number.isSafeInteger(amountCents) || amountCents <= 0 || !Number.isFinite(amount) ||
      Math.abs(amount * 100 - amountCents) > 0.000001) {
    throw new Error('Resposta de reembolso não corresponde à operação')
  }
  if (!['approved', 'in_process', 'rejected', 'cancelled', 'authorized'].includes(String(refund.status))) {
    throw new Error('Estado de reembolso desconhecido')
  }
  return { id, status: String(refund.status), amountCents }
}
