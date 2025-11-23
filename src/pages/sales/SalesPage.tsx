import React, { useEffect, useMemo, useState } from 'react'
import { useLocation } from '@tanstack/react-router'
import { Button, ConfirmationModal } from '../../components/shared'
import { productService, Product } from '../../services/productService'
import type { SaleItem } from '../../types'
import { useToastContext } from '../../contexts/ToastContext'
import { cardService } from '../../services/cardService'
import { useSupabaseData } from '../../contexts/SupabaseDataContext'
import OptimizedImage from '../../components/ui/OptimizedImage'

type ContextType = 'lojinha' | 'lanchonete'

const SalesPage: React.FC = () => {
  const { getCardByNumber, makeSale, getCoupons } = useSupabaseData()
  const location = useLocation()
  const { showSuccess, showError, showWarning } = useToastContext()

  const context: ContextType = location.pathname.endsWith('/lojinha') ? 'lojinha' : 'lanchonete'

  const [products, setProducts] = useState<Product[]>([])
  const [coupons, setCoupons] = useState<string[]>([])
  const [cartItems, setCartItems] = useState<Record<string, number>>({})
  const [isSaving] = useState(false)
  const [cardNumber, setCardNumber] = useState('')
  const [selectedCard, setSelectedCard] = useState<any | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [couponCode, setCouponCode] = useState('')
  const [isCouponApplied, setIsCouponApplied] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const itemsPerPage = 6

  // Cores por contexto
  const accentColor = context === 'lojinha' ? 'blue' : 'orange'
  const borderColor = context === 'lojinha' ? 'border-blue-300' : 'border-orange-300'

  useEffect(() => {
    loadProducts()
    loadCoupons()
    setCartItems({})
    cardService.initializeMockCards()
    setCardNumber('')
    setSelectedCard(null)
    setSearchFilter('')
    setCurrentPage(1)
  }, [context])

  const loadProducts = async () => {
    const loadedProducts = await productService.getProducts(context)
    setProducts(loadedProducts || [])
    setCurrentPage(1)
  }

  const loadCoupons = async () => {
    const loadedCoupons = await getCoupons()
    const resolvedCoupons = Array.isArray(loadedCoupons) 
      ? await Promise.all(loadedCoupons) 
      : []
    setCoupons(resolvedCoupons)
  }

  // Filtrar produtos por nome
  const filteredProducts = useMemo(() => {
    if (!searchFilter.trim()) return products
    const filterLower = searchFilter.toLowerCase().trim()
    return products.filter(p => p.name.toLowerCase().includes(filterLower))
  }, [products, searchFilter])

  // Produtos paginados
  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredProducts.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredProducts, currentPage, itemsPerPage])

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchFilter])

  useEffect(() => {
    if (cartItems.length === 0) {
      setCouponCode('')
      setCouponError(null)
      setIsCouponApplied(false)
    }
  }, [cartItems])

  const total = useMemo(() => {
    return Object.entries(cartItems).reduce((acc, [productId, qty]) => {
      const p = products.find(pr => pr.id === productId)
      if (!p) return acc
      return acc + p.price * qty
    }, 0)
  }, [cartItems, products])

  const discountedTotal = useMemo(() => {
    if (isCouponApplied && couponCode) {
      return Math.max(0, total - 10)
    } return total
  }, [total, isCouponApplied, couponCode]) 

  const handleAddToCart = (product: Product) => {
    const pid = product.id
    if (!pid) return
    setCartItems(prev => ({
      ...prev,
      [pid]: (prev[pid] || 0) + 1
    }))
  }

  const handleDecrease = (productId: string) => {
    setCartItems(prev => {
      const current = prev[productId] || 0
      const next = Math.max(0, current - 1)
      const copy = { ...prev }
      if (next === 0) {
        delete copy[productId]
      } else {
        copy[productId] = next
      }
      return copy
    })
  }

  const handleIncrease = (productId: string) => {
    setCartItems(prev => ({
      ...prev,
      [productId]: (prev[productId] || 0) + 1
    }))
  }

  const handleClearCart = () => {
    setCartItems({})
    setCouponCode('')
    setCouponError(null)
    setIsCouponApplied(false)
  }

  const handleCardNumberChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setCardNumber(value);
    
    try {
      setIsLoading(true);
      setError(null);
      
      if (!value.trim()) {
        setSelectedCard(null);
        return;
      }

      const card = await getCardByNumber(value);
      if (card) {
        setSelectedCard(card);
        setError(null);
      } else {
        setSelectedCard(null);
        setError('Cartão não encontrado');
      }
    } catch (err: any) {
      console.error('Erro ao buscar cartão:', err);
      setError(err?.message || 'Erro ao buscar cartão');
      setSelectedCard(null);
    } finally {
      setIsLoading(false);
    }
  }

  const handleConfirmSale = async () => {
    setError(null)
    setIsLoading(true)
    const items: SaleItem[] = Object.entries(cartItems)
      .filter(([productId]) => productId !== null)
      .map(([productId, quantity]) => {
        const p = products.find(pr => pr.id === productId)!
        return {
          id: p.id,
          productId: p.id || '',
          productName: p.name,
          price: p.price,
          quantity,
          image: p.image_url || null
        }
      })

    try {
      await makeSale(
        selectedCard.user_id,
        items,
        context,
        couponCode,
        discountedTotal
      )
      
      showSuccess(
        'Venda realizada!',
        `Venda de R$ ${total.toFixed(2)} para cartão ${selectedCard.card_number} de ${selectedCard.user_name} foi realizada com sucesso.`
      )
      setCardNumber('')
      setSelectedCard(null)
      handleClearCart()
    } catch (err: any) {
      setError(err?.message || 'Erro ao realizar venda')
      console.error('Erro ao realizar venda:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleOpenConfirmation = () => {
    if (Object.keys(cartItems).length === 0) {
      showWarning('Carrinho vazio', 'Adicione ao menos um item para finalizar a venda.')
      return
    }
    if (!selectedCard) {
      showWarning('Cartão não selecionado', 'Informe um cartão válido para realizar a venda.')
      return
    }
    if (total > selectedCard.balance) {
      showError('Saldo insuficiente', 'O saldo do cartão é insuficiente para concluir a compra.')
      return
    }
    setShowConfirmation(true)
  }

  const handleCancelConfirmation = () => setShowConfirmation(false)

  const formatPrice = (price: number): string => price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const config = context === 'lojinha' ? {
    title: '🛍️ Vendas - Lojinha',
    subtitle: 'Adicione itens ao carrinho e finalize a venda',
    icon: '🏪'
  } : {
    title: '🍔 Vendas - Lanchonete',
    subtitle: 'Adicione itens ao carrinho e finalize o pedido',
    icon: '🍔'
  }

  return (
    <div className={`bg-white rounded-2xl shadow-xl border-2 ${borderColor} p-6 md:p-8`}>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">{config.title}</h2>
        <p className="text-base text-gray-600">{config.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Produtos */}
        <div className="lg:col-span-2 space-y-6">
          {/* Campo de busca */}
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="🔍 Buscar produto..."
            className="w-full px-4 py-3 bg-white border-2 border-gray-300 rounded-lg
                      focus:border-gray-500 focus:outline-none transition-colors
                      text-gray-900"
          />

          {/* Grid de Produtos */}
          {paginatedProducts.length === 0 ? (
            <div className="bg-gray-50 rounded-lg border-2 border-gray-200 p-8 text-center">
              <div className="text-6xl mb-4">📭</div>
              <p className="text-gray-500">
                {searchFilter ? 'Nenhum produto encontrado.' : 'Nenhum produto disponível.'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedProducts.map(p => (
                  <div key={p.id} className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
                    <div className="h-36 bg-gray-100 flex items-center justify-center">
                      <OptimizedImage
                        src={p.image_url || ''}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        context={context}
                      />
                    </div>
                    <div className="p-3">
                      <h4 className="font-bold text-gray-900 text-sm mb-1 truncate">{p.name}</h4>
                      <p className="text-lg font-bold text-emerald-600 mb-3">R$ {formatPrice(p.price)}</p>
                      <button 
                        onClick={() => handleAddToCart(p)} 
                        className={`w-full ${
                          context === 'lojinha' 
                            ? 'bg-blue-500 hover:bg-blue-600' 
                            : 'bg-orange-500 hover:bg-orange-600'
                        } text-white font-semibold py-2 px-4 rounded-lg transition-colors`}
                      >
                        ➕ Adicionar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 pt-4">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 ${
                      context === 'lojinha' 
                        ? 'bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300' 
                        : 'bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300'
                    } text-white font-semibold rounded-lg disabled:cursor-not-allowed transition-colors`}
                  >
                    ← Anterior
                  </button>

                  <div className="flex gap-1">
                    {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                      const page = i + 1
                      const isActive = currentPage === page
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`w-10 h-10 rounded-lg font-bold transition-colors ${
                            isActive
                              ? context === 'lojinha'
                                ? 'bg-blue-500 text-white'
                                : 'bg-orange-500 text-white'
                              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                          }`}
                        >
                          {page}
                        </button>
                      )
                    })}
                  </div>

                  <button
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-4 py-2 ${
                      context === 'lojinha' 
                        ? 'bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300' 
                        : 'bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300'
                    } text-white font-semibold rounded-lg disabled:cursor-not-allowed transition-colors`}
                  >
                    Próximo →
                  </button>
                </div>
              )}

              {/* Info de Paginação */}
              <div className="text-center text-sm text-gray-600">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredProducts.length)} de {filteredProducts.length} produtos
              </div>
            </>
          )}
        </div>

        {/* Carrinho */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 rounded-lg border-2 border-gray-300 p-3 sticky top-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">
              🛒 Carrinho
            </h3>

            {/* Campo de cartão */}
            <div className="mb-3 space-y-2">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Número do Cartão</label>
              <input
                type="text"
                value={cardNumber}
                onChange={handleCardNumberChange}
                className="w-full px-2.5 py-1.5 border-2 border-gray-300 rounded-md
                          focus:border-gray-500 focus:outline-none bg-white text-gray-900 text-sm"
                placeholder="001"
                maxLength={16}
              />
              
              {selectedCard ? (
                <div className="bg-emerald-50 rounded-md p-2 border border-emerald-200">
                  <p className="text-xs text-gray-900">
                    <strong>Nome:</strong> {selectedCard.user_name}
                  </p>
                  <p className="text-xs text-gray-900">
                    <strong>Saldo:</strong> R$ {selectedCard.balance.toFixed(2)}
                  </p>
                  <p className={`text-xs font-semibold ${
                    discountedTotal > selectedCard.balance ? 'text-red-600' : 'text-emerald-600'
                  }`}>
                    <strong>Após:</strong> R$ {(selectedCard.balance - discountedTotal).toFixed(2)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-gray-500">
                  {error || 'Informe um cartão'}
                </p>
              )}
            </div>

            {/* Itens do carrinho */}
            {Object.keys(cartItems).length === 0 ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-1">🛒</div>
                <p className="text-gray-500 text-xs">Carrinho vazio</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Lista de itens */}
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {Object.entries(cartItems).map(([productId, qty]) => {
                    const p = products.find(pr => pr.id === productId)!
                    return (
                      <div key={productId} className="bg-white p-1.5 rounded border border-gray-200">
                        <div className="flex items-center gap-1.5">
                          <OptimizedImage
                            src={p.image_url || ''}
                            alt={p.name}
                            className="w-10 h-10 rounded object-cover flex-shrink-0"
                            context={context}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-gray-900 truncate leading-tight">{p.name}</p>
                            <p className="text-xs text-gray-600">R$ {formatPrice(p.price)}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDecrease(productId)}
                              className="w-5 h-5 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs"
                            >
                              -
                            </button>
                            <span className="w-5 text-center text-xs font-semibold">{qty}</span>
                            <button
                              onClick={() => handleIncrease(productId)}
                              className="w-5 h-5 flex items-center justify-center rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs"
                            >
                              +
                            </button>
                          </div>
                          <div className="text-xs font-bold text-gray-900">
                            R$ {formatPrice(p.price * qty)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Cupom (lojinha) */}
                {context === 'lojinha' && (
                  <div className="pt-2 border-t border-gray-300">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Cupom</label>
                    <div className="flex gap-1.5">
                      <select
                        value={couponCode}
                        onChange={e => setCouponCode(e.target.value)}
                        disabled={isCouponApplied || total < 150}
                        className="flex-1 px-2 py-1.5 border-2 border-gray-300 rounded text-xs bg-white disabled:bg-gray-100"
                      >
                        <option value="">Selecione</option>
                        {coupons.map((coupon, idx) => (
                          <option key={idx} value={coupon}>{coupon}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => {
                          if (total >= 150 && !isCouponApplied) {
                            setIsCouponApplied(true)
                            showSuccess('Cupom aplicado!', 'Desconto de R$10,00')
                          }
                        }}
                        disabled={isCouponApplied || total < 150}
                        className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white font-semibold rounded text-xs"
                      >
                        Aplicar
                      </button>
                    </div>
                    {total < 150 && <p className="text-xs text-amber-600 mt-1">Mínimo: R$150</p>}
                    {isCouponApplied && <p className="text-xs text-emerald-700 font-semibold mt-1">✅ -R$ 10,00</p>}
                  </div>
                )}

                {/* Total */}
                <div className="pt-2 border-t border-gray-300 space-y-0.5">
                  {isCouponApplied && context === 'lojinha' && (
                    <>
                      <div className="flex justify-between text-xs">
                        <span>Subtotal</span>
                        <span>R$ {formatPrice(total)}</span>
                      </div>
                      <div className="flex justify-between text-xs text-emerald-600">
                        <span>Desconto</span>
                        <span>- R$ 10,00</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center pt-1.5">
                    <span className="font-bold text-gray-900 text-sm">Total</span>
                    <span className="text-lg font-bold text-emerald-600">
                      R$ {formatPrice(discountedTotal)}
                    </span>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-2 pt-2">
                  <button 
                    onClick={handleClearCart} 
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 rounded-lg text-sm"
                  >
                    Limpar
                  </button>
                  <button
                    onClick={handleOpenConfirmation}
                    disabled={isSaving}
                    className={`flex-1 ${
                      context === 'lojinha' 
                        ? 'bg-blue-500 hover:bg-blue-600' 
                        : 'bg-orange-500 hover:bg-orange-600'
                    } text-white font-semibold py-2 rounded-lg disabled:bg-gray-400 text-sm`}
                  >
                    {isSaving ? 'Salvando...' : 'Finalizar'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Confirmação */}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={handleCancelConfirmation}
        onConfirm={() => { setShowConfirmation(false); handleConfirmSale() }}
        title={context === 'lojinha' ? 'Confirmar Venda' : 'Confirmar Pedido'}
        icon={config.icon}
        card={selectedCard}
        transactionType="debit" 
        amount={discountedTotal.toFixed(2)}
        formattedAmount={discountedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        description={`${Object.entries(cartItems).map(([id, q]) => {
          const p = products.find(pp => pp.id === id)
          return p ? `${p.name} (${q}x)` : ''
        }).filter(Boolean).join(', ')}`}
        isLoading={isSaving}
      />
    </div>
  )
}

export default SalesPage
