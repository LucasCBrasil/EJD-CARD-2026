import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api-client'
import { usePixRefundEligibility } from '../hooks/usePixRefundEligibility'
import { Button } from './shared'

export default function PixRefundCheckbox() {
  const { data } = usePixRefundEligibility()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [pix, setPix] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  if (!data || (!data.enabled && !data.pending)) return null
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy(true); setError('')
    const result = data!.eligible ? await api.requestOriginalPixRefund() : await api.requestRefund(pix, whatsapp)
    if (!result.success) { setError(result.error || 'Não foi possível enviar a solicitação.'); setBusy(false); return }
    setOpen(false); setBusy(false); setPix(''); setWhatsapp('')
    await queryClient.invalidateQueries({ queryKey: ['pix-refund-eligibility'] })
  }
  return <>
    {data.pending ? <p role="status" className="text-sm text-ferro-700">Solicitação de ressarcimento pendente.</p> :
      <label className="flex items-center gap-2 text-sm text-ferro-900 cursor-pointer"><input type="checkbox" checked={open} onChange={e => { setError(''); setOpen(e.target.checked) }} />Solicitar ressarcimento do saldo</label>}
    {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="original-pix-refund-title">
      <form onSubmit={submit} className="painel w-full max-w-md p-6 text-left space-y-4">
        <h2 id="original-pix-refund-title" className="text-xl font-semibold">Solicitar ressarcimento</h2>
        {data.eligible ? <>
          <p>Após análise e autorização, o valor Pix elegível será devolvido à conta que realizou o pagamento original.</p>
          <p className="text-sm">A solicitação não envia dinheiro imediatamente. O valor disponível é conferido antes da devolução.</p>
        </> : <>
          <p className="text-sm">A solicitação será analisada pela administração. Informe a chave Pix e um contato para o tratamento do ressarcimento.</p>
          <label className="block">Chave Pix<input required maxLength={200} value={pix} onChange={e => setPix(e.target.value)} className="mt-1 w-full rounded border border-ferro-300 p-2" /></label>
          <label className="block">Contato WhatsApp<input required minLength={8} maxLength={40} type="tel" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="mt-1 w-full rounded border border-ferro-300 p-2" /></label>
        </>}
        {error && <p role="alert" className="text-vagao-700">{error}</p>}
        <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>Confirmar solicitação</Button><Button type="button" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Cancelar</Button></div>
      </form>
    </div>}
  </>
}
