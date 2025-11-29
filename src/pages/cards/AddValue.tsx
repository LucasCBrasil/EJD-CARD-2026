import React, { useState } from 'react'
import { Button, Header, ConfirmationModal } from '../../components/shared'
import { useToastContext } from '../../contexts/ToastContext'
import { useSupabaseData } from '../../contexts/SupabaseDataContext'
import { Card } from '../../types'

interface AddValueProps {
  onBack?: () => void
}

const AddValue: React.FC<AddValueProps> = ({ onBack: _onBack }) => {
  const { getCardByNumber, updateCardBalance } = useSupabaseData()
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [amount, setAmount] = useState('')
  const [formattedAmount, setFormattedAmount] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showSuccess } = useToastContext()

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

  const handleCardNumberChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/\s+/g, '')
    setCardNumber(value)
    setError(null)
    setSelectedCard(null)
    
    if (value.length >= 3) {
      try {
        const foundCard = await getCardByNumber(value)
        setSelectedCard(foundCard)
      } catch (err: any) {
        setError(err?.message || 'Erro ao buscar cartão')
      }
    }
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
      
      setAmount('')
      setFormattedAmount('')
      setCardNumber('')
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
              {/* Número do Cartão */}
              <div>
                <label htmlFor="cardNumber" className="block text-sm font-semibold text-black mb-2">
                  💳 Número do Cartão
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  id="cardNumber"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  required
                  className="w-full px-4 py-3 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90"
                  placeholder="001"
                  maxLength={3}
                />
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