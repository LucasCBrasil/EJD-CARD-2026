import { allocateRefundBalance, type BalanceEvent } from './refund-allocation.ts'

type Transaction = { id: string; type: string; amount: number | string; created_by: string | null; created_at: string; description?: string }
type Payment = { id: string; amount: number | string; status: string; external_id: string | null; confirmed_at: string | null; webhook_data: { provider?: string } | null }
type Operation = { id: string; status: string; amount: number | string }
const cents = (amount: number | string) => {
  const value = Number(amount)
  const result = Math.round(Math.abs(value) * 100)
  if (!Number.isFinite(value) || !Number.isSafeInteger(result) || result <= 0 || Math.abs(Math.abs(value) * 100 - result) > 0.000001) throw new Error('Valor inválido no histórico')
  return result
}

/** Historical schema has no transaction-to-payment FK. Match only when unambiguous. */
export function buildRefundPlan(transactions: Transaction[], payments: Payment[], balance: number | string, operations: Operation[] = []) {
  const ignored = new Set<string>()
  for (const operation of operations.filter(o => ['cancelled', 'rejected'].includes(o.status))) {
    const debits = transactions.filter(t => t.type === 'debit' && t.description === `Reserva para ressarcimento Pix ${operation.id}`)
    const credits = transactions.filter(t => t.type === 'credit' && [
      `Liberação de reserva Pix não enviada ${operation.id}`,
      `Liberação de reserva de reembolso Pix ${operation.id}`,
    ].includes(t.description || ''))
    if (debits.length !== 1 || credits.length !== 1 || cents(debits[0].amount) !== cents(operation.amount) || cents(credits[0].amount) !== cents(operation.amount)) {
      throw new Error('Reserva cancelada não reconciliada; requer análise manual')
    }
    ignored.add(debits[0].id); ignored.add(credits[0].id)
  }
  const sorted = transactions.filter(t => !ignored.has(t.id)).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))
  const events: BalanceEvent[] = []
  const used = new Set<string>()
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]
    if (i > 0 && sorted[i - 1].created_at === row.created_at) throw new Error('Ordem do histórico é ambígua')
    const amount = cents(row.amount)
    if (row.type === 'debit') { events.push({ kind: 'debit', cents: amount }); continue }
    if (row.type !== 'credit') throw new Error('Tipo de movimentação desconhecido')
    if (row.created_by === 'mercadopago_webhook') {
      const matches = payments.filter(p => p.status === 'confirmed' && p.webhook_data?.provider === 'mercadopago' && /^\d+$/.test(p.external_id || '') && p.confirmed_at === row.created_at && cents(p.amount) === amount && !used.has(p.id))
      if (matches.length !== 1) throw new Error('Não foi possível identificar o Pix original de forma inequívoca')
      used.add(matches[0].id)
      events.push({ kind: 'pix', paymentId: matches[0].id, cents: amount })
    } else {
      if (!row.created_by || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.created_by)) throw new Error('Origem do crédito requer análise manual')
      if (!row.description || /estorno|cancelamento|cancelad/i.test(row.description)) throw new Error('Crédito de estorno requer análise manual')
      events.push({ kind: 'manual', cents: amount })
    }
  }
  const value = Number(balance)
  if (!Number.isFinite(value) || value < 0 || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) throw new Error('Saldo inválido')
  return allocateRefundBalance(events, Math.round(value * 100))
}
