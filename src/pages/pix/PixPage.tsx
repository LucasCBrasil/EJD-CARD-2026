import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { Button, CurrencyInput, CpfCnpjInput, isValidCpfCnpj, TrainLoader } from '../../components/shared'
import { useAuth } from '../../contexts/AuthContext'
import { api } from '../../lib/api-client'
import { accountKeys } from '../../hooks/useAccounts'
import { pixPricing } from '../../../supabase/functions/_shared/pix-pricing'
import { loadPayerDocument, savePayerDocument } from '../../lib/pixPayerDocument'

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
type Payment = { paymentId: string; pixCode: string; qrCodeUrl: string; amount: number; chargedAmount?: number }

export default function PixPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { paymentId = 'new' } = useParams({ strict: false }) as { paymentId?: string }
  const queryClient = useQueryClient()
  const [amount, setAmount] = useState(0)
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [payment, setPayment] = useState<Payment | null>(null)
  const [status, setStatus] = useState('pending')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const submitting = useRef(false)
  const attempt = useRef<{ input: string; key: string } | null>(null)
  const validAmount = Number.isFinite(amount) && amount >= 0.01
  const { serviceFee, chargedAmount } = pixPricing(amount)
  const userId = user?.id

  useEffect(() => { setCpfCnpj(userId ? loadPayerDocument(userId) : '') }, [userId])

  useEffect(() => {
    if (paymentId === 'new') { setPayment(null); setStatus('pending'); setError(''); return }
    setPayment(null)
    setStatus('pending')
    setCopied(false)
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const check = async () => {
      try {
        const response = await api.getPixPaymentStatus(paymentId)
        if (cancelled) return
        if (!response.success) throw new Error(response.error || 'Não foi possível verificar o pagamento.')
        const data = response.data
        setPayment({ paymentId, amount: Number(data.amount), chargedAmount: Number(data.amount_charged ?? data.amount), pixCode: data.pix_code || '', qrCodeUrl: data.qr_code_url || '' })
        setStatus(data.status)
        setError('')
        if (data.status === 'confirmed') {
          void queryClient.invalidateQueries({ queryKey: accountKeys.all })
          void queryClient.invalidateQueries({ queryKey: ['my-account-history'] })
          return
        }
        if (data.status !== 'pending') return
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Erro ao verificar pagamento.')
      }
      if (!cancelled) timer = setTimeout(check, 5000)
    }
    void check()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [paymentId, queryClient])

  const generate = async () => {
    if (submitting.current || !user || !validAmount || !isValidCpfCnpj(cpfCnpj).valid) return
    submitting.current = true
    setLoading(true)
    setError('')
    const input = JSON.stringify({ amount, cpfCnpj, userId: user.id })
    if (attempt.current?.input !== input) attempt.current = { input, key: crypto.randomUUID() }
    try {
      const response = await api.createPixPayment({ amount, cpfCnpj, idempotencyKey: attempt.current.key })
      if (!response.success) throw new Error(response.error || 'Não foi possível gerar o Pix.')
      // Só depois do sucesso, para não lembrar um documento que o Mercado Pago recusou.
      savePayerDocument(user.id, cpfCnpj)
      setPayment(response.data)
      setStatus('pending')
      await navigate({ to: '/pix/$paymentId', params: { paymentId: response.data.paymentId } })
      attempt.current = null
    } catch (err) { setError(err instanceof Error ? err.message : 'Erro ao gerar Pix.') }
    finally { submitting.current = false; setLoading(false) }
  }
  const copy = async () => {
    try { await navigator.clipboard.writeText(payment?.pixCode || ''); setCopied(true) }
    catch { setError('Não foi possível copiar. Selecione o código e copie manualmente.') }
  }
  const terminal = ['failed', 'cancelled', 'expired'].includes(status)
  return (
    <div className="max-w-md mx-auto painel p-5 sm:p-6 text-ferro-900 space-y-5">
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-ferro-600">Pix · Mercado Pago</p>
        <h1 className="text-2xl font-display uppercase mt-2">Recarregar saldo</h1>
        <p className="text-sm text-ferro-600 mt-2">O crédito entra na sua conta após a confirmação do pagamento.</p>
      </div>
      {error && <div role="alert" className="rounded-xl border border-vagao-200 bg-vagao-50 p-4 text-vagao-700">{error}</div>}
      {loading ? <TrainLoader fullScreen={false} title="Gerando Pix…" message="Aguarde um momento" /> : paymentId === 'new' ? <>
        <div className="bilhete p-4"><span className="text-xs uppercase">Conta que receberá o crédito</span><p className="font-semibold">{user?.name}</p><p className="text-sm break-all">{user?.email}</p></div>
        <div><p className="font-semibold mb-2">Quanto deseja recarregar?</p>
          <CurrencyInput value={amount} onChange={setAmount} max={99999999.99} aria-label="Valor da recarga" />
          <p className="text-xs text-ferro-600 mt-1">Escolha qualquer valor a partir de R$ 0,01.</p></div>
        <div><p className="font-semibold mb-2">CPF/CNPJ do pagador</p>
          <CpfCnpjInput value={cpfCnpj} onChange={setCpfCnpj} aria-label="CPF ou CNPJ do pagador" />
          {cpfCnpj && !isValidCpfCnpj(cpfCnpj).valid && <p className="text-sm text-vagao-700 mt-1">Informe um CPF ou CNPJ válido.</p>}
          <p className="text-xs text-ferro-600 mt-1">Depois de gerar o Pix, o documento fica salvo neste aparelho para a próxima recarga.</p></div>
        {validAmount && <div className="bilhete p-4 space-y-2">
          <div className="flex justify-between text-sm"><span>Crédito na conta</span><span>{money(amount)}</span></div>
          <div className="flex justify-between text-sm"><span>Taxa de serviço (1%)</span><span>{money(serviceFee)}</span></div>
          <div className="flex justify-between border-t border-ferro-200 pt-2"><span>Total a pagar</span><strong>{money(chargedAmount)}</strong></div>
        </div>}
        <Button className="w-full" disabled={!user || !validAmount || !isValidCpfCnpj(cpfCnpj).valid} onClick={generate}>Gerar Pix{validAmount ? ` de ${money(chargedAmount)}` : ''}</Button>
      </> : status === 'confirmed' ? <div className="text-center space-y-4" role="status"><h2 className="text-xl font-display text-green-800">Pagamento confirmado!</h2><p>Seu saldo foi atualizado.</p>{payment && <strong className="block text-3xl">+ {money(payment.amount)}</strong>}</div>
        : terminal ? <div role="status" className="text-center"><h2 className="font-display text-xl">{status === 'expired' ? 'Pix expirado' : 'Pagamento não concluído'}</h2><p className="my-3">Nenhum crédito foi adicionado.</p><Button onClick={() => navigate({ to: '/pix/$paymentId', params: { paymentId: 'new' } })}>Gerar outro Pix</Button></div>
        : payment ? <>
          <div className="text-center"><p className="text-sm">Aguardando pagamento</p><strong className="text-3xl font-slab">{money(payment.chargedAmount ?? payment.amount)}</strong><p className="text-sm mt-2">Crédito na conta: {money(payment.amount)}</p></div>
          {payment.qrCodeUrl && <img src={payment.qrCodeUrl.startsWith('data:') || payment.qrCodeUrl.startsWith('https:') ? payment.qrCodeUrl : `data:image/png;base64,${payment.qrCodeUrl}`} alt="QR Code para pagamento Pix" className="w-56 h-56 mx-auto bg-white p-3 rounded-xl" />}
          {payment.pixCode && <><textarea readOnly aria-label="Pix copia e cola" value={payment.pixCode} className="w-full p-3 border rounded-xl text-xs break-all" /><Button className="w-full" onClick={copy}>{copied ? 'Código copiado!' : 'Copiar código Pix'}</Button></>}
          <p className="text-sm text-ferro-600">Abra o aplicativo do seu banco e escaneie o QR Code ou use Pix copia e cola. A confirmação é automática.</p>
          <p role="status" className="text-center text-sm">Verificando pagamento…</p>
        </> : <p role="status">Carregando pagamento…</p>}
      <Button variant="secondary" className="w-full" onClick={() => navigate({ to: '/account' })}>Voltar para Minha Conta</Button>
      {paymentId === 'new' && <p className="text-xs text-center text-ferro-600">Será acrescentada uma taxa de serviço de 1% sobre o valor da recarga, arredondada para centavos. O valor da recarga será integralmente creditado na sua conta.</p>}
    </div>
  )
}
