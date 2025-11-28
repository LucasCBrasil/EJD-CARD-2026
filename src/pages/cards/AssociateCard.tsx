import React, { useState } from 'react'
import { useSupabaseData } from '../../contexts/SupabaseDataContext'
import { Button } from '../../components/shared'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { cardKeys } from '../../hooks/useCards'

const AssociateCard: React.FC = () => {
  const dataCtx: any = useSupabaseData()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [cardNumber, setCardNumber] = useState('')
  const [cardCode, setCardCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)
    try {
      await dataCtx.associateCard({ cardNumber, cardCode })
      // Invalidar todas as queries de cartões para atualizar o cache
      await queryClient.invalidateQueries({ queryKey: cardKeys.all })
      // Forçar refetch de todas as queries relacionadas a cartões
      await queryClient.refetchQueries({ queryKey: cardKeys.all })
      // Aguardar um pouco para garantir que as queries sejam atualizadas
      await new Promise(resolve => setTimeout(resolve, 500))
      navigate({ to: '/mycard' as any })
    } catch (err: any) {
      // Extrair mensagem de erro completa de diferentes formatos
      const errorMessage = err?.message || err?.error || err?.toString() || 'Erro ao associar cartão'
      setError(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-6">
      <h2 className="text-2xl font-bold text-black mb-4 text-center">🔗 Associar Cartão</h2>
      <p className="text-gray-600 text-sm mb-6 text-center">Digite o número e o código do cartão para vinculá-lo à sua conta.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-black mb-2">Número do Cartão</label>
          <input
            value={cardNumber}
            onChange={(e) => setCardNumber(e.target.value.replace(/\s+/g, ''))}
            placeholder="Digite o número"
            className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 bg-white/90"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-black mb-2">Código do Cartão</label>
          <input
            value={cardCode}
            onChange={(e) => setCardCode(e.target.value.replace(/\s+/g, ''))}
            placeholder="Digite o código"
            className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 bg-white/90"
            required
          />
        </div>
        {error && (
          <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
            <div className="flex items-start">
              <span className="text-red-500 text-xl mr-2">⚠️</span>
              <div className="flex-1">
                <p className="text-red-800 font-semibold mb-1">Erro ao associar cartão</p>
                <p className="text-red-700 text-sm whitespace-pre-wrap">{error}</p>
              </div>
            </div>
          </div>
        )}
        <Button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-600 text-black" disabled={isLoading}>
          {isLoading ? 'Associando...' : 'Associar Cartão'}
        </Button>
      </form>
    </div>
  )
}

export default AssociateCard

