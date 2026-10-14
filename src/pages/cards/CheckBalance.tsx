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
    <div className="space-y-4">
      {/* Cabeçalho */}
      <div className="text-center">
        <h1 className="text-2xl md:text-3xl font-semibold text-ferro-900 font-display uppercase tracking-wide">
          🔍 Conferir Saldo
        </h1>
        <p className="text-sm text-ferro-600 mt-1">Consulte o saldo de um bilhete</p>
        <div className="trilho w-full max-w-xs mx-auto mt-3" />
      </div>

      <div className="w-full relative z-10">
        <div className="mx-auto w-full">

          {/* Estado: Resultado encontrado */}
          {selectedCard && (
            <div className="painel p-5 md:p-6 animate-fade-in">
              <div className="bilhete overflow-hidden mb-5">
                <div className="bg-caldeira rounded-t-xl px-4 py-2 flex items-center justify-between">
                  <span className="font-display text-xs tracking-[0.25em] uppercase text-creme-200">Bilhete</span>
                  <span className="font-ticket text-lg font-bold text-latao-400">
                    Nº {formatCardNumber(selectedCard.cardNumber || '')}
                  </span>
                </div>
                <div className="px-5 py-4 text-left">
                  <p className="font-display text-[11px] tracking-[0.25em] uppercase text-ferro-500">Passageiro</p>
                  <p className="text-lg font-semibold text-ferro-900 leading-tight">
                    {selectedCard.userName || 'Sem nome'}
                  </p>
                  <div className="picote-horizontal mt-3 pt-3 text-center">
                    <p className="font-display text-[11px] tracking-[0.25em] uppercase text-ferro-500 mb-1">Saldo Disponível</p>
                    <p className={`font-slab text-4xl ${(selectedCard.balance || 0) < 0 ? 'text-vagao-600' : 'text-ferro-900'}`}>
                      R$ {(selectedCard.balance || 0).toFixed(2).replace('.', ',')}
                    </p>
                  </div>
                </div>
              </div>

              <Button
                onClick={handleNewSearch}
                size="lg"
                className="w-full"
              >
                🔍 Nova Consulta
              </Button>
            </div>
          )}

          {/* Estado: Cartão não encontrado */}
          {hasSearched && !selectedCard && error && (
            <div className="painel p-5 md:p-6 animate-fade-in">
              <div className="text-center">
                <p className="carimbo text-vagao-600 text-sm mb-3">✕ Cartão não encontrado</p>
                <p className="text-ferro-700 text-sm mb-5">
                  O cartão <span className="font-ticket font-bold text-ferro-900">#{searchNumber}</span> não existe
                </p>

                <Button
                  onClick={handleNewSearch}
                  size="lg"
                  className="w-full"
                >
                  🔍 Tentar Novamente
                </Button>
              </div>
            </div>
          )}

          {/* Estado: Formulário de busca (inicial ou digitando) */}
          {!hasSearched && (
            <div className="painel p-5 md:p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="cardNumber" className="block text-sm font-semibold text-ferro-900 mb-2 text-center">
                    Número do Cartão
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    id="cardNumber"
                    value={searchNumber}
                    onChange={(e) => handleInputChange(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    className="w-full px-4 py-4 border-2 border-ferro-200 rounded-xl bg-creme-50 text-ferro-900 focus:border-ferro-500 focus:ring-2 focus:ring-ferro-200 transition-colors duration-200 text-center !text-3xl font-ticket font-bold tracking-[0.3em]"
                    placeholder="001"
                    autoFocus
                  />
                </div>

                <Button
                  onClick={handleSearch}
                  size="lg"
                  className="w-full"
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
