import React, { useState } from 'react'
import { Button, Header, ConfirmationModal } from '../../components/shared'
import { useToastContext } from '../../contexts/ToastContext'
import { useSupabaseData } from '../../contexts/SupabaseDataContext'
import { Card } from '../../types'

interface DebitCardProps {
  onBack?: () => void
}

const DebitCard: React.FC<DebitCardProps> = ({ onBack: _onBack }) => {
  const { getCardByNumber, updateCardBalance } = useSupabaseData()
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [amount, setAmount] = useState('')
  const [formattedAmount, setFormattedAmount] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { showSuccess, showError } = useToastContext()

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

    const debitAmount = parseFloat(amount)
    if (debitAmount > (selectedCard.balance || 0)) {
      setError('Saldo insuficiente!')
      return
    }

    // Mostrar janela de confirmação
    setShowConfirmation(true)
  }

  const handleConfirmDebit = async () => {
    if (!selectedCard) return

    const debitAmount = parseFloat(amount)
    if (debitAmount > (selectedCard.balance || 0)) {
      showError(
        'Saldo Insuficiente!',
        'O valor do débito é maior que o saldo disponível no cartão.'
      )
      return
    }

    setIsLoading(true)
    setShowConfirmation(false)
    
    try {
      await updateCardBalance(selectedCard.id, debitAmount, 'debit', description || 'Débito no cartão')
      
      showSuccess(
        'Débito Realizado!',
        `R$ ${formattedAmount} foi debitado do cartão ${selectedCard.cardNumber} de ${selectedCard.userName || 'usuário'} com sucesso.`
      )
      
      setAmount('')
      setFormattedAmount('')
      setCardNumber('')
      setDescription('')
      setSelectedCard(null)
    } catch (err: any) {
      setError(err?.message || 'Erro ao realizar débito')
      showError('Erro ao Debitar', err?.message || 'Não foi possível realizar o débito')
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
            title="Débito em Cartão"
            subtitle="Debite um valor de um cartão mágico"
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
                  className="w-full px-4 py-3 border-2 border-ferro-200 rounded-lg focus:border-ferro-500 focus:ring-2 focus:ring-ferro-200 transition-colors duration-200 bg-white/90"
                  placeholder="001"
                  maxLength={3}
                />
              </div>

              {error && (
                <div className="bg-red-100 border border-red-300 rounded-lg p-4 text-center">
                  <p className="text-red-800">{error}</p>
                </div>
              )}

              {/* Valor do débito */}
              <div>
                <label htmlFor="amount" className="block text-sm font-semibold text-black mb-2">
                  💸 Valor do Débito (R$)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  id="amount"
                  value={formattedAmount}
                  onChange={handleAmountChange}
                  required
                  className="w-full px-4 py-3 border-2 border-ferro-200 rounded-lg focus:border-ferro-500 focus:ring-2 focus:ring-ferro-200 transition-colors duration-200 bg-white/90"
                  placeholder="0,00"
                />
              </div>

              {/* Descrição */}
              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-black mb-2">
                  📝 Descrição (Opcional)
                </label>
                <input
                  type="text"
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-ferro-200 rounded-lg focus:border-ferro-500 focus:ring-2 focus:ring-ferro-200 transition-colors duration-200 bg-white/90"
                  placeholder="Ex: Compra no supermercado"
                />
              </div>

              {/* Informações do cartão selecionado */}
              {selectedCard && (
                <div className="bg-gradient-to-r from-ferro-100 to-ferro-200 rounded-xl p-4">
                  <h4 className="font-semibold text-black mb-2">📋 Cartão Selecionado</h4>
                  <p className="text-black"><strong>Nome:</strong> {selectedCard.userName || 'Sem nome'}</p>
                  <p className="text-black"><strong>Número:</strong> {formatCardNumber(selectedCard.cardNumber || '')}</p>
                  <p className="text-black"><strong>Saldo Atual:</strong> R$ {(selectedCard.balance || 0).toFixed(2).replace('.', ',')}</p>
                  {amount && (
                    <div className="mt-2">
                      <p className="text-black">
                        <strong>Valor do Débito:</strong> R$ {parseFloat(amount || '0').toFixed(2).replace('.', ',')}
                      </p>
                      <p className={`font-semibold ${parseFloat(amount || '0') > (selectedCard.balance || 0) ? 'text-red-600' : 'text-black'}`}>
                        <strong>Novo Saldo:</strong> R$ {((selectedCard.balance || 0) - parseFloat(amount || '0')).toFixed(2).replace('.', ',')}
                      </p>
                      {parseFloat(amount || '0') > (selectedCard.balance || 0) && (
                        <p className="text-red-600 text-sm mt-1">
                          ⚠️ Saldo insuficiente!
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Botão de Debitar */}
              <Button
                type="submit"
                size="lg"
                className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 !text-black shadow-lg hover:shadow-red-200 font-semibold"
                disabled={isLoading || !selectedCard || (amount ? parseFloat(amount) > selectedCard.balance : false)}
              >
                {isLoading ? (
                  <>
                    <span className="animate-spin mr-2">✨</span>
                    Processando débito...
                  </>
                ) : (
                  <>
                    💸 Debitar Valor
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
        onConfirm={handleConfirmDebit}
        title="Confirmar Débito"
        message="Deseja realmente debitar o valor no cartão?"
        icon="💸"
        card={selectedCard}
        transactionType="debit"
        amount={amount}
        formattedAmount={formattedAmount}
        description={description}
        isLoading={isLoading}
      />
    </div>
  )
}

export default DebitCard