import { useState } from 'react'
import { Button } from '../../components/shared'
import { useSupabaseData } from '../../contexts/SupabaseDataContext'
import { Card } from '../../types'

interface CheckBalanceProps {
  onBack?: () => void
}

const CheckBalance: React.FC<CheckBalanceProps> = ({ onBack: _onBack }) => {
  const { getCardByNumber } = useSupabaseData()
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [searchNumber, setSearchNumber] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const handleSearch = async () => {
    setError(null)
    setIsLoading(true)
    setHasSearched(true)
    
    try {
      const card = await getCardByNumber(searchNumber.replace(/\s+/g, ''))
      console.log(card)
      setSelectedCard(card)
      if (!card) {
        setError('Cartão não encontrado')
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao buscar cartão')
      setSelectedCard(null)
    } finally {
      setIsLoading(false)
    }
  }

  const handleInputChange = (value: string) => {
    setSearchNumber(value)
    setSelectedCard(null)
    setHasSearched(false)
    setError(null)
  }

  const formatCardNumber = (number: string) => {
    return number.replace(/(\d{4})(?=\d)/g, '$1 ')
  }

  const handleNewSearch = () => {
    setSearchNumber('')
    setSelectedCard(null)
    setHasSearched(false)
    setError(null)
  }

  return (
    <div className="space-y-3">
      {/* Header compacto */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-ferro-600 font-display">
          💳 Conferir Saldo
        </h1>
      </div>

      <div className="w-full relative z-10">
        <div className="mx-auto w-full">

          {/* Estado: Resultado encontrado */}
          {selectedCard && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-6 animate-fade-in">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-3">
                  <span className="text-2xl">✅</span>
                  <div className="text-left">
                    <p className="font-bold text-black font-display">
                      Cartão #{formatCardNumber(selectedCard.cardNumber || '')}
                    </p>
                    <p className="text-lg text-black font-body">
                      {selectedCard.userName || 'Sem nome'}
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-yellow-100 to-yellow-200 rounded-xl p-5 mb-4">
                  <p className="text-black text-xs mb-1">Saldo Disponível</p>
                  <p className="text-4xl font-bold text-black">
                    R$ {(selectedCard.balance || 0).toFixed(2).replace('.', ',')}
                  </p>
                </div>

                <Button
                  onClick={handleNewSearch}
                  size="lg"
                  className="w-full bg-gradient-to-r from-ferro-500 to-ferro-600 hover:from-ferro-600 hover:to-ferro-700 text-black shadow-lg hover:shadow-ferro-200 font-semibold"
                >
                  🔍 Nova Consulta
                </Button>
              </div>
            </div>
          )}

          {/* Estado: Cartão não encontrado */}
          {hasSearched && !selectedCard && error && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-red-200 p-6 animate-fade-in">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <span className="text-3xl">❌</span>
                  <div className="text-left">
                    <h3 className="font-bold text-red-800 text-lg">
                      Cartão não encontrado
                    </h3>
                    <p className="text-red-600 text-sm">
                      O cartão #{searchNumber} não existe
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleNewSearch}
                  size="lg"
                  className="w-full bg-gradient-to-r from-ferro-500 to-ferro-600 hover:from-ferro-600 hover:to-ferro-700 text-black shadow-lg hover:shadow-ferro-200 font-semibold"
                >
                  🔍 Tentar Novamente
                </Button>
              </div>
            </div>
          )}

          {/* Estado: Formulário de busca (inicial ou digitando) */}
          {!hasSearched && (
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="cardNumber" className="block text-sm font-semibold text-black mb-2">
                    Número do Cartão
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    id="cardNumber"
                    value={searchNumber}
                    onChange={(e) => handleInputChange(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    className="w-full px-4 py-4 border-2 border-ferro-200 rounded-lg focus:border-ferro-500 focus:ring-2 focus:ring-ferro-200 transition-colors duration-200 bg-white/90 text-center text-3xl font-mono"
                    placeholder="001"
                    autoFocus
                  />
                </div>

                <Button
                  onClick={handleSearch}
                  size="lg"
                  className="w-full bg-gradient-to-r from-ferro-500 to-ferro-600 hover:from-ferro-600 hover:to-ferro-700 text-black shadow-lg hover:shadow-ferro-200 font-semibold"
                  disabled={isLoading || !searchNumber}
                >
                  {isLoading ? '🔍 Buscando...' : '🔍 Consultar'}
                </Button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

export default CheckBalance