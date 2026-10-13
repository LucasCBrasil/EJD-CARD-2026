import React, { useEffect, useMemo, useState, useRef } from 'react'
import { useLocation } from '@tanstack/react-router'
import { ConfirmationModal, TrainLoader } from '../../components/shared'
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

  const context: ContextType = location.pathname.includes('/lojinha') ? 'lojinha' : 'lanchonete'

  const [products, setProducts] = useState<Product[]>([])
  const [coupons, setCoupons] = useState<Array<{ name: string; discountAmount?: number }>>([])
  const [cartItems, setCartItems] = useState<Record<string, number>>({})
  const [isSaving] = useState(false)
  const [cardNumber, setCardNumber] = useState('')
  const [selectedCard, setSelectedCard] = useState<any | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [searchFilter, setSearchFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [couponCode, setCouponCode] = useState('')
  const [isCouponApplied, setIsCouponApplied] = useState(false)
  const [couponError, setCouponError] = useState<string | null>(null)
  const [couponDiscountAmount, setCouponDiscountAmount] = useState<number>(0)
  const itemsPerPage = 6

  useEffect(() => {
    loadProducts()
    loadCoupons()
    setCartItems({})
    cardService.initializeMockCards()
    setCardNumber('')
    setSelectedCard(null)
    setSearchFilter('')
    setCurrentPage(1)
    
    // Limpar timeout ao desmontar ou mudar contexto
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [context])

  const loadProducts = async () => {
    const loadedProducts = await productService.getProducts(context)
    setProducts(loadedProducts || [])
    setCurrentPage(1)
  }

  const loadCoupons = async () => {
    const loadedCoupons = await getCoupons(context)
    setCoupons(loadedCoupons || [])
  }

  // Filtrar produtos por nome
  const filteredProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return []
    if (!searchFilter.trim()) return products
    const filterLower = searchFilter.toLowerCase().trim()
    return products.filter(p => p && p.name && p.name.toLowerCase().includes(filterLower))
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
    if (Object.keys(cartItems).length === 0) {
      setCouponCode('')
      setCouponError(null)
      setIsCouponApplied(false)
      setCouponDiscountAmount(0)
    }
  }, [cartItems])

  const total = useMemo(() => {
    if (!products || !Array.isArray(products)) return 0
    return Object.entries(cartItems).reduce((acc, [productId, qty]) => {
      const p = products.find(pr => pr && pr.id === productId)
      if (!p) return acc
      return acc + p.price * qty
    }, 0)
  }, [cartItems, products])

  // Validar se o cupom ainda é válido quando o total muda (lojinha precisa de mínimo R$ 150)
  useEffect(() => {
    if (context === 'lojinha' && isCouponApplied && total < 150) {
      // Se o total ficou abaixo de R$ 150, remover o cupom
      setIsCouponApplied(false)
      setCouponDiscountAmount(0)
      showWarning('Cupom removido', 'O cupom foi removido porque o total da compra ficou abaixo de R$ 150,00')
    }
  }, [total, context, isCouponApplied, showWarning])

  const discountedTotal = useMemo(() => {
    if (isCouponApplied && couponCode) {
      if (context === 'lanchonete' && couponDiscountAmount > 0) {
        return Math.max(0, total - couponDiscountAmount)
      } else if (context === 'lojinha') {
        return Math.max(0, total - 10)
      }
    }
    return total
  }, [total, isCouponApplied, couponCode, couponDiscountAmount, context]) 

  const handleAddToCart = (product: Product) => {
    const pid = product.id
    if (!pid) return
    
    // Validar estoque antes de adicionar
    if (product.stock !== null && product.stock !== undefined) {
      const currentQuantity = cartItems[pid] || 0
      if (product.stock === 0) {
        showWarning('Produto indisponível', `O produto "${product.name}" não está mais disponível em estoque.`)
        return
      }
      if (product.stock < currentQuantity + 1) {
        showWarning(
          'Estoque insuficiente', 
          `Temos apenas ${product.stock} unidade${product.stock > 1 ? 's' : ''} disponível${product.stock > 1 ? 'eis' : ''} de "${product.name}". Você já tem ${currentQuantity} no carrinho.`
        )
        return
      }
    }
    
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
    if (!products || !Array.isArray(products)) return
    const product = products.find(p => p && p.id === productId)
    if (!product) return
    
    // Validar estoque antes de aumentar
    if (product.stock !== null && product.stock !== undefined) {
      const currentQuantity = cartItems[productId] || 0
      if (product.stock === 0) {
        showWarning('Produto indisponível', `O produto "${product.name}" não está mais disponível em estoque.`)
        return
      }
      if (product.stock < currentQuantity + 1) {
        showWarning(
          'Estoque insuficiente', 
          `Temos apenas ${product.stock} unidade${product.stock > 1 ? 's' : ''} disponível${product.stock > 1 ? 'eis' : ''} de "${product.name}". Você já tem ${currentQuantity} no carrinho.`
        )
        return
      }
    }
    
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

  // Ref para cancelar requisições anteriores
  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const lastSearchRef = React.useRef<string>('')
  const currentInputRef = React.useRef<string>('')

  const handleCardNumberChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.trim();
    setCardNumber(value);
    currentInputRef.current = value; // Atualizar ref com valor atual
    
    // Limpar timeout anterior
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    if (!value) {
      setSelectedCard(null);
      setError(null);
      lastSearchRef.current = '';
      return;
    }

    // Debounce: esperar 500ms após parar de digitar
    searchTimeoutRef.current = setTimeout(async () => {
      const searchValue = currentInputRef.current.trim();
      
      // Verificar se o valor ainda é o mesmo (evitar race conditions)
      if (!searchValue || searchValue !== value) {
        return;
      }

      // Evitar buscar o mesmo número novamente
      if (searchValue === lastSearchRef.current) {
        return;
      }

      lastSearchRef.current = searchValue;
      
      try {
        // Não usar isLoading aqui - só durante a venda
        setError(null);
        
        const card = await getCardByNumber(searchValue);
        
        // Verificar novamente se o valor ainda é o mesmo quando a resposta chega
        if (currentInputRef.current.trim() !== searchValue) {
          return;
        }

        if (card) {
          setSelectedCard(card);
          setError(null);
        } else {
          setSelectedCard(null);
          setError('Cartão não encontrado');
        }
      } catch (err: any) {
        // Verificar novamente se o valor ainda é o mesmo
        if (currentInputRef.current.trim() !== searchValue) {
          return;
        }
        console.error('Erro ao buscar cartão:', err);
        setError(err?.message || 'Erro ao buscar cartão');
        setSelectedCard(null);
      }
    }, 500); // 500ms de debounce
  }

  const handleConfirmSale = async () => {
    setError(null)
    
    // VALIDAÇÃO: Verificar se products está carregado
    if (!products || !Array.isArray(products) || products.length === 0) {
      setError('Produtos ainda não foram carregados. Aguarde um momento e tente novamente.')
      showError('Erro', 'Produtos ainda não foram carregados. Aguarde um momento e tente novamente.')
      return
    }
    
    // VALIDAÇÃO ANTES DE FINALIZAR
    const items: SaleItem[] = Object.entries(cartItems)
      .filter(([productId]) => productId !== null && productId !== undefined)
      .map(([productId, quantity]) => {
        const p = products.find(pr => pr && pr.id === productId)
        if (!p) {
          throw new Error(`Produto com ID ${productId} não encontrado`)
        }
        return {
          id: p.id,
          productId: p.id || '',
          productName: p.name,
          price: p.price,
          quantity,
          image: p.image_url || null
        }
      })
      
    // Validar que temos itens válidos
    if (items.length === 0) {
      setError('Nenhum item válido no carrinho')
      showError('Erro', 'Nenhum item válido no carrinho')
      return
    }

    // Validar estoque ANTES de chamar a função
    const stockErrors: string[] = []
    for (const item of items) {
      const product = products.find(p => p.id === item.productId)
      if (!product) {
        stockErrors.push(`Produto "${item.productName}" não encontrado`)
        continue
      }
      
      if (product.stock !== null && product.stock !== undefined) {
        if (product.stock === 0) {
          stockErrors.push(`O produto "${product.name}" não está mais disponível em estoque`)
        } else if (product.stock < item.quantity) {
          stockErrors.push(`Estoque insuficiente para "${product.name}". Temos apenas ${product.stock} unidade${product.stock > 1 ? 's' : ''} disponível${product.stock > 1 ? 'eis' : ''}, mas você está tentando comprar ${item.quantity}`)
        }
      }
    }

    if (stockErrors.length > 0) {
      const errorMessage = stockErrors.length === 1 
        ? stockErrors[0]
        : `Não é possível finalizar a venda:\n${stockErrors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
      setError(errorMessage)
      showError('Erro no estoque', errorMessage)
      return
    }

    setIsLoading(true)
    try {
      // Validar que temos todos os dados necessários
      if (!selectedCard || !selectedCard.id) {
        throw new Error('Cartão não selecionado')
      }
      
      if (!items || items.length === 0) {
        throw new Error('Nenhum item no carrinho')
      }
      
      // Usar o cardId diretamente do selectedCard, não o userId
      // Na tela de vendas, já temos o cartão selecionado com seu ID
      await makeSale(
        selectedCard.id, // Passar cardId diretamente
        items,
        context,
        couponCode,
        discountedTotal
      )
      
      // Recarregar produtos para atualizar estoque
      await loadProducts()
      
      showSuccess(
        'Venda realizada!',
        `Venda de R$ ${total.toFixed(2)} para cartão ${selectedCard.cardNumber || 'N/A'} de ${selectedCard.userName || 'N/A'} foi realizada com sucesso.`
      )
      setCardNumber('')
      setSelectedCard(null)
      handleClearCart()
    } catch (err: any) {
      const errorMessage = err?.message || 'Erro ao realizar venda'
      setError(errorMessage)
      showError('Erro na venda', errorMessage)
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
    if (discountedTotal > selectedCard.balance) {
      showError('Saldo insuficiente', 'O saldo do cartão é insuficiente para concluir a compra.')
      return
    }
    setShowConfirmation(true)
  }

  const handleCancelConfirmation = () => setShowConfirmation(false)

  const formatPrice = (price: number): string => price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const config = context === 'lojinha' ? {
    title: 'Vendas · Lojinha',
    stamp: '🎫 Bilheteria',
    subtitle: 'Adicione itens ao carrinho e finalize a venda',
    icon: '🛍️'
  } : {
    title: 'Vendas · Lanchonete',
    stamp: '☕ Vagão-restaurante',
    subtitle: 'Adicione itens ao carrinho e finalize o pedido',
    icon: '🍔'
  }

  const smallBtn = 'p-0 flex items-center justify-center rounded-lg font-bold transition-colors'

  return (
    <div className="painel p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <span className="carimbo text-vagao-600 text-xs">{config.stamp}</span>
        <h2 className="mt-3 text-2xl md:text-3xl font-display font-semibold uppercase tracking-wide text-ferro-900">
          {config.title}
        </h2>
        <p className="text-base text-ferro-700">{config.subtitle}</p>
        <div className="trilho w-full mt-4" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Produtos */}
        <div className="lg:col-span-2 space-y-5">
          {/* Campo de busca */}
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="🔍 Buscar produto..."
            className="w-full"
          />

          {/* Grid de Produtos */}
          {paginatedProducts.length === 0 ? (
            <div className="bg-creme-100 rounded-xl border border-ferro-200 p-8 text-center">
              <div className="text-5xl mb-3">🚉</div>
              <p className="text-ferro-600">
                {searchFilter ? 'Nenhum produto encontrado.' : 'Nenhum produto disponível.'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                {paginatedProducts.map(p => (
                  <div key={p.id} className="flex flex-col bg-creme-50 rounded-xl border-2 border-ferro-800 overflow-hidden shadow-sm hover:shadow-bilhete transition-shadow">
                    <div className="h-28 sm:h-36 bg-creme-200 flex items-center justify-center">
                      <OptimizedImage
                        src={p.image_url || ''}
                        alt={p.name}
                        className="w-full h-full object-cover"
                        context={context}
                      />
                    </div>
                    <div className="picote-horizontal flex flex-col flex-1 p-3">
                      <h4 className="font-display font-medium text-ferro-900 text-sm leading-tight mb-1 line-clamp-2">{p.name}</h4>
                      <p className="font-slab text-lg text-vagao-600 mb-3 mt-auto">R$ {formatPrice(p.price)}</p>
                      <button
                        onClick={() => handleAddToCart(p)}
                        className="w-full bg-ferro-800 hover:bg-ferro-700 text-creme-200 font-display font-semibold tracking-wide text-sm py-2 px-2 rounded-lg transition-colors active:scale-[0.98]"
                      >
                        + Adicionar
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Paginação */}
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 pt-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-2 bg-creme-200 hover:bg-creme-300 text-ferro-800 border border-ferro-200 font-display text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
                          className={`${smallBtn} w-10 h-10 font-display ${
                            isActive
                              ? 'bg-ferro-800 text-creme-200'
                              : 'bg-creme-200 text-ferro-800 border border-ferro-200 hover:bg-creme-300'
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
                    className="px-3 py-2 bg-creme-200 hover:bg-creme-300 text-ferro-800 border border-ferro-200 font-display text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Próximo →
                  </button>
                </div>
              )}

              {/* Info de Paginação */}
              <div className="text-center text-sm text-ferro-500">
                Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredProducts.length)} de {filteredProducts.length} produtos
              </div>
            </>
          )}
        </div>

        {/* Carrinho */}
        <div className="lg:col-span-1">
          <div className="bg-creme-100 rounded-xl border-2 border-ferro-800 shadow-bilhete p-4 sticky top-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-display font-semibold uppercase tracking-wide text-ferro-900">
                🛒 Carrinho
              </h3>
              <span className="font-ticket text-xs text-ferro-500">PASSAGEM</span>
            </div>

            {/* Campo de cartão */}
            <div className="mb-3 space-y-2">
              <label className="block text-sm font-semibold text-ferro-700 mb-1">Número do Cartão</label>
              <input
                type="text"
                inputMode="numeric"
                value={cardNumber}
                onChange={handleCardNumberChange}
                className="w-full font-ticket tracking-widest"
                placeholder="001"
                maxLength={16}
              />

              {selectedCard ? (
                <div className="bg-creme-200 rounded-lg p-3 border border-ferro-200 space-y-0.5">
                  <p className="text-sm text-ferro-900">
                    <span className="text-ferro-500">Nome:</span> <strong>{selectedCard.userName}</strong>
                  </p>
                  <p className="text-sm text-ferro-900">
                    <span className="text-ferro-500">Saldo:</span> <span className="font-slab">R$ {selectedCard.balance.toFixed(2)}</span>
                  </p>
                  <p className={`text-sm font-semibold ${
                    discountedTotal > selectedCard.balance ? 'text-vagao-600' : 'text-green-700'
                  }`}>
                    <span className="text-ferro-500 font-normal">Após:</span> <span className="font-slab">R$ {(selectedCard.balance - discountedTotal).toFixed(2)}</span>
                  </p>
                </div>
              ) : (
                <p className={`text-sm ${error ? 'text-vagao-600' : 'text-ferro-500'}`}>
                  {error || 'Informe um cartão'}
                </p>
              )}
            </div>

            {/* Itens do carrinho */}
            {Object.keys(cartItems).length === 0 ? (
              <div className="picote-horizontal text-center pt-5 pb-2">
                <div className="text-3xl mb-1">🧳</div>
                <p className="text-ferro-500 text-sm">Carrinho vazio</p>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Lista de itens */}
                <div className="picote-horizontal pt-3 space-y-2 max-h-64 overflow-y-auto">
                  {Object.entries(cartItems).map(([productId, qty]) => {
                    const p = products.find(pr => pr.id === productId)!
                    return (
                      <div key={productId} className="bg-creme-50 p-2 rounded-lg border border-ferro-200">
                        <div className="flex items-center gap-2">
                          <OptimizedImage
                            src={p.image_url || ''}
                            alt={p.name}
                            className="w-10 h-10 rounded object-cover flex-shrink-0"
                            context={context}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-ferro-900 truncate leading-tight">{p.name}</p>
                            <p className="text-xs text-ferro-500">R$ {formatPrice(p.price)}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleDecrease(productId)}
                              className={`${smallBtn} w-8 h-8 bg-creme-200 hover:bg-creme-300 border border-ferro-200 text-ferro-800 text-base`}
                              aria-label="Diminuir"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-sm font-semibold text-ferro-900">{qty}</span>
                            <button
                              onClick={() => handleIncrease(productId)}
                              className={`${smallBtn} w-8 h-8 bg-creme-200 hover:bg-creme-300 border border-ferro-200 text-ferro-800 text-base`}
                              aria-label="Aumentar"
                            >
                              +
                            </button>
                          </div>
                          <div className="font-slab text-sm text-ferro-900">
                            R$ {formatPrice(p.price * qty)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Cupom */}
                <div className="pt-2 border-t border-ferro-200">
                  <label className="block text-sm font-semibold text-ferro-700 mb-1">Cupom</label>
                  <div className="flex gap-2">
                    <select
                      value={couponCode}
                      onChange={e => {
                        setCouponCode(e.target.value)
                        if (e.target.value) {
                          const selectedCoupon = coupons.find(c => c.name === e.target.value)
                          if (selectedCoupon && context === 'lanchonete' && selectedCoupon.discountAmount) {
                            setCouponDiscountAmount(selectedCoupon.discountAmount)
                          } else if (context === 'lojinha') {
                            setCouponDiscountAmount(10)
                          }
                        } else {
                          setCouponDiscountAmount(0)
                        }
                      }}
                      disabled={isCouponApplied || (context === 'lojinha' && total < 150)}
                      className="flex-1 min-w-0 px-2 py-2 disabled:opacity-60 truncate"
                      style={{ maxWidth: '100%' }}
                    >
                      <option value="">Selecione</option>
                      {coupons && Array.isArray(coupons) && coupons.map((coupon, idx) => {
                        const displayName = coupon.name && coupon.name.length > 20
                          ? `${coupon.name.substring(0, 17)}...`
                          : coupon.name
                        return (
                          <option key={idx} value={coupon.name} title={coupon.name}>
                            {displayName} {coupon.discountAmount ? `(-R$ ${coupon.discountAmount.toFixed(2)})` : ''}
                          </option>
                        )
                      })}
                    </select>
                    <button
                      onClick={() => {
                        if (context === 'lanchonete' && !isCouponApplied && couponCode) {
                          setIsCouponApplied(true)
                          const selectedCoupon = coupons.find(c => c.name === couponCode)
                          const discount = selectedCoupon?.discountAmount || 0
                          showSuccess('Cupom aplicado!', `Desconto de R$ ${discount.toFixed(2)}`)
                        } else if (context === 'lojinha' && total >= 150 && !isCouponApplied) {
                          setIsCouponApplied(true)
                          showSuccess('Cupom aplicado!', 'Desconto de R$10,00')
                        }
                      }}
                      disabled={isCouponApplied || (context === 'lojinha' && total < 150) || !couponCode}
                      className="px-3 py-2 bg-latao-400 hover:bg-latao-300 text-ferro-900 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed font-display font-semibold rounded-lg text-sm flex-shrink-0"
                    >
                      Aplicar
                    </button>
                  </div>
                  {context === 'lojinha' && total < 150 && <p className="text-xs text-latao-700 mt-1">Mínimo: R$150</p>}
                  {isCouponApplied && (
                    <p className="text-xs text-green-700 font-semibold mt-1">
                      ✓ -R$ {couponDiscountAmount.toFixed(2)}
                    </p>
                  )}
                </div>

                {/* Total */}
                <div className="picote-horizontal pt-3 space-y-0.5">
                  {isCouponApplied && (
                    <>
                      <div className="flex justify-between text-sm text-ferro-700">
                        <span>Subtotal</span>
                        <span>R$ {formatPrice(total)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-green-700">
                        <span>Desconto</span>
                        <span>- R$ {formatPrice(couponDiscountAmount)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center pt-1.5">
                    <span className="font-display font-semibold uppercase tracking-wide text-ferro-900">Total</span>
                    <span className="font-slab text-2xl text-ferro-900">
                      R$ {formatPrice(discountedTotal)}
                    </span>
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={handleClearCart}
                    className="flex-1 bg-creme-200 hover:bg-creme-300 text-ferro-800 border border-ferro-200 font-display font-semibold py-2.5 px-2 rounded-lg text-sm"
                  >
                    Limpar
                  </button>
                  <button
                    onClick={handleOpenConfirmation}
                    disabled={isSaving}
                    className="flex-1 bg-vagao-600 hover:bg-vagao-700 text-creme-50 font-display font-semibold tracking-wide py-2.5 px-2 rounded-lg disabled:opacity-50 text-sm shadow-sm"
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

      {/* Modal de Loading - Bloqueia a tela durante o processamento */}
      {isLoading && (
        <TrainLoader
          title={context === 'lojinha' ? 'Processando venda...' : 'Processando pedido...'}
          message={`Por favor, aguarde enquanto finalizamos ${context === 'lojinha' ? 'a venda' : 'o pedido'}`}
        />
      )}
    </div>
  )
}

export default SalesPage
