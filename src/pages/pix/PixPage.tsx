import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from '@tanstack/react-router'
import { Button, CurrencyInput, CpfCnpjInput, isValidCpfCnpj, TrainLoader } from '../../components/shared'
import { useAuth } from '../../contexts/AuthContext'

// ============================================
// Constantes
// ============================================
const PIX_FEE = 0.99 // Taxa fixa do Asaas por transação
const MIN_AMOUNT = 5.00 // Valor mínimo permitido pelo Asaas

// ============================================
// Tipos
// ============================================
interface PixFormData {
  amount: number // Valor numérico em reais
  cpfCnpj: string // Apenas dígitos
}

interface PixPaymentData {
  paymentId: string
  pixCode: string
  qrCodeUrl: string
  amount: number
  status: 'pending' | 'confirmed' | 'failed'
}

type PageState = 'form' | 'loading' | 'payment' | 'success' | 'error'

// ============================================
// Helpers
// ============================================
function getSupabaseFunctionsUrl(): string {
  const envFunctionsUrl = (import.meta as any).env?.VITE_SUPABASE_FUNCTIONS_URL
  const envSupabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
  if (envFunctionsUrl) return envFunctionsUrl
  if (envSupabaseUrl) return `${envSupabaseUrl}/functions/v1`
  return '/functions/v1'
}

// ============================================
// Componente Principal
// ============================================
export const PixPage: React.FC = () => {
  const { user } = useAuth()
  const navigate = useNavigate()
  const params = useParams({ strict: false }) as { paymentId?: string }
  
  // Estados
  const [pageState, setPageState] = useState<PageState>('form')
  const [formData, setFormData] = useState<PixFormData>({
    amount: 0,
    cpfCnpj: '',
  })
  const [paymentData, setPaymentData] = useState<PixPaymentData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pixEnabled, setPixEnabled] = useState<boolean | null>(null) // null = carregando
  const [isLoadingFlags, setIsLoadingFlags] = useState(true)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  // Valores calculados (garantir que são números)
  const amountValue = typeof formData.amount === 'number' ? formData.amount : 0
  const totalWithFee = amountValue + PIX_FEE
  const isValidAmount = amountValue >= MIN_AMOUNT
  const cpfCnpjValidation = isValidCpfCnpj(formData.cpfCnpj)
  const isFormValid = isValidAmount && cpfCnpjValidation.valid && !!user?.id

  // Carregar feature flag do PIX
  useEffect(() => {
    loadPixFlag()
  }, [])

  const loadPixFlag = async () => {
    setIsLoadingFlags(true)
    try {
      const functionsBase = getSupabaseFunctionsUrl()
      const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
      
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (anonKey) headers['apikey'] = anonKey

      const res = await fetch(`${functionsBase}/feature-flags?key=pix_enabled`, { headers })
      const json = await res.json()
      
      if (json.success && json.data) {
        setPixEnabled(json.data.enabled)
      } else {
        setPixEnabled(true) // Default: habilitado se não encontrar
      }
    } catch (err) {
      console.error('Erro ao carregar feature flag:', err)
      setPixEnabled(true) // Default: habilitado em caso de erro
    } finally {
      setIsLoadingFlags(false)
    }
  }

  // Se tem paymentId na URL, carregar status
  useEffect(() => {
    if (params.paymentId && params.paymentId !== 'new') {
      loadPaymentStatus(params.paymentId)
    }
  }, [params.paymentId])

  // Cleanup do polling
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  const loadPaymentStatus = async (paymentId: string) => {
    setPageState('payment')
    
    try {
      const { api } = await import('../../lib/api-client')
      const response = await api.getPixPaymentStatus(paymentId)
      
      if (response.success && response.data) {
        const status = response.data.status?.toLowerCase() as 'pending' | 'confirmed' | 'failed'
        
        setPaymentData({
          paymentId,
          pixCode: '', // Não temos mais após sair da página
          qrCodeUrl: '',
          amount: Number(response.data.amount),
          status,
        })

        if (status === 'confirmed') {
          setPageState('success')
          stopPolling()
        } else if (status === 'failed') {
          setPageState('error')
          setError('Pagamento falhou ou foi cancelado')
          stopPolling()
        } else {
          // Continuar polling
          startPolling(paymentId)
        }
      } else {
        setError('Pagamento não encontrado')
        setPageState('error')
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar pagamento')
      setPageState('error')
    }
  }

  const generatePix = async () => {
    setError(null)

    // Verificar se PIX está habilitado
    if (!pixEnabled) {
      setError('O abastecimento via PIX está temporariamente desabilitado.')
      return
    }

    setPageState('loading')

    // Validações
    if (!isValidAmount) {
      setError(`Valor mínimo é R$ ${MIN_AMOUNT.toFixed(2).replace('.', ',')}`)
      setPageState('form')
      return
    }

    if (!cpfCnpjValidation.valid) {
      setError(`${cpfCnpjValidation.type === 'cpf' ? 'CPF' : cpfCnpjValidation.type === 'cnpj' ? 'CNPJ' : 'CPF/CNPJ'} inválido. Verifique os dígitos.`)
      setPageState('form')
      return
    }

    if (!user?.id) {
      setError('É necessário estar autenticado para adicionar saldo')
      setPageState('form')
      return
    }

    const cpf = formData.cpfCnpj // Já está apenas com dígitos

    try {
      const functionsBase = getSupabaseFunctionsUrl()
      const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY
      
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (anonKey) headers['apikey'] = anonKey

      // IMPORTANTE: O valor cobrado no PIX inclui a taxa
      // O usuário paga: valor desejado + taxa
      // O valor creditado na conta será o valor desejado (a taxa fica com o Asaas).
      const pixAmount = totalWithFee

      const res = await fetch(`${functionsBase}/asaas-pix`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: user?.name || 'Cliente EJD',
          email: user?.email,
          cpfCnpj: cpf,
          amount: pixAmount, // Valor total com taxa
          creditAmount: amountValue,
          description: `Crédito via PIX (R$ ${amountValue.toFixed(2)} + R$ ${PIX_FEE.toFixed(2)} taxa)`,
          userId: user?.id,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json?.error || `Erro ${res.status}`)
      }

      const pixCode = json?.charges?.pixCopyPasteKey || json?.raw?.pixCopyPasteKey || ''
      const qrCodeUrl = json?.charges?.pixQrCodeImage || json?.raw?.pixQrCodeImage || ''

      setPaymentData({
        paymentId: json.paymentId,
        pixCode,
        qrCodeUrl,
        amount: amountValue, // Valor que será creditado (sem taxa)
        status: 'pending',
      })

      // Atualizar URL com o paymentId
      navigate({ to: '/pix/$paymentId', params: { paymentId: json.paymentId } })
      
      setPageState('payment')
      startPolling(json.paymentId)

    } catch (err: any) {
      setError(err?.message || 'Erro ao gerar PIX')
      setPageState('form')
    }
  }

  const startPolling = (paymentId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current)

    const checkStatus = async () => {
      try {
        const { api } = await import('../../lib/api-client')
        const response = await api.getPixPaymentStatus(paymentId)
        
        if (response.success && response.data) {
          const status = response.data.status?.toLowerCase()
          
          if (status === 'confirmed') {
            setPaymentData(prev => prev ? { ...prev, status: 'confirmed' } : null)
            setPageState('success')
            stopPolling()
          } else if (status === 'failed' || status === 'cancelled') {
            setPaymentData(prev => prev ? { ...prev, status: 'failed' } : null)
            setPageState('error')
            setError('Pagamento falhou ou foi cancelado')
            stopPolling()
          }
        }
      } catch (err) {
        console.error('Erro no polling:', err)
      }
    }

    checkStatus()
    pollingRef.current = setInterval(checkStatus, 5000)
  }

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }

  const copyPixCode = () => {
    if (paymentData?.pixCode) {
      navigator.clipboard.writeText(paymentData.pixCode)
      alert('Código PIX copiado!')
    }
  }

  const goBack = () => {
    stopPolling()
    navigate({ to: '/account' })
  }

  // ============================================
  // Renderização
  // ============================================
  
  // Formulário inicial
  if (pageState === 'form') {
    // Carregando flags
    if (isLoadingFlags) {
      return (
        <div className="max-w-md mx-auto">
          <div className="painel p-8">
            <TrainLoader fullScreen={false} title="Carregando..." message="Preparando o guichê do PIX" />
          </div>
        </div>
      )
    }

    // PIX desabilitado - redireciona silenciosamente
    if (pixEnabled === false) {
      navigate({ to: '/account' })
      return null
    }

    return (
      <div className="max-w-md mx-auto">
        <div className="painel p-5 sm:p-6 text-ferro-900">
          <div className="text-center mb-5">
            <div className="text-5xl mb-2">⛽</div>
            <p className="text-xs font-display uppercase tracking-[0.2em] text-vagao-600">Crédito na conta</p>
            <h1 className="text-2xl font-display font-semibold uppercase tracking-wide text-ferro-900">
              Adicionar saldo via PIX
            </h1>
            <p className="text-ferro-600 text-sm mt-1">
              Gere um código PIX para adicionar créditos
            </p>
            <div className="trilho w-full mt-4" />
          </div>

          <div className="space-y-4">
              {/* Conta que receberá o crédito */}
              <div className="bilhete px-5 py-4">
                <p className="text-xs font-display uppercase tracking-[0.2em] text-ferro-500">Conta que receberá o crédito</p>
                <p className="font-bold text-lg text-ferro-900">{user?.name || 'Minha Conta'}</p>
                <p className="text-sm text-ferro-700">{user?.email}</p>
              </div>

              {/* Campo Valor */}
              <div>
                <label className="block text-sm font-semibold text-ferro-900 mb-2">
                  Quanto quer adicionar à sua conta?
                </label>
                <CurrencyInput
                  value={formData.amount}
                  onChange={(value) => setFormData(prev => ({ ...prev, amount: value }))}
                  min={MIN_AMOUNT}
                  placeholder="0,00"
                  aria-label="Valor a adicionar"
                />
                <p className="text-xs text-ferro-500 mt-1">
                  Mínimo: R$ {MIN_AMOUNT.toFixed(2).replace('.', ',')}
                </p>
              </div>

              {/* Resumo do Valor com Taxa */}
              {amountValue > 0 && (
                <div className="bg-creme-200 rounded-xl p-4 border border-ferro-200">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-ferro-700">Valor para sua conta:</span>
                      <span className="font-semibold text-ferro-900">
                        R$ {amountValue.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-ferro-700">Taxa de transação:</span>
                      <span className="font-semibold text-latao-700">
                        + R$ {PIX_FEE.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                    <div className="picote-horizontal" />
                    <div className="flex justify-between items-baseline">
                      <span className="font-bold text-ferro-900">Total a pagar no PIX:</span>
                      <span className="font-slab text-xl text-vagao-600">
                        R$ {totalWithFee.toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Campo CPF/CNPJ */}
              <div>
                <label className="block text-sm font-semibold text-ferro-900 mb-2">
                  CPF/CNPJ do Pagador
                </label>
                <CpfCnpjInput
                  value={formData.cpfCnpj}
                  onChange={(value) => setFormData(prev => ({ ...prev, cpfCnpj: value }))}
                  placeholder="000.000.000-00"
                  aria-label="CPF ou CNPJ do pagador"
                />
                {formData.cpfCnpj.length > 0 && !cpfCnpjValidation.valid && (
                  <p className="text-xs text-latao-700 mt-1">
                    {formData.cpfCnpj.length < 11 
                      ? `Faltam ${11 - formData.cpfCnpj.length} dígitos para CPF`
                      : formData.cpfCnpj.length < 14
                        ? `Faltam ${14 - formData.cpfCnpj.length} dígitos para CNPJ`
                        : 'CPF/CNPJ inválido'
                    }
                  </p>
                )}
                {cpfCnpjValidation.valid && (
                  <p className="text-xs text-green-700 mt-1">
                    ✓ {cpfCnpjValidation.type === 'cpf' ? 'CPF' : 'CNPJ'} válido
                  </p>
                )}
              </div>

              {/* Erro */}
              {error && (
                <div className="bg-vagao-50 text-vagao-700 rounded-xl p-4 border border-vagao-200">
                  {error}
                </div>
              )}

              {/* Botões */}
              <div className="space-y-3 pt-2">
                <Button
                  onClick={generatePix}
                  size="lg"
                  className="w-full !bg-vagao-600 hover:!bg-vagao-700 !text-creme-50 !border-vagao-600 uppercase"
                  disabled={!isFormValid}
                >
                  {isValidAmount 
                    ? `Gerar PIX de R$ ${totalWithFee.toFixed(2).replace('.', ',')}`
                    : 'Informe um valor válido'
                  }
                </Button>
                <Button
                  onClick={goBack}
                  variant="secondary"
                  className="w-full"
                >
                  ← Voltar
                </Button>
              </div>

              {/* Info sobre a taxa */}
              <p className="text-xs text-center text-ferro-500">
                A taxa de R$ {PIX_FEE.toFixed(2).replace('.', ',')} é cobrada pela plataforma de pagamentos (Asaas).
              </p>
          </div>
        </div>
      </div>
    )
  }

  // Loading
  if (pageState === 'loading') {
    return (
      <div className="max-w-md mx-auto">
        <div className="painel p-8">
          <TrainLoader fullScreen={false} title="Gerando PIX..." message="Aguarde um momento" />
        </div>
      </div>
    )
  }

  // Aguardando Pagamento
  if (pageState === 'payment' && paymentData) {
    const paymentTotal = paymentData.amount + PIX_FEE
    
    return (
      <div className="max-w-md mx-auto">
        <div className="painel p-5 sm:p-6 text-ferro-900">
          <div className="text-center mb-6">
            <div className="text-5xl mb-2">🚉</div>
            <h1 className="text-xl font-display font-semibold uppercase tracking-wide text-ferro-900">Aguardando Pagamento</h1>
            
            {/* Valores */}
            <div className="bilhete mt-4 px-5 py-4">
              <p className="text-xs font-display uppercase tracking-[0.2em] text-ferro-500 mb-1">Valor do PIX</p>
              <p className="text-3xl font-slab text-vagao-600">
                R$ {paymentTotal.toFixed(2).replace('.', ',')}
              </p>
              <p className="text-xs text-ferro-600 mt-2">
                (R$ {paymentData.amount.toFixed(2).replace('.', ',')} para sua conta + R$ {PIX_FEE.toFixed(2).replace('.', ',')} taxa)
              </p>
            </div>
          </div>

          {/* QR Code */}
          {paymentData.qrCodeUrl && (
            <div className="flex justify-center mb-6">
              <div className="p-4 rounded-xl border-2 border-ferro-800 shadow-bilhete" style={{ backgroundColor: '#ffffff' }}>
                <img 
                  src={`data:image/png;base64,${paymentData.qrCodeUrl}`}
                  alt="QR Code PIX"
                  className="w-48 h-48"
                />
              </div>
            </div>
          )}

          {/* Código Copia e Cola */}
          {paymentData.pixCode && (
            <div className="mb-6">
              <p className="text-sm font-semibold text-ferro-800 mb-2 text-center">
                Ou copie o código:
              </p>
              <div className="bg-creme-100 rounded-xl p-3 border border-ferro-200 max-h-20 overflow-auto">
                <p className="text-xs font-ticket text-ferro-700 break-all">
                  {paymentData.pixCode}
                </p>
              </div>
              <Button
                onClick={copyPixCode}
                className="w-full mt-3"
              >
                📋 Copiar Código PIX
              </Button>
            </div>
          )}

          {/* Status */}
          <div className="bg-latao-50 rounded-xl p-4 border border-latao-300 mb-4">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin w-4 h-4 border-2 border-latao-600 border-t-transparent rounded-full"></div>
              <p className="text-latao-800 font-medium">Verificando pagamento...</p>
            </div>
          </div>

          {/* Instruções */}
          <div className="bg-anil-100/60 rounded-xl p-4 border border-anil-200 mb-4">
            <p className="text-sm text-anil-800">
              <strong>Instruções:</strong><br/>
              1. Abra o app do seu banco<br/>
              2. Escaneie o QR Code ou cole o código<br/>
              3. Confirme o pagamento<br/>
              4. O saldo será creditado automaticamente
            </p>
          </div>

          <Button
            onClick={goBack}
            variant="secondary"
            className="w-full"
          >
            ← Cancelar e Voltar
          </Button>
        </div>
      </div>
    )
  }

  // Sucesso
  if (pageState === 'success') {
    return (
      <div className="max-w-md mx-auto">
        <div className="painel p-8 text-center text-ferro-900">
          <div className="text-6xl mb-3">🚂</div>
          <span className="carimbo text-sm text-green-700 mb-3">✓ Confirmado</span>
          <h1 className="text-2xl font-display font-semibold uppercase tracking-wide text-green-800 mb-2 mt-2">
            Pagamento Confirmado!
          </h1>
          <p className="text-ferro-700 mb-6">
            Seu saldo foi atualizado com sucesso.
          </p>
          {paymentData && (
            <p className="text-3xl font-slab text-green-700 mb-6">
              + R$ {paymentData.amount.toFixed(2).replace('.', ',')}
            </p>
          )}
          <Button
            onClick={goBack}
            size="lg"
            className="w-full"
          >
            ✓ Voltar para Minha Conta
          </Button>
        </div>
      </div>
    )
  }

  // Erro
  if (pageState === 'error') {
    return (
      <div className="max-w-md mx-auto">
        <div className="painel p-8 text-center text-ferro-900">
          <div className="text-6xl mb-3">🚧</div>
          <h1 className="text-2xl font-display font-semibold uppercase tracking-wide text-vagao-700 mb-2">
            Erro no Pagamento
          </h1>
          <p className="text-ferro-700 mb-6">
            {error || 'Ocorreu um erro. Tente novamente.'}
          </p>
          <div className="space-y-3">
            <Button
              onClick={() => {
                setError(null)
                setPageState('form')
                navigate({ to: '/pix/$paymentId', params: { paymentId: 'new' } })
              }}
              size="lg"
              className="w-full !bg-vagao-600 hover:!bg-vagao-700 !text-creme-50 !border-vagao-600"
            >
              Tentar Novamente
            </Button>
            <Button
              onClick={goBack}
              variant="secondary"
              className="w-full"
            >
              ← Voltar
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default PixPage
