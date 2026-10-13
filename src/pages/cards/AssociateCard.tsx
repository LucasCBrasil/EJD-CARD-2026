import React, { useState, useMemo } from 'react'
import { useSupabaseData } from '../../contexts/SupabaseDataContext'
import { Button } from '../../components/shared'
import { useNavigate } from '@tanstack/react-router'

const AssociateCard: React.FC = () => {
  const dataCtx: any = useSupabaseData()
  const navigate = useNavigate()
  const [cardNumber, setCardNumber] = useState('')
  const [cardCode, setCardCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Normalizar número do cartão para preview
  const normalizedCardNumber = useMemo(() => {
    if (!cardNumber) return ''
    const asNumber = parseInt(cardNumber, 10)
    if (isNaN(asNumber)) return cardNumber
    return asNumber.toString().padStart(3, '0')
  }, [cardNumber])

  // Mostrar preview de normalização se diferente
  const showNumberNormalization = cardNumber && normalizedCardNumber !== cardNumber

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      await dataCtx.associateCard({ cardNumber, cardCode })
      // Simplesmente navegar para MyCardPage - ela usa getMyCardHistory() que busca os dados diretamente
      navigate({ to: '/mycard' as any })
    } catch (err: any) {
      // Extrair mensagem de erro completa de diferentes formatos
      const errorMessage = err?.message || err?.error || err?.toString() || 'Erro ao associar cartão'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const inputClass = 'w-full px-4 py-3 border-2 border-ferro-200 rounded-xl bg-creme-50 text-ferro-900 focus:border-ferro-500 focus:ring-2 focus:ring-ferro-200 transition-colors duration-200'

  return (
    <div className="max-w-md mx-auto painel p-5 md:p-6">
      <div className="text-center mb-5">
        <h2 className="text-2xl font-semibold text-ferro-900 font-display uppercase tracking-wide">🔗 Associar Cartão</h2>
        <p className="text-ferro-600 text-sm mt-1">Digite o número e o código do cartão para vinculá-lo à sua conta.</p>
        <div className="trilho w-full max-w-[200px] mx-auto mt-3" />
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-ferro-900 mb-2">🎫 Número do Cartão</label>
          <input
            inputMode="numeric"
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value.replace(/\s+/g, ''))}
            placeholder="Ex: 063 ou 63"
            className={`${inputClass} font-ticket tracking-widest`}
            required
          />
          {showNumberNormalization && (
            <p className="text-xs text-ferro-600 mt-1">
              ✓ Será buscado como: <span className="font-ticket font-bold text-ferro-900">{normalizedCardNumber}</span>
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm font-semibold text-ferro-900 mb-2">🔑 Código do Cartão</label>
          <input
            value={cardCode}
            onChange={(e) => setCardCode(e.target.value.replace(/\s+/g, ''))}
            placeholder="Digite o código (maiúsculo ou minúsculo)"
            className={`${inputClass} font-ticket`}
            required
          />
          {cardCode && (
            <p className="text-xs text-ferro-500 mt-1">
              Aceita maiúsculas e minúsculas
            </p>
          )}
        </div>
        {error && (
          <div className="bg-vagao-50 border-2 border-vagao-300 rounded-xl p-4">
            <div className="flex items-start">
              <span className="text-vagao-600 text-xl mr-2">⚠️</span>
              <div className="flex-1">
                <p className="text-vagao-800 font-semibold mb-1">Erro ao associar cartão</p>
                <p className="text-vagao-700 text-sm whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          </div>
        )}
        <Button type="submit" size="lg" className="w-full !bg-vagao-600 hover:!bg-vagao-700 !border-vagao-600 !text-creme-50" disabled={isLoading}>
          {isLoading ? 'Associando...' : '🔗 Associar Cartão'}
        </Button>
      </form>
    </div>
  )
}

export default AssociateCard
