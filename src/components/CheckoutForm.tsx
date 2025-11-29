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
    <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white shadow-xl rounded-xl border border-gray-100 p-8">
        <h1 className="text-2xl font-semibold text-emerald-700 mb-6">Checkout EJD Card</h1>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm font-medium text-gray-700">
              Nome completo
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              CPF/CNPJ
              <input
                inputMode="numeric"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                required
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Telefone
              <input
                inputMode="numeric"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border px-3 py-2"
              />
            </label>
          </div>

          <label className="text-sm font-medium text-gray-700 block">
            Valor (R$)
            <input
              type="number"
              inputMode="numeric"
              min={1}
              step={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              required
              className="mt-1 w-full rounded-lg border px-3 py-2"
            />
          </label>

          <div className="flex gap-2">
            {(['PIX', 'BOLETO', 'CREDIT_CARD'] as BillingType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setBillingType(type)}
                className={`px-4 py-2 rounded-lg border ${
                  billingType === type
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                {type}
              </button>
            ))}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-60 transition"
          >
            {loading ? 'Processando...' : 'Gerar pagamento'}
          </button>
        </form>

        {error && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 p-3 rounded-lg">
            {error}
          </div>
        )}

        {success && (
          <div className="mt-4 bg-emerald-50 border border-emerald-100 p-4 rounded-lg space-y-2 text-sm">
            <div className="font-semibold text-emerald-700">Pagamento criado!</div>
            <div>Status: {success.status}</div>
            {success.charges.bankSlipUrl && (
              <a className="text-emerald-700 underline" href={success.charges.bankSlipUrl} target="_blank" rel="noreferrer">
                Ver boleto
              </a>
            )}
            {success.charges.invoiceUrl && (
              <a className="text-emerald-700 underline" href={success.charges.invoiceUrl} target="_blank" rel="noreferrer">
                Link de pagamento
              </a>
            )}
            {success.charges.pixCopyPasteKey && (
              <div className="mt-2">
                <div className="font-medium">PIX copia e cola:</div>
                <div className="font-mono break-all">{success.charges.pixCopyPasteKey}</div>
              </div>
            )}
            {success.charges.pixQrCodeImage && (
              <img
                src={success.charges.pixQrCodeImage}
                alt="QR Code PIX"
                className="mt-2 w-48 h-48 object-contain bg-white p-2 rounded-lg"
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
