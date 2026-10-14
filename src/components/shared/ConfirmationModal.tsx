
import React from 'react'

interface Card {
  id: string
  name?: string
  userName?: string
  user_name?: string
  cardNumber?: string
  card_number?: string
  balance: number
}

interface Product {
  id: string
  name: string
  price: number
  stock: number
  description?: string
  image_url: string | null
}

interface ConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  icon: string
  card?: Card | null
  transactionType?: 'credit' | 'debit'
  amount?: string
  formattedAmount?: string
  description?: string
  message?: string
  variant?: 'card-transaction' | 'delete-product' | 'delivery-confirmation'
  // Props para exclusão de produto
  product?: Product | null
  // Estado de carregamento
  isLoading?: boolean
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  icon,
  message,
  variant,
  card,
  transactionType,
  amount,
  formattedAmount,
  description,
  product,
  isLoading = false
}) => {
  if (!isOpen) return null

  // Inferir variante quando não informada
  const computedVariant: 'card-transaction' | 'delete-product' | 'delivery-confirmation' | undefined = variant
    ? variant
    : product
      ? 'delete-product'
      : card
        ? 'card-transaction'
        : undefined

  if (computedVariant === 'card-transaction' && !card) return null
  if (computedVariant === 'delete-product' && !product) return null

  const formatCardNumber = (number: string) => {
    if (!number) return ''
    return number.replace(/(\d{4})(?=\d)/g, '$1 ')
  }

  const formatPrice = (price: number): string => {
    return price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  const getNewBalance = () => {
    if (!card || !amount) return 0
    const currentBalance = card.balance
    const transactionAmount = parseFloat(amount || '0')
    
    if (transactionType === 'credit') {
      return currentBalance + transactionAmount
    } else {
      return currentBalance - transactionAmount
    }
  }

  const getTransactionLabel = () => {
    return transactionType === 'credit' ? 'Valor a Adicionar' : 'Valor do Débito'
  }

  const getConfirmButtonClass = () => {
    if (computedVariant === 'delete-product') {
      return 'bg-vagao-600 hover:bg-vagao-700 border-vagao-600 text-creme-50'
    }
    else if (computedVariant === 'delivery-confirmation') {
      return 'bg-ferro-800 hover:bg-ferro-700 border-ferro-800 text-creme-200'
    }
    if (transactionType === 'credit' || computedVariant === 'card-transaction') {
      return 'bg-ferro-800 hover:bg-ferro-700 border-ferro-800 text-creme-200'
    }
    return 'bg-vagao-600 hover:bg-vagao-700 border-vagao-600 text-creme-50'
  }

  const getConfirmButtonText = () => {
    if (isLoading) {
      if (computedVariant === 'delete-product') return 'Excluindo...'
      return transactionType === 'credit' ? 'Adicionando...' : 'Processando...'
    }
    return '✓ Confirmar'
  }

  return (
    <div className="modal-overlay fixed inset-0 flex items-center justify-center z-50 p-4">
      <div 
        data-modal="content"
        className="modal-confirmation rounded-2xl shadow-bilhete border-2 border-ferro-800 max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-7"
      >
        <div className="text-center mb-5">
          <div className="text-5xl mb-3">{icon}</div>
          <h3 className="text-2xl font-semibold text-ferro-900 mb-2 font-display uppercase tracking-wide">
            {title}
          </h3>
          {message && (
            <p className="text-ferro-700 font-body">
              {message}
            </p>
          )}
          <div className="trilho w-full max-w-[180px] mx-auto mt-4" />
        </div>

        {/* Conteúdo específico por variante */}
        {(computedVariant === 'card-transaction' || (!!card && !computedVariant)) && card && (
          <>
            {/* Dados do Cartão */}
            <div className="card-data rounded-xl border border-ferro-200 p-4 mb-4">
              <div className="flex items-center justify-between gap-3 mb-2">
                <h4 className="font-display text-sm uppercase tracking-wider text-ferro-700">🎫 Dados do Cartão</h4>
                <span className="font-ticket font-bold text-ferro-900">
                  Nº {formatCardNumber(card.cardNumber || card.card_number || '')}
                </span>
              </div>
              <p className="text-ferro-900 font-semibold font-body">
                {card.userName || card.user_name}
              </p>
              <div className="flex justify-between items-baseline mt-1">
                <span className="text-sm text-ferro-600">Saldo atual</span>
                <span className="font-slab text-ferro-900">R$ {card.balance.toFixed(2).replace('.', ',')}</span>
              </div>
            </div>

            {/* Resumo da Transação */}
            <div className="transaction-summary rounded-xl border border-latao-300 p-4 mb-6">
              <h4 className="font-display text-sm uppercase tracking-wider text-ferro-700 mb-2">💳 Resumo da Transação</h4>
              <div className="space-y-1">
                <div className="flex justify-between items-baseline gap-3">
                  <span className="text-sm text-ferro-600">{getTransactionLabel()}</span>
                  <span className={`font-slab ${transactionType === 'credit' ? 'text-green-700' : 'text-vagao-600'}`}>
                    {transactionType === 'credit' ? '+' : '−'} R$ {formattedAmount}
                  </span>
                </div>
                {description && (
                  <div className="flex justify-between items-baseline gap-3">
                    <span className="text-sm text-ferro-600">Descrição</span>
                    <span className="text-ferro-900 text-right break-words">{description}</span>
                  </div>
                )}
                <div className="picote-horizontal mt-2 pt-2 flex justify-between items-baseline gap-3">
                  <span className="text-sm font-semibold text-ferro-700">Novo saldo</span>
                  <span className="font-slab text-xl text-ferro-900">R$ {getNewBalance().toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {computedVariant === 'delete-product' && product && (
          <div className="modal-delete-product-info bg-vagao-50 border-2 border-vagao-200 rounded-xl p-4 mb-6">
            <div className="flex items-center space-x-4">
              <img
                src={product.image_url || ''}
                alt={product.name}
                className="w-16 h-16 object-cover rounded-lg border border-ferro-200 bg-creme-200"
              />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-ferro-900 font-display break-words">{product.name}</h4>
                <p className="text-sm text-ferro-700 font-slab">
                  R$ {formatPrice(product.price)}
                </p>
                <p className="text-sm text-ferro-600 font-body">
                  Quantidade: {product.stock}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 !px-4 !py-3 font-display font-semibold tracking-wide rounded-xl transition-all duration-200 bg-creme-200 hover:bg-creme-300 text-ferro-800 border-2 border-ferro-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 !px-4 !py-3 font-display font-semibold tracking-wide rounded-xl border-2 shadow-sm transition-all duration-200 hover:shadow-md active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed ${getConfirmButtonClass()}`}
          >
            {isLoading && <span className="inline-block animate-spin mr-2">⚙️</span>}
            {getConfirmButtonText()}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ConfirmationModal
