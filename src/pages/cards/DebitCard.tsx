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

  const inputClass = 'w-full px-4 py-3 border-2 border-ferro-200 rounded-xl bg-creme-50 text-ferro-900 focus:border-ferro-500 focus:ring-2 focus:ring-ferro-200 transition-colors duration-200'
  const insufficient = !!selectedCard && parseFloat(amount || '0') > (selectedCard.balance || 0)

  return (
    <div className="space-y-4">
      <Header 
            title="Débito em Cartão"
            subtitle="Debite um valor do cartão do encontrista"
            showLogo={false}
        />
    <div className="w-full relative z-10">
        <div className="mx-auto w-full">

          {/* Formulário */}
          <div className="painel p-5 md:p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Número do Cartão */}
              <div>
                <label htmlFor="cardNumber" className="block text-sm font-semibold text-ferro-900 mb-2">
                  🎫 Número do Cartão
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  id="cardNumber"
                  value={cardNumber}
                  onChange={handleCardNumberChange}
                  required
                  className={`${inputClass} font-ticket tracking-widest`}
                  placeholder="001"
                  maxLength={3}
                />
              </div>

              {error && (
                <div className="bg-vagao-50 border-2 border-vagao-300 rounded-xl p-3 text-center">
                  <p className="text-vagao-800 font-semibold text-sm">⚠️ {error}</p>
                </div>
              )}

              {/* Valor do débito */}
              <div>
                <label htmlFor="amount" className="block text-sm font-semibold text-ferro-900 mb-2">
                  💸 Valor do Débito (R$)
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

              {/* Descrição */}
              <div>
                <label htmlFor="description" className="block text-sm font-semibold text-ferro-900 mb-2">
                  📝 Descrição (Opcional)
                </label>
                <input
                  type="text"
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className={inputClass}
                  placeholder="Ex: Compra no supermercado"
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
                    <>
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm text-ferro-600">Valor do débito</span>
                        <span className="font-slab text-vagao-600">− R$ {parseFloat(amount || '0').toFixed(2).replace('.', ',')}</span>
                      </div>
                      <div className="flex justify-between items-baseline">
                        <span className="text-sm text-ferro-600">Novo saldo</span>
                        <span className={`font-slab text-lg ${insufficient ? 'text-vagao-600' : 'text-ferro-900'}`}>
                          R$ {((selectedCard.balance || 0) - parseFloat(amount || '0')).toFixed(2).replace('.', ',')}
                        </span>
                      </div>
                      {insufficient && (
                        <p className="carimbo text-vagao-600 text-xs mt-1">
                          ⚠️ Saldo insuficiente
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Botão de Debitar */}
              <Button
                type="submit"
                size="lg"
                className="w-full !bg-vagao-600 hover:!bg-vagao-700 !border-vagao-600 !text-creme-50"
                disabled={isLoading || !selectedCard || (amount ? parseFloat(amount) > selectedCard.balance : false)}
              >
                {isLoading ? (
                  <>
                    <span className="inline-block animate-spin mr-2">⚙️</span>
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
