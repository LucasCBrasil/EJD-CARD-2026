export function validatePayment(payment: any, local: any) {
  const paid = Number(payment.transaction_amount)
  const expected = Number(local.webhook_data?.amount_charged ?? local.amount)
  if (!Number.isFinite(paid) || !Number.isFinite(expected) || expected <= 0 ||
      payment.payment_method_id !== 'pix' || payment.currency_id !== 'BRL' ||
      String(payment.id) !== local.external_id || payment.external_reference !== local.id ||
      Math.round(paid * 100) !== Math.round(expected * 100) ||
      payment.metadata?.user_id !== local.user_id) {
    throw new Error('Pagamento incompatível com a recarga registrada.')
  }
}
