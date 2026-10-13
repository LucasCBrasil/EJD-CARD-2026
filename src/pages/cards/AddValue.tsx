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

  // Normaliza número do cartão para 3 dígitos
  // Ex: "0073" -> "073", "73" -> "073", "7" -> "007"
  const normalizeCardNumber = (value: string) => {
    const num = parseInt(value, 10)
    if (isNaN(num)) return value
    return num.toString().padStart(3, '0')
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

  const inputClass = 'w-full px-4 py-3 border-2 border-ferro-200 rounded-xl bg-creme-50 text-ferro-900 focus:border-ferro-500 focus:ring-2 focus:ring-ferro-200 transition-colors duration-200'

  return (
    <div className="space-y-4">
      <Header 
            title="Adicionar Valor"
            subtitle="Adicione crédito ao cartão do encontrista"
            showLogo={false}
        />
      <div className="w-full relative z-10">
        <div className="mx-auto w-full">

          {/* Formulário */}
          <div className="painel p-5 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Busca Unificada - Nome ou Número */}
              <div className="relative" ref={dropdownRef}>
                <label htmlFor="searchQuery" className="block text-sm font-semibold text-ferro-900 mb-2">
                  🔍 Buscar Cartão
                </label>
                <div className="relative">
                  <input
                    type="text"
                    id="searchQuery"
                    value={searchQuery}
                    onChange={handleSearchChange}
                    onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                    className={`${inputClass} pr-11`}
                    placeholder="Nome ou número (ex: João ou 001)"
                    autoComplete="off"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="animate-spin h-5 w-5 border-2 border-ferro-500 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>

                {/* Dropdown de resultados */}
                {showDropdown && searchResults.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-creme-50 border-2 border-ferro-200 rounded-xl shadow-bilhete max-h-60 overflow-y-auto">
                    {searchResults.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => handleSelectCard(card)}
                        className="w-full !px-4 !py-3 text-left hover:bg-creme-200 transition-colors border-b border-ferro-100 last:border-b-0 focus:bg-creme-200 focus:outline-none"
                      >
                        <div className="font-semibold text-ferro-900">{card.userName || 'Sem nome'}</div>
                        <div className="text-sm text-ferro-600 flex justify-between gap-3">
                          <span>Cartão <strong className="font-ticket text-ferro-800">{card.cardNumber}</strong></span>
                          <span>R$ {(card.balance || 0).toFixed(2).replace('.', ',')}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-vagao-50 border-2 border-vagao-300 rounded-xl p-3 text-center">
                  <p className="text-vagao-800 font-semibold text-sm">⚠️ {error}</p>
                </div>
              )}

              {/* Valor a ser adicionado */}
              <div>
                <label htmlFor="amount" className="block text-sm font-semibold text-ferro-900 mb-2">
                  💰 Valor a Adicionar (R$)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  id="amount"
                  value={formattedAmount}
                  onChange={handleAmountChange}
                  required
                  className={`${inputClass} font-slab text-xl`}
                  placeholder="0,00"
                />
              </div>

              {/* Informações do cartão selecionado */}
              {selectedCard && (
                <div className="bg-creme-200 border border-ferro-200 rounded-xl p-4 space-y-2 animate-fade-in">
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="font-display text-sm uppercase tracking-wider text-ferro-700">🎫 Cartão Selecionado</h4>
                    <span className="font-ticket font-bold text-ferro-900">Nº {formatCardNumber(selectedCard.cardNumber || '')}</span>
                  </div>
                  <p className="text-ferro-900 font-semibold">{selectedCard.userName || 'Sem nome'}</p>
                  <div className="picote-horizontal pt-2 flex justify-between items-baseline">
                    <span className="text-sm text-ferro-600">Saldo atual</span>
                    <span className="font-slab text-ferro-900">R$ {(selectedCard.balance || 0).toFixed(2).replace('.', ',')}</span>
                  </div>
                  {amount && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-sm text-ferro-600">Novo saldo</span>
                      <span className="font-slab text-lg text-green-700">
                        R$ {((selectedCard.balance || 0) + parseFloat(amount || '0')).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Botão de Adicionar */}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isLoading || !selectedCard}
              >
                {isLoading ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⚙️</span>
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
