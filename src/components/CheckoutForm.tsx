import { FormEvent, useRef, useState } from 'react'
import { api } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

type BillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD'

interface PaymentResult {
  paymentId: string
  status: string
  charges: {
    invoiceUrl?: string
    bankSlipUrl?: string
    pixCopyPasteKey?: string
    pixQrCodeImage?: string
  }
}

export function CheckoutForm() {
  const { user } = useAuth()
  const [billingType, setBillingType] = useState<BillingType>('PIX')
  const [amount, setAmount] = useState(25)
  const [name, setName] = useState(user?.name || '')
  const [email, setEmail] = useState(user?.email || '')
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<PaymentResult | null>(null)
  const inFlightRef = useRef(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (inFlightRef.current) return
    inFlightRef.current = true
    setLoading(true)
    setError(null)
    setSuccess(null)

    try {
      if (billingType === 'PIX') {
        const payload = {
          name,
          email,
          cpfCnpj,
          phone,
          amount,
          description: 'Pagamento EJD Card',
        }

        const functionsBase =
          (import.meta as any).env?.VITE_SUPABASE_FUNCTIONS_URL ||
          ((import.meta as any).env?.VITE_SUPABASE_URL ? `${(import.meta as any).env?.VITE_SUPABASE_URL}/functions/v1` : '/functions/v1')
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
        if (anonKey) headers['apikey'] = anonKey

        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 30000)
        const res = await fetch(`${functionsBase}/asaas-pix`, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal,
        }).catch((err) => {
          if (err?.name === 'AbortError') {
            throw new Error('Tempo esgotado ao chamar a função do PIX')
          }
          throw new Error(err?.message || 'Falha de rede ao gerar PIX')
        })
        clearTimeout(timeout)

        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(json?.error || 'Erro ao gerar PIX')
        }

        setSuccess(json)
        return
      }

      const customer = await api.createCustomer({ name, email, cpfCnpj, phone })
      const payment = await api.createPayment({
        customerId: customer.id,
        value: amount,
        description: 'Pagamento EJD Card',
        billingType,
        idempotencyKey: `checkout:${customer.id}:${billingType}:${amount}`,
      })
      setSuccess(payment)
    } catch (err: any) {
      setError(err.message || 'Erro ao processar pagamento')
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen text-ferro-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl painel p-5 md:p-8">
        <span className="carimbo text-vagao-600 text-xs">🎫 Bilheteria</span>
        <h1 className="mt-3 text-2xl md:text-3xl font-display font-semibold uppercase tracking-wide text-ferro-900">Checkout EJD Card</h1>
        <div className="trilho w-full mt-3 mb-6" />

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm font-semibold text-ferro-800">
              Nome completo
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 w-full"
              />
            </label>
            <label className="text-sm font-semibold text-ferro-800">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full"
              />
            </label>
            <label className="text-sm font-semibold text-ferro-800">
              CPF/CNPJ
              <input
                inputMode="numeric"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                required
                className="mt-1 w-full font-ticket"
              />
            </label>
            <label className="text-sm font-semibold text-ferro-800">
              Telefone
              <input
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full font-ticket"
              />
            </label>
          </div>

          <label className="text-sm font-semibold text-ferro-800 block">
            Valor (R$)
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
              className="mt-1 w-full font-slab"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            {(['PIX', 'BOLETO', 'CREDIT_CARD'] as BillingType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setBillingType(type)}
                className={`px-4 py-2 rounded-lg font-display text-sm tracking-wide border-2 transition-colors ${
                  billingType === type
                    ? 'border-ferro-800 bg-ferro-800 text-creme-200'
                    : 'border-ferro-200 bg-creme-200 text-ferro-800 hover:bg-creme-300'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-vagao-600 hover:bg-vagao-700 text-creme-50 font-display font-semibold tracking-wide uppercase disabled:opacity-60 transition-colors"
          >
            {loading ? 'Processando...' : 'Gerar pagamento'}
          </button>
        </form>

        {error && (
          <div className="mt-4 text-sm text-vagao-700 bg-vagao-50 border border-vagao-200 p-3 rounded-xl">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 bg-creme-100 border border-ferro-200 p-4 rounded-xl space-y-2 text-sm text-ferro-800">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display font-semibold uppercase tracking-wide text-ferro-900">Pagamento criado!</span>
              <span className="carimbo text-green-700 text-[11px]">{success.status}</span>
            </div>
            {success.charges.bankSlipUrl && (
              <a className="block text-anil-700 underline" href={success.charges.bankSlipUrl} target="_blank" rel="noreferrer">
                Ver boleto
              </a>
            )}
            {success.charges.invoiceUrl && (
              <a className="block text-anil-700 underline" href={success.charges.invoiceUrl} target="_blank" rel="noreferrer">
                Link de pagamento
              </a>
            )}
            {success.charges.pixCopyPasteKey && (
              <div className="mt-2">
                <div className="font-semibold">PIX copia e cola:</div>
                <div className="font-ticket break-all bg-creme-200 border border-ferro-200 rounded-lg p-2 mt-1">{success.charges.pixCopyPasteKey}</div>
              </div>
            )}
            {success.charges.pixQrCodeImage && (
              <img
                src={success.charges.pixQrCodeImage}
                alt="QR Code PIX"
                className="mt-2 w-48 h-48 object-contain bg-creme-50 border border-ferro-200 p-2 rounded-lg"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
