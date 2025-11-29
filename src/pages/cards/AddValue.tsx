import React, { useState, useRef, useEffect } from 'react'
import { Button, Header, ConfirmationModal } from '../../components/shared'
import { useToastContext } from '../../contexts/ToastContext'
import { useSupabaseData } from '../../contexts/SupabaseDataContext'
import { Card } from '../../types'

interface AddValueProps {
  onBack?: () => void
}

const AddValue: React.FC<AddValueProps> = ({ onBack: _onBack }) => {
  const { getCardByNumber, searchCardsByName, updateCardBalance } = useSupabaseData()
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [amount, setAmount] = useState('')
  const [formattedAmount, setFormattedAmount] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showSuccess } = useToastContext()

  // Estados para busca unificada
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Card[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const formatCurrency = (value: string) => {
    // Remove tudo que não é número
    const numbers = value.replace(/\D/g, '')
    
    if (numbers === '') {
      return ''
    }
    
    // Converte para centavos e depois para reais
    const cents = parseInt(numbers)
    const reais = cents / 100
    
    // Formata com vírgula decimal
    return reais.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    const formatted = formatCurrency(value)
    setFormattedAmount(formatted)
    
    // Remove tudo que não é número e converte para centavos
    const numbers = value.replace(/\D/g, '')
    if (numbers === '') {
      setAmount('0')
    } else {
      const cents = parseInt(numbers)
      setAmount((cents / 100).toString())
    }
  }

  // Detecta se a busca é por número (só dígitos) ou por nome
  const isNumberSearch = (value: string) => /^\d+$/.test(value.trim())

  // Normaliza número do cartão - remove zeros à esquerda
  // Ex: "0639" -> "639", "0032" -> "32", "001" -> "1"
  const normalizeCardNumber = (value: string) => {
    const num = parseInt(value, 10)
    return isNaN(num) ? value : num.toString()
  }

  // Busca unificada - detecta automaticamente se é número ou nome
  const handleSearchChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchQuery(value)
    setError(null)
    setSelectedCard(null)
    setShowDropdown(false)

    // Limpar timeout anterior
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    const trimmedValue = value.trim()
    if (trimmedValue.length < 2) {
      setSearchResults([])
      return
    }

    // Se for só números e tiver 3 ou 4 dígitos, busca direta por número
    // Normaliza removendo zeros à esquerda (0639 -> 639)
    if (isNumberSearch(trimmedValue) && trimmedValue.length >= 3 && trimmedValue.length <= 4) {
      setIsSearching(true)
      try {
        const normalizedNumber = normalizeCardNumber(trimmedValue)
        const foundCard = await getCardByNumber(normalizedNumber)
        if (foundCard) {
          setSelectedCard(foundCard)
          setSearchResults([])
          setError(null) // Limpar erro ao encontrar cartão
        } else {
          setSelectedCard(null) // Limpar cartão anterior
          setSearchResults([])
          setError('Cartão não encontrado')
        }
      } catch (err: any) {
        setSelectedCard(null) // Limpar cartão anterior
        setError(err?.message || 'Erro ao buscar cartão')
      } finally {
        setIsSearching(false)
      }
      return
    }

    // Debounce de 300ms para busca por nome
    searchTimeoutRef.current = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await searchCardsByName(trimmedValue)
        setSearchResults(results)
        setShowDropdown(results.length > 0)
        if (results.length === 0) {
          setError('Nenhum cartão encontrado')
        }
      } catch (err: any) {
        setError(err?.message || 'Erro ao buscar cartões')
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 300)
  }

  // Selecionar cartão do dropdown
  const handleSelectCard = (card: Card) => {
    setSelectedCard(card)
    setSearchQuery(card.userName || '')
    setShowDropdown(false)
    setSearchResults([])
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedCard) return

    // Mostrar janela de confirmação
    setShowConfirmation(true)
  }

  const handleConfirmAddValue = async () => {
    if (!selectedCard) return

    setIsLoading(true)
    setShowConfirmation(false)
    
    try {
      await updateCardBalance(selectedCard.id, parseFloat(amount), 'credit', 'Crédito adicionado')
      
      showSuccess(
        'Valor Adicionado!',
        `R$ ${formattedAmount} foi adicionado ao cartão ${selectedCard.cardNumber} de ${selectedCard.userName || 'usuário'} com sucesso.`
      )
      
      // Resetar todos os campos
      setAmount('')
      setFormattedAmount('')
      setSearchQuery('')
      setSearchResults([])
      setShowDropdown(false)
      setSelectedCard(null)
    } catch (err: any) {
      setError(err?.message || 'Erro ao adicionar valor')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelConfirmation = () => {
    setShowConfirmation(false)
  }

  const formatCardNumber = (number: string) => {
    return number.replace(/(\d{4})(?=\d)/g, '$1 ')
  }

  return (
    <div className="space-y-4">
      <Header 
            title="Adicionar Valor"
            subtitle="Adicione crédito ao seu cartão mágico"
            showLogo={false}
        />
      <div className="w-full relative z-10">
        <div className="mx-auto w-full">

          {/* Formulário */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Busca Unificada - Nome ou Número */}
              <div className="relative" ref={dropdownRef}>
                <label htmlFor="searchQuery" className="block text-sm font-semibold text-black mb-2">
                  🔍 Buscar Cartão
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="searchQuery"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90"
                    placeholder="Nome ou número do cartão (ex: João ou 001)"
                    autoComplete="off"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>

                {/* Dropdown de resultados */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-emerald-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => handleSelectCard(card)}
                        className="w-full px-4 py-3 text-left hover:bg-emerald-50 transition-colors border-b border-gray-100 last:border-b-0 focus:bg-emerald-100 focus:outline-none"
                      >
                        <div className="font-medium text-gray-900">{card.userName || 'Sem nome'}</div>
                        <div className="text-sm text-gray-500 flex justify-between">
                          <span>Cartão: <strong>{card.cardNumber}</strong></span>
                          <span>Saldo: R$ {(card.balance || 0).toFixed(2).replace('.', ',')}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-red-100 border border-red-300 rounded-lg p-4 text-center">
                  <p className="text-red-800">{error}</p>
                </div>
              )}

              {/* Valor a ser adicionado */}
              <div>
                <label htmlFor="amount" className="block text-sm font-semibold text-black mb-2">
                  💰 Valor a Adicionar (R$)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  id="amount"
                  value={formattedAmount}
                  onChange={handleAmountChange}
                  required
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90"
                  placeholder="0,00"
                />
              </div>

              {/* Informações do cartão selecionado */}
              {selectedCard && (
                <div className="bg-gradient-to-r from-emerald-100 to-emerald-200 rounded-xl p-4">
                  <h4 className="font-semibold text-black mb-2">📋 Cartão Selecionado</h4>
                  <p className="text-black"><strong>Nome:</strong> {selectedCard.userName || 'Sem nome'}</p>
                  <p className="text-black"><strong>Número:</strong> {formatCardNumber(selectedCard.cardNumber || '')}</p>
                  <p className="text-black"><strong>Saldo Atual:</strong> R$ {(selectedCard.balance || 0).toFixed(2).replace('.', ',')}</p>
                  {amount && (
                    <p className="text-black mt-2">
                      <strong>Novo Saldo:</strong> R$ {((selectedCard.balance || 0) + parseFloat(amount || '0')).toFixed(2).replace('.', ',')}
                    </p>
                  )}
                </div>
              )}

              {/* Botão de Adicionar */}
              <Button
                type="submit"
                size="lg"
                className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 !text-black shadow-lg hover:shadow-emerald-200 font-semibold"
                disabled={isLoading || !selectedCard}
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin mr-2">✨</span>
                    Adicionando valor...
                  </>
                ) : (
                  <>
                    💰 Adicionar Valor
                  </>
                )}
              </Button>
            </form>
          </div>

        </div>
      </div>

      {/* Modal de Confirmação */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={handleCancelConfirmation}
        onConfirm={handleConfirmAddValue}
        title="Confirmar Adição de Valor"
        message='Deseja realmente adicionar o valor no cartão?'
        icon="💰"
        card={selectedCard}
        transactionType="credit"
        variant="card-transaction"
        amount={amount}
        formattedAmount={formattedAmount}
        isLoading={isLoading}  
        />
    </div>
  )
}

export default AddValue