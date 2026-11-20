/** All amounts are integer cents. Events must be in ledger order. */
export type BalanceEvent =
  | { kind: 'pix'; paymentId: string; cents: number }
  | { kind: 'manual'; cents: number }
  | { kind: 'debit'; cents: number }

export type PixBalance = { paymentId: string; cents: number }

/** Apply debits to the oldest available Pix first, then manual credit. */
export function allocateRefundBalance(events: BalanceEvent[], expectedBalanceCents: number) {
  if (!Number.isSafeInteger(expectedBalanceCents) || expectedBalanceCents < 0) throw new Error('Saldo inválido')
  const pix: PixBalance[] = []
  const paymentIds = new Set<string>()
  let manualCents = 0
  for (const event of events) {
    if (!Number.isSafeInteger(event.cents) || event.cents <= 0) throw new Error('Movimentação inválida')
    if (event.kind === 'pix') {
      if (!event.paymentId || paymentIds.has(event.paymentId)) throw new Error('Pagamento Pix ambíguo')
      paymentIds.add(event.paymentId)
      pix.push({ paymentId: event.paymentId, cents: event.cents })
    } else if (event.kind === 'manual') {
      manualCents += event.cents
    } else {
      let remaining = event.cents
      for (const credit of pix) {
        const consumed = Math.min(credit.cents, remaining)
        credit.cents -= consumed
        remaining -= consumed
        if (!remaining) break
      }
      const consumedManual = Math.min(manualCents, remaining)
      manualCents -= consumedManual
      remaining -= consumedManual
      if (remaining) throw new Error('Histórico insuficiente para conciliar saldo')
    }
    if (!Number.isSafeInteger(manualCents) || pix.some(p => !Number.isSafeInteger(p.cents))) throw new Error('Valor excede limite')
  }
  const refundablePix = pix.filter(p => p.cents > 0)
  const total = refundablePix.reduce((sum, p) => sum + p.cents, manualCents)
  if (!Number.isSafeInteger(total) || total !== expectedBalanceCents) throw new Error('Histórico não corresponde ao saldo atual')
  return { pix: refundablePix, manualCents }
}
