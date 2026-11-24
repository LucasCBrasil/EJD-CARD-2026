import React, { useState } from 'react'
import { api } from '../../lib/api-client'
import { Button } from '../../components/shared'

type Refund = { id: string; mercado_pago_eligible?: boolean; pix_key: string | null; whatsapp: string | null; status: string; created_at: string; authorized_at?: string | null; manual_settlement_amount?: number | null; manual_claimed_by?: string | null; manual_claim_mine?: boolean; app_users: { name: string; email: string; balance: number } | null; credits: { amount: number; description: string; created_at: string; created_by: string | null }[]; operations?: { id: string; amount: number; status: string }[]; account_operations?: { id: string; status: string }[] }
type ManualClaim = { id: string; name: string; amount: number; pix_key: string; whatsapp: string | null; balance_changed: boolean }

function isPixOnly(item: Refund) {
  if (item.manual_claimed_by) return false
  return item.mercado_pago_eligible === true || item.operations?.some(operation => ['prepared', 'processing', 'unknown'].includes(operation.status)) === true
}
export default function RefundManagement() {
  const [open, setOpen] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [items, setItems] = useState<Refund[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [manualClaim, setManualClaim] = useState<ManualClaim | null>(null)
  const [modalError, setModalError] = useState('')
  const [tab, setTab] = useState<'pix' | 'manual' | 'approved'>('pix')
  const isApproved = (item: Refund) => item.manual_settlement_amount != null || item.operations?.some(operation => operation.status === 'approved') === true
  const approvedItems = items.filter(isApproved)
  const pixItems = items.filter(item => !isApproved(item) && isPixOnly(item))
  const manualItems = items.filter(item => !isApproved(item) && !isPixOnly(item))
  const visibleItems = tab === 'pix' ? pixItems : tab === 'manual' ? manualItems : approvedItems
  async function load() {
    setBusy(true); setError('')
    const [flag, refunds] = await Promise.all([api.getFeatureFlag('refunds_enabled'), api.listRefunds()])
    if (!flag.success || !refunds.success) setError(refunds.error || 'Erro ao carregar ressarcimentos.')
    else { setEnabled(flag.data?.enabled === true); setItems(refunds.data || []) }
    setBusy(false)
  }
  async function toggle(value: boolean) {
    setBusy(true); setError('')
    const result = await api.updateFeatureFlag('refunds_enabled', value)
    if (result.success) setEnabled(value); else setError('Erro ao atualizar opção.')
    setBusy(false)
  }
  async function authorize(id: string, pending: boolean) {
    if (!window.confirm(pending
      ? 'Consultar ou retomar a operação de reembolso já autorizada? O saldo permanecerá reservado até a confirmação do Mercado Pago.'
      : 'Autorizar a devolução de todo o saldo para a conta que fez a maior recarga Pix elegível? O valor será reservado enquanto o Mercado Pago processa a devolução.')) return
    setBusy(true); setError('')
    const result = await api.authorizeRefund(id)
    if (!result.success) { setError(result.error || 'Erro ao autorizar.'); setBusy(false); return }
    await load()
  }
  async function openManual(item: Refund) {
    setBusy(true); setError('')
    const result = await api.claimManualRefund(item.id)
    if (!result.success) { setError(result.error || 'Não foi possível reservar a solicitação.'); setBusy(false); return }
    setModalError(''); setManualClaim({ ...result.data, id: item.id, amount: Number(result.data.amount) }); setBusy(false)
  }
  async function settleManual() {
    if (!manualClaim) return
    if (!window.confirm(`Confirma que o Pix de R$ ${manualClaim.amount.toFixed(2).replace('.', ',')} já foi realizado fora do sistema?`)) return
    setBusy(true); setModalError('')
    const result = await api.settleManualRefund(manualClaim.id, manualClaim.amount)
    if (!result.success) { setModalError('Não foi possível registrar a baixa. Não faça outro Pix; mantenha a reserva e confira o saldo com a administração.'); setBusy(false); return }
    setManualClaim(null)
    await load()
  }
  async function releaseManual() {
    if (!manualClaim || !window.confirm('Confirma que NÃO realizou o Pix? A solicitação ficará disponível para outro administrador.')) return
    setBusy(true); setModalError('')
    const result = await api.releaseManualRefund(manualClaim.id)
    if (!result.success) { setModalError(result.error || 'Não foi possível liberar a solicitação.'); setBusy(false); return }
    setManualClaim(null); await load()
  }
  return <div className="painel p-5 space-y-4">
    <Button onClick={() => { if (!open) void load(); setOpen(!open) }}>Ressarcimentos</Button>
    {open && <div className="space-y-4">
      <label className="flex items-center gap-2"><input type="checkbox" checked={enabled} disabled={busy} onChange={e => void toggle(e.target.checked)} /> Mostrar opção de ressarcimento</label>
      <p className="text-sm">O saldo pode ser devolvido ao pagamento Pix original elegível de maior valor, inclusive quando há créditos manuais. Valores reservados aguardam confirmação do Mercado Pago.</p>
      <div role="tablist" aria-label="Categorias de ressarcimento" className="flex flex-wrap gap-2">
        <button type="button" role="tab" aria-selected={tab === 'pix'} onClick={() => setTab('pix')} className={`rounded-xl px-4 py-2 font-semibold ${tab === 'pix' ? 'bg-ferro-900 text-white' : 'border border-ferro-300 text-ferro-900'}`}>Mercado Pago ({pixItems.length})</button>
        <button type="button" role="tab" aria-selected={tab === 'manual'} onClick={() => setTab('manual')} className={`rounded-xl px-4 py-2 font-semibold ${tab === 'manual' ? 'bg-ferro-900 text-white' : 'border border-ferro-300 text-ferro-900'}`}>Análise manual ({manualItems.length})</button>
        <button type="button" role="tab" aria-selected={tab === 'approved'} onClick={() => setTab('approved')} className={`rounded-xl px-4 py-2 font-semibold ${tab === 'approved' ? 'bg-ferro-900 text-white' : 'border border-ferro-300 text-ferro-900'}`}>Aprovados ({approvedItems.length})</button>
      </div>
      <p className="text-sm">A classificação verifica o histórico e os pagamentos registrados. A disponibilidade é confirmada no Mercado Pago antes da devolução.</p>
      {tab === 'pix' && <p className="text-sm">O saldo atual pode ser diferente do valor elegível, que é conferido antes da devolução. Valores já reservados não aparecem no saldo disponível.</p>}
      {tab === 'manual' && <p className="text-sm">Faça o pagamento fora do sistema e registre a baixa somente após confirmá-lo. A baixa não envia Pix e desconta todo o saldo atual.</p>}
      {error && <p role="alert" className="text-vagao-700">{error}</p>}
      {!busy && visibleItems.length === 0 && !error && <p>Nenhuma solicitação nesta categoria.</p>}
      {tab === 'pix' && visibleItems.length > 0 && <div className="overflow-x-auto rounded-xl border border-ferro-200">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-ferro-100"><tr><th scope="col" className="p-4">Usuário</th><th scope="col" className="p-4">Saldo atual</th><th scope="col" className="p-4">Status da autorização</th><th scope="col" className="p-4">Ação</th></tr></thead>
          <tbody>{visibleItems.map(item => {
            const pendingOperation = item.operations?.some(o => ['prepared', 'processing', 'unknown'].includes(o.status)) === true
            const released = item.operations?.some(o => ['cancelled', 'rejected'].includes(o.status)) === true
            const status = pendingOperation ? 'Aguardando confirmação' : item.status === 'pending' ? (released ? 'Pendente — reserva liberada' : 'Pendente') : 'Autorizado — pagamento não confirmado'
            return <tr key={item.id} className="border-t border-ferro-200">
              <td className="p-4 font-semibold">{item.app_users?.name || item.app_users?.email || 'Usuário'}</td>
              <td className="p-4">{item.app_users ? `R$ ${Number(item.app_users.balance).toFixed(2).replace('.', ',')}` : 'Indisponível'}</td>
              <td className="p-4">{status}</td>
              <td className="p-4">{item.status === 'pending' ? <Button disabled={busy} onClick={() => void authorize(item.id, pendingOperation)}>{pendingOperation ? 'Consultar ou retomar' : 'Autorizar devolução'}</Button> : '—'}</td>
            </tr>
          })}</tbody>
        </table>
      </div>}
      {tab === 'manual' && visibleItems.length > 0 && <div className="overflow-x-auto rounded-xl border border-ferro-200"><table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-ferro-100"><tr><th scope="col" className="p-4">Usuário</th><th scope="col" className="p-4">Saldo atual</th><th scope="col" className="p-4">Chave Pix informada</th><th scope="col" className="p-4">Ação</th></tr></thead>
        <tbody>{visibleItems.map(item => <tr key={item.id} className="border-t border-ferro-200">
          <td className="p-4 font-semibold">{item.app_users?.name || item.app_users?.email || 'Usuário'}</td><td className="p-4">{item.app_users ? `R$ ${Number(item.app_users.balance).toFixed(2).replace('.', ',')}` : 'Indisponível'}</td><td className="p-4 break-all">{item.pix_key || 'Não informada — contate a pessoa'}</td>
          <td className="p-4">{item.status === 'pending' ? <Button disabled={busy || !item.pix_key || (!!item.manual_claimed_by && !item.manual_claim_mine) || (!item.manual_claim_mine && (!item.app_users || Number(item.app_users.balance) <= 0 || item.account_operations?.some(o => ['prepared', 'processing', 'unknown'].includes(o.status))))} onClick={() => void openManual(item)}>{item.manual_claimed_by ? (item.manual_claim_mine ? 'Retomar ressarcimento' : 'Em atendimento') : 'Registrar baixa manual'}</Button> : '—'}</td>
        </tr>)}</tbody></table></div>}
      {tab === 'approved' && visibleItems.length > 0 && <div className="overflow-x-auto rounded-xl border border-ferro-200">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-ferro-100"><tr><th scope="col" className="p-4">Usuário</th><th scope="col" className="p-4">Valor registrado</th><th scope="col" className="p-4">Tipo</th><th scope="col" className="p-4">Status</th><th scope="col" className="p-4">Data</th><th scope="col" className="p-4">Detalhes</th></tr></thead>
          <tbody>{visibleItems.map(item => {
            const approvedPix = (item.operations || []).filter(operation => operation.status === 'approved')
            const approvedTotal = approvedPix.reduce((sum, operation) => sum + Number(operation.amount), Number(item.manual_settlement_amount || 0))
            const pendingOperation = item.operations?.some(operation => ['prepared', 'processing', 'unknown'].includes(operation.status)) === true
            const type = item.manual_settlement_amount != null ? (approvedPix.length ? 'Pix e manual' : 'Manual') : 'Pix'
            const status = item.status === 'pending' ? 'Solicitação pendente' : item.manual_settlement_amount != null ? 'Baixa manual registrada' : 'Reembolso Pix aprovado'
            return <tr key={item.id} className="border-t border-ferro-200 align-top">
              <td className="p-4 font-semibold">{item.app_users?.name || item.app_users?.email || 'Usuário'}</td>
              <td className="p-4 whitespace-nowrap">R$ {approvedTotal.toFixed(2).replace('.', ',')}</td>
              <td className="p-4">{type}</td><td className="p-4">{status}</td>
              <td className="p-4 whitespace-nowrap">{item.authorized_at ? new Date(item.authorized_at).toLocaleString('pt-BR') : 'Não informada'}</td>
              <td className="p-4"><details><summary className="cursor-pointer font-semibold">Ver detalhes</summary>
                <div className="mt-2 min-w-56 space-y-2"><p>E-mail: {item.app_users?.email || 'Não informado'}</p><p>Saldo atual: {item.app_users ? `R$ ${Number(item.app_users.balance).toFixed(2).replace('.', ',')}` : 'Indisponível'}</p><p className="break-all">Chave Pix: {item.pix_key || 'Não informada'}</p><p>WhatsApp: {item.whatsapp || 'Não informado'}</p><p>Solicitado em: {new Date(item.created_at).toLocaleString('pt-BR')}</p>
                  <div><strong>Créditos registrados:</strong>{item.credits.length ? <ul className="list-disc pl-5">{item.credits.map((credit, index) => <li key={index}>{credit.description} — R$ {Number(credit.amount).toFixed(2).replace('.', ',')} ({new Date(credit.created_at).toLocaleDateString('pt-BR')})</li>)}</ul> : ' Nenhum crédito registrado.'}</div>
                  {item.operations?.map(operation => <p key={operation.id}>{operation.status === 'approved' ? 'Reembolso aprovado' : ['cancelled', 'rejected'].includes(operation.status) ? 'Reserva liberada ao saldo' : 'Reserva aguardando confirmação'}: R$ {Number(operation.amount).toFixed(2).replace('.', ',')}</p>)}
                  {item.status === 'pending' && <Button disabled={busy} onClick={() => void authorize(item.id, pendingOperation)}>{pendingOperation ? 'Consultar ou retomar reembolso' : 'Autorizar devolução Pix'}</Button>}
                </div>
              </details></td>
            </tr>
          })}</tbody>
        </table>
      </div>}
    </div>}
    {manualClaim && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="manual-refund-title">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <h2 id="manual-refund-title" className="font-display text-xl">Ressarcimento manual</h2>
        <p className="text-sm">Esta solicitação está reservada para você. Faça o Pix no aplicativo do banco; o sistema não envia dinheiro.</p>
        <dl className="space-y-2 rounded-xl bg-ferro-100 p-4"><div><dt className="text-sm">Pessoa</dt><dd className="font-semibold">{manualClaim.name || 'Usuário'}</dd></div><div><dt className="text-sm">Valor</dt><dd className="font-semibold">R$ {manualClaim.amount.toFixed(2).replace('.', ',')}</dd></div><div><dt className="text-sm">Chave Pix informada</dt><dd className="font-semibold break-all">{manualClaim.pix_key}</dd></div><div><dt className="text-sm">WhatsApp</dt><dd>{manualClaim.whatsapp || 'Não informado'}</dd></div></dl>
        {manualClaim.balance_changed && <p role="alert" className="text-vagao-700">O saldo mudou desde a reserva. Confira com a administração antes de realizar o Pix. Se já pagou, não repita o pagamento.</p>}
        {modalError && <p role="alert" className="text-vagao-700">{modalError}</p>}
        <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void settleManual()}>Pix feito com sucesso</Button><button type="button" className="rounded-xl border border-ferro-300 px-4 py-2" disabled={busy} onClick={() => void releaseManual()}>Não fiz o Pix — liberar</button><button type="button" className="rounded-xl border border-ferro-300 px-4 py-2" disabled={busy} onClick={() => { setManualClaim(null); void load() }}>Fechar e manter reserva</button></div>
      </div>
    </div>}
  </div>
}
