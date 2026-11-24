import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react'
import { useLocation } from '@tanstack/react-router'
import { ConfirmationModal, TrainLoader } from '../../components/shared'
import { productService, Product } from '../../services/productService'
import type { SaleItem } from '../../types'
import { useToastContext } from '../../contexts/ToastContext'
import { useSupabaseData } from '../../contexts/SupabaseDataContext'
import { UserAccount } from '../../types'
import OptimizedImage from '../../components/ui/OptimizedImage'
import { api, type AmbulanteBagItem } from '../../lib/api-client'

type ContextType = 'lojinha' | 'lanchonete'
type BagModalMode = 'take' | 'return' | null

interface CartItemSnapshot {
  product_name: string
  price: number
  image_url: string | null
}

const SalesPage: React.FC = () => {
  const { searchAccountsByName, makeSale, getCoupons } = useSupabaseData()
  const location = useLocation()
  const { showSuccess, showError, showWarning } = useToastContext()

  const context: ContextType = location.pathname.includes('/lojinha') ? 'lojinha' : 'lanchonete'

  const [products, setProducts] = useState<Product[]>([])
  const [generalLanchoneteProducts, setGeneralLanchoneteProducts] = useState<Product[]>([])
  const [bagItems, setBagItems] = useState<AmbulanteBagItem[]>([])
  const [bagModalMode, setBagModalMode] = useState<BagModalMode>(null)
  const [bagDraftQuantities, setBagDraftQuantities] = useState<Record<string, number>>({})
  const [isBagSubmitting, setIsBagSubmitting] = useState(false)

  const [coupons, setCoupons] = useState<Array<{ name: string; discountAmount?: number }>>([])
  const [cartItems, setCartItems] = useState<Record<string, number>>({})
  const [cartItemSnapshots, setCartItemSnapshots] = useState<Record<string, CartItemSnapshot>>({})
  const [lojinhaCartId, setLojinhaCartId] = useState<string | null>(null)
  const [lojinhaCartVersion, setLojinhaCartVersion] = useState<number | null>(null)
  const [isCartLoading, setIsCartLoading] = useState(false)
  const [isCartUpdating, setIsCartUpdating] = useState(false)
  const [showCancelCartConfirmation, setShowCancelCartConfirmation] = useState(false)
  const [accountSearch, setAccountSearch] = useState('')
  const [selectedAccount, setSelectedAccount] = useState<UserAccount | null>(null)
  const [accountSuggestions, setAccountSuggestions] = useState<UserAccount[]>([])
  const [pendingAccount, setPendingAccount] = useState<UserAccount | null>(null)
  const [securityCode, setSecurityCode] = useState('')
  const [securityError, setSecurityError] = useState('')
  const [isVerifyingCode, setIsVerifyingCode] = useState(false)
  const [isSearchingAccounts, setIsSearchingAccounts] = useState(false)
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
  const isSaving = isLoading || isCartLoading || isCartUpdating || isBagSubmitting
  const cartLoadRequestRef = useRef(0)

  const applyLojinhaCart = useCallback((cart: any) => {
    if (cart.status !== 'open') {
      setLojinhaCartId(null)
      setLojinhaCartVersion(null)
      setCartItems({})
      setCartItemSnapshots({})
      return
    }

    setLojinhaCartId(cart.id)
    setLojinhaCartVersion(Number(cart.version))
    const quantities: Record<string, number> = {}
    const snapshots: Record<string, CartItemSnapshot> = {}
    for (const item of cart.items || []) {
      quantities[item.product_id] = item.quantity
      snapshots[item.product_id] = {
        product_name: item.product_name,
        price: Number(item.price),
        image_url: item.image_url || null,
      }
    }
    setCartItems(quantities)
    setCartItemSnapshots(snapshots)
  }, [])

  const refreshLojinhaCart = async (cartId: string) => {
    const response = await api.getLojinhaCart({ cartId })
    if (!response.success) {
      throw new Error(response.error || 'Erro ao atualizar carrinho')
    }
    if (selectedAccount?.id === response.data.user_id) applyLojinhaCart(response.data)
  }

  const loadLojinhaCartForAccount = async (userId: string) => {
    const requestId = ++cartLoadRequestRef.current
    setIsCartLoading(true)
    setCartItems({})
    setCartItemSnapshots({})
    setLojinhaCartId(null)
    setLojinhaCartVersion(null)
    try {
      const response = await api.getLojinhaCart({ userId })
      if (!response.success) {
        throw new Error(response.error || 'Erro ao buscar carrinho')
      }
      if (requestId === cartLoadRequestRef.current) applyLojinhaCart(response.data)
    } finally {
      if (requestId === cartLoadRequestRef.current) setIsCartLoading(false)
    }
  }

  const mutateLojinhaCart = async (data: Record<string, unknown>) => {
    if (!lojinhaCartId && !selectedAccount) {
      showWarning('Carrinho indisponível', 'Selecione uma conta antes de adicionar produtos.')
      return
    }

    setIsCartUpdating(true)
    let targetCartId = lojinhaCartId
    try {
      if (!targetCartId && selectedAccount) {
        const cartResponse = await api.getLojinhaCart({ userId: selectedAccount.id })
        if (!cartResponse.success) {
          throw new Error(cartResponse.error || 'Erro ao criar carrinho')
        }
        if (selectedAccount?.id === cartResponse.data.user_id) applyLojinhaCart(cartResponse.data)
        targetCartId = cartResponse.data.id
      }

      if (!targetCartId) throw new Error('Carrinho não encontrado')

      const response = await api.manageLojinhaCart({ ...data, cartId: targetCartId })
      if (!response.success) {
        throw new Error(response.error || 'Erro ao atualizar carrinho')
      }

      if (selectedAccount?.id === response.data.user_id) applyLojinhaCart(response.data)
      const loadedProducts = await productService.getProducts('lojinha')
      setProducts(loadedProducts)
    } catch (mutationError) {
      const message = mutationError instanceof Error ? mutationError.message : 'Erro ao atualizar carrinho'
      showError('Erro no carrinho', message)
      if (targetCartId) {
        await refreshLojinhaCart(targetCartId).catch(error => {
          console.error('Erro ao recarregar carrinho após falha:', error)
        })
      }
    } finally {
      setIsCartUpdating(false)
    }
  }

  const loadProducts = useCallback(async () => {
    if (context === 'lojinha') {
      const loadedProducts = await productService.getProducts('lojinha')
      setProducts(loadedProducts || [])
      setCurrentPage(1)
      return
    }

    const [allProducts, bagRes] = await Promise.all([
      productService.getProducts('lanchonete'),
      api.getAmbulanteBag(),
    ])

    const catalog = allProducts || []
    setGeneralLanchoneteProducts(catalog)

    if (!bagRes.success) {
      showError('Erro ao carregar bag', bagRes.error || 'Não foi possível carregar os itens da sua bag.')
      setBagItems([])
      setProducts([])
      setCurrentPage(1)
      return
    }

    const currentBag = bagRes.data || []
    setBagItems(currentBag)

    const bagAsProducts: Product[] = currentBag.map((entry) => {
      const catalogItem = catalog.find((p) => p.id === entry.productId)
      return {
        id: entry.product.id,
        name: entry.product.name,
        price: entry.product.price,
        category: 'lanchonete',
        description: entry.product.description || catalogItem?.description || null,
        stock: entry.quantity,
        active: entry.product.active,
        image_url: catalogItem?.image_url || null,
      } as Product
    })

    setProducts(bagAsProducts)
    setCurrentPage(1)
  }, [context, showError])

  const loadCoupons = async () => {
    if (context === 'lojinha') {
      setCoupons([])
      setCouponCode('')
      setIsCouponApplied(false)
      setCouponDiscountAmount(0)
      return
    }
    const loadedCoupons = await getCoupons(context)
    setCoupons(loadedCoupons || [])
  }

  useEffect(() => {
    void loadProducts()
    void loadCoupons()
    setCartItems({})
    setCartItemSnapshots({})
    setLojinhaCartId(null)
    setLojinhaCartVersion(null)
    setShowCancelCartConfirmation(false)
    setAccountSearch('')
    setSelectedAccount(null)
    setSearchFilter('')
    setCurrentPage(1)
    setBagModalMode(null)
    setBagDraftQuantities({})

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [context])

  useEffect(() => {
    if (context !== 'lojinha' || !lojinhaCartId || isCartUpdating || isCartLoading) return

    let active = true
    const refresh = async () => {
      try {
        const response = await api.getLojinhaCart({ cartId: lojinhaCartId })
        if (!active) return
        if (!response.success) {
          console.error('Erro ao sincronizar carrinho da lojinha:', response.error)
          return
        }
        if (selectedAccount?.id === response.data.user_id) applyLojinhaCart(response.data)
        const loadedProducts = await productService.getProducts('lojinha')
        if (active) setProducts(loadedProducts)
      } catch (syncError) {
        if (active) console.error('Erro ao sincronizar carrinho da lojinha:', syncError)
      }
    }

    const intervalId = setInterval(refresh, 5000)
    return () => {
      active = false
      clearInterval(intervalId)
    }
  }, [context, lojinhaCartId, isCartUpdating, isCartLoading, applyLojinhaCart])

  const handleOpenBagModal = async (mode: 'take' | 'return') => {
    setBagDraftQuantities({})
    setBagModalMode(mode)
    await loadProducts()
  }

  const handleChangeBagDraftQty = (productId: string, delta: number, maxAvailable: number | null) => {
    setBagDraftQuantities((prev) => {
      const current = prev[productId] || 0
      const next = Math.max(0, current + delta)
      const clamped = maxAvailable !== null && maxAvailable !== undefined ? Math.min(next, maxAvailable) : next
      const copy = { ...prev }
      if (clamped === 0) {
        delete copy[productId]
      } else {
        copy[productId] = clamped
      }
      return copy
    })
  }

  const handleConfirmBagAction = async () => {
    if (!bagModalMode) return
    const itemsToMove = Object.entries(bagDraftQuantities)
      .filter(([, qty]) => qty > 0)
      .map(([productId, quantity]) => ({ productId, quantity }))

    if (itemsToMove.length === 0) {
      showWarning('Nenhum item selecionado', 'Selecione ao menos uma unidade para continuar.')
      return
    }

    setIsBagSubmitting(true)
    try {
      const response =
        bagModalMode === 'take'
          ? await api.takeToAmbulanteBag(itemsToMove)
          : await api.returnFromAmbulanteBag(itemsToMove)

      if (!response.success) {
        throw new Error(response.error || 'Erro ao atualizar estoque da bag')
      }

      showSuccess(
        bagModalMode === 'take' ? 'Bag abastecida!' : 'Itens devolvidos!',
        bagModalMode === 'take'
          ? 'Os itens foram transferidos do estoque geral para a sua bag.'
          : 'As sobras foram devolvidas ao estoque geral da lanchonete.'
      )
      setBagModalMode(null)
      setBagDraftQuantities({})
      handleClearCart()
      await loadProducts()
    } catch (bagErr) {
      showError('Erro na bag', bagErr instanceof Error ? bagErr.message : 'Erro ao movimentar itens da bag')
    } finally {
      setIsBagSubmitting(false)
    }
  }

  const filteredProducts = useMemo(() => {
    if (!products || !Array.isArray(products)) return []
    if (!searchFilter.trim()) return products
    const filterLower = searchFilter.toLowerCase().trim()
    return products.filter(p => p && p.name && p.name.toLowerCase().includes(filterLower))
  }, [products, searchFilter])

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
      const price = context === 'lojinha'
        ? cartItemSnapshots[productId]?.price ?? p?.price
        : p?.price
      if (price === undefined) return acc
      return acc + price * qty
    }, 0)
  }, [cartItems, cartItemSnapshots, products, context])

  const discountedTotal = useMemo(() => {
    if (context === 'lanchonete' && isCouponApplied && couponCode && couponDiscountAmount > 0) {
      return Math.max(0, total - couponDiscountAmount)
    }
    return total
  }, [total, isCouponApplied, couponCode, couponDiscountAmount, context])

  const handleAddToCart = (product: Product) => {
    const pid = product.id
    if (!pid) return

    if (context === 'lojinha') {
      void mutateLojinhaCart({ action: 'add-item', productId: pid, quantity: 1 })
      return
    }

    if (product.stock !== null && product.stock !== undefined) {
      const currentQuantity = cartItems[pid] || 0
      if (product.stock === 0) {
        showWarning('Sem estoque na bag', `Você não possui mais "${product.name}" na sua bag.`)
        return
      }
      if (product.stock < currentQuantity + 1) {
        showWarning(
          'Estoque insuficiente na bag',
          `Você tem apenas ${product.stock} unidade${product.stock > 1 ? 's' : ''} de "${product.name}" na bag.`
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
    if (context === 'lojinha') {
      void mutateLojinhaCart({ action: 'decrease-item', productId })
      return
    }

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
    if (context === 'lojinha') {
      void mutateLojinhaCart({ action: 'add-item', productId, quantity: 1 })
      return
    }

    if (!products || !Array.isArray(products)) return
    const product = products.find(p => p && p.id === productId)
    if (!product) return

    if (product.stock !== null && product.stock !== undefined) {
      const currentQuantity = cartItems[productId] || 0
      if (product.stock === 0) {
        showWarning('Sem estoque na bag', `Você não possui mais "${product.name}" na sua bag.`)
        return
      }
      if (product.stock < currentQuantity + 1) {
        showWarning(
          'Estoque insuficiente na bag',
          `Você tem apenas ${product.stock} unidade${product.stock > 1 ? 's' : ''} de "${product.name}" na bag.`
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
    setCartItemSnapshots({})
    setCouponCode('')
    setCouponError(null)
    setIsCouponApplied(false)
    setCouponDiscountAmount(0)
  }

  const handleCancelLojinhaCart = async () => {
    if (!lojinhaCartId) return
    setIsCartUpdating(true)
    try {
      const response = await api.manageLojinhaCart({ action: 'cancel', cartId: lojinhaCartId })
      if (!response.success) {
        throw new Error(response.error || 'Erro ao cancelar carrinho')
      }

      applyLojinhaCart(response.data)
      setShowCancelCartConfirmation(false)
      setCouponCode('')
      setIsCouponApplied(false)
      setCouponDiscountAmount(0)
      const loadedProducts = await productService.getProducts('lojinha')
      setProducts(loadedProducts)
      showSuccess('Carrinho cancelado', 'Os produtos reservados foram devolvidos ao estoque.')
    } catch (cancelError) {
      const message = cancelError instanceof Error ? cancelError.message : 'Erro ao cancelar carrinho'
      showError('Erro ao cancelar', message)
    } finally {
      setIsCartUpdating(false)
    }
  }

  const searchTimeoutRef = React.useRef<NodeJS.Timeout | null>(null)
  const lastSearchRef = React.useRef<string>('')
  const currentInputRef = React.useRef<string>('')

  const handleSelectAccount = async (account: UserAccount) => {
    currentInputRef.current = ''
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    setAccountSearch(account.name || account.email)
    setAccountSuggestions([])
    setIsSearchingAccounts(false)
    setSelectedAccount(account)
    setError(null)
    setShowCancelCartConfirmation(false)
    if (context === 'lojinha') {
      try {
        await loadLojinhaCartForAccount(account.id)
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : 'Erro ao carregar carrinho'
        setError(message)
        showError('Erro ao carregar carrinho', message)
      }
    }
  }

  const handleAccountChoice = async (account: UserAccount) => {
    const setting = await api.getFeatureFlag('require_security_code')
    if (!setting.success) {
      setError('Não foi possível verificar a configuração de segurança. Tente novamente.')
      return
    }
    if (!setting.data.enabled) {
      await handleSelectAccount(account)
      return
    }
    setPendingAccount(account)
    setSecurityCode('')
    setSecurityError('')
  }

  const handleVerifySecurityCode = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!pendingAccount || !/^\d{4}$/.test(securityCode) || isVerifyingCode) return
    setIsVerifyingCode(true)
    setSecurityError('')
    try {
      const response = await api.verifySaleSecurityCode(pendingAccount.id, securityCode)
      if (!response.success) {
        setSecurityError(response.error || 'Não foi possível verificar o código.')
        setSecurityCode('')
        return
      }
      const account = pendingAccount
      setPendingAccount(null)
      setSecurityCode('')
      await handleSelectAccount(account)
    } catch {
      setSecurityError('Não foi possível verificar o código. Tente novamente.')
    } finally {
      setIsVerifyingCode(false)
    }
  }

  const handleAccountSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawValue = e.target.value
    const searchValue = rawValue.trim()
    currentInputRef.current = searchValue
    setAccountSearch(rawValue)
    setSelectedAccount(null)
    setAccountSuggestions([])
    setIsSearchingAccounts(false)
    setError(null)

    if (context === 'lojinha') {
      cartLoadRequestRef.current += 1
      setIsCartLoading(false)
      setLojinhaCartId(null)
      setLojinhaCartVersion(null)
      setCartItems({})
      setCartItemSnapshots({})
      setShowCancelCartConfirmation(false)
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    if (searchValue.length < 2) return

    setIsSearchingAccounts(true)
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const accounts = await searchAccountsByName(searchValue)
        if (currentInputRef.current !== searchValue) return
        setAccountSuggestions(accounts)
        if (accounts.length === 0) setError('Nenhuma conta encontrada.')
      } catch (err) {
        if (currentInputRef.current !== searchValue) return
        setError(err instanceof Error ? err.message : 'Erro ao buscar conta')
      } finally {
        if (currentInputRef.current === searchValue) setIsSearchingAccounts(false)
      }
    }, 400)
  }

  const handleConfirmSale = async () => {
    setError(null)

    if (!products || !Array.isArray(products) || products.length === 0) {
      setError('Produtos ainda não foram carregados. Aguarde um momento e tente novamente.')
      showError('Erro', 'Produtos ainda não foram carregados. Aguarde um momento e tente novamente.')
      return
    }

    const items: SaleItem[] = []
    for (const [productId, quantity] of Object.entries(cartItems)) {
      const product = products.find(item => item?.id === productId)
      const snapshot = cartItemSnapshots[productId]
      const productName = snapshot?.product_name || product?.name
      const price = snapshot?.price ?? product?.price
      if (!productName || price === undefined) {
        const message = `Produto com ID ${productId} não encontrado no carrinho`
        setError(message)
        showError('Erro', message)
        return
      }

      items.push({
        id: product?.id || productId,
        productId,
        productName,
        price,
        quantity,
        image: snapshot?.image_url || product?.image_url || null,
      })
    }

    if (items.length === 0) {
      setError('Nenhum item válido no carrinho')
      showError('Erro', 'Nenhum item válido no carrinho')
      return
    }

    if (context === 'lanchonete') {
      const stockErrors: string[] = []
      for (const item of items) {
        const product = products.find(p => p.id === item.productId)
        if (!product) {
          stockErrors.push(`Produto "${item.productName}" não encontrado na sua bag`)
          continue
        }

        if (product.stock !== null && product.stock !== undefined) {
          if (product.stock === 0) {
            stockErrors.push(`Você não possui mais "${product.name}" na sua bag`)
          } else if (product.stock < item.quantity) {
            stockErrors.push(`Estoque insuficiente na bag para "${product.name}". Você possui ${product.stock} unidade${product.stock > 1 ? 's' : ''}, mas tentou vender ${item.quantity}`)
          }
        }
      }

      if (stockErrors.length > 0) {
        const errorMessage = stockErrors.length === 1
          ? stockErrors[0]
          : `Não é possível finalizar a venda:\n${stockErrors.map((e, i) => `${i + 1}. ${e}`).join('\n')}`
        setError(errorMessage)
        showError('Erro no estoque da bag', errorMessage)
        return
      }
    }

    setIsLoading(true)
    try {
      if (!selectedAccount || !selectedAccount.id) {
        throw new Error('Conta não selecionada')
      }

      if (!items || items.length === 0) {
        throw new Error('Nenhum item no carrinho')
      }

      await makeSale(
        selectedAccount.id,
        items,
        context,
        context === 'lanchonete' && isCouponApplied ? couponCode : '',
        discountedTotal,
        context === 'lojinha' ? lojinhaCartId || undefined : undefined,
        context === 'lojinha' ? lojinhaCartVersion ?? undefined : undefined
      )

      await loadProducts()

      showSuccess(
        'Venda realizada!',
        `Venda de R$ ${discountedTotal.toFixed(2)} para ${selectedAccount.name || selectedAccount.email} foi realizada com sucesso.`
      )
      setAccountSearch('')
      lastSearchRef.current = ''
      setSelectedAccount(null)
      handleClearCart()
      setLojinhaCartId(null)
      setLojinhaCartVersion(null)
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
    if (context === 'lojinha' && (!lojinhaCartId || lojinhaCartVersion === null || isCartLoading || isCartUpdating)) {
      showWarning('Carrinho indisponível', 'Aguarde o carregamento ou atualização do carrinho.')
      return
    }
    if (Object.keys(cartItems).length === 0) {
      showWarning('Carrinho vazio', 'Adicione ao menos um item para finalizar a venda.')
      return
    }
    if (!selectedAccount) {
      showWarning('Conta não selecionada', 'Digite o e-mail completo de uma conta válida para realizar a venda.')
      return
    }
    if (discountedTotal > selectedAccount.balance) {
      showError('Saldo insuficiente', 'O saldo da conta é insuficiente para concluir a compra.')
      return
    }
    setShowConfirmation(true)
  }

  const handleCancelConfirmation = () => setShowConfirmation(false)

  const formatPrice = (price: number): string => price.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const totalUnitsInBag = useMemo(
    () => bagItems.reduce((sum, item) => sum + item.quantity, 0),
    [bagItems]
  )

  const config = context === 'lojinha' ? {
    title: 'Vendas · Lojinha',
    stamp: '🎫 Bilheteria',
    subtitle: 'Adicione itens ao carrinho e finalize a venda',
    icon: '🛍️'
  } : {
    title: 'Vendas Ambulantes · Lanchonete',
    stamp: '☕ Vagão-restaurante',
    subtitle: 'Venda itens da sua bag ou abasteça/devolva produtos do estoque geral',
    icon: '🍔'
  }

  const smallBtn = 'p-0 flex items-center justify-center rounded-lg font-bold transition-colors'

  return (
    <div className="painel p-4 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <span className="carimbo text-vagao-600 text-xs">{config.stamp}</span>
            <h2 className="mt-3 text-2xl md:text-3xl font-display font-semibold uppercase tracking-wide text-ferro-900">
              {config.title}
            </h2>
            <p className="text-base text-ferro-700">{config.subtitle}</p>
          </div>

          {context === 'lanchonete' && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-2 rounded-lg bg-creme-200 border border-ferro-300 text-xs font-semibold text-ferro-800">
                🎒 Na bag: {totalUnitsInBag} {totalUnitsInBag === 1 ? 'unidade' : 'unidades'}
              </span>
              <button
                type="button"
                onClick={() => void handleOpenBagModal('take')}
                disabled={isSaving}
                className="px-3.5 py-2 bg-ferro-800 hover:bg-ferro-700 text-creme-100 font-display font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                + Abastecer Bag
              </button>
              <button
                type="button"
                onClick={() => void handleOpenBagModal('return')}
                disabled={isSaving || bagItems.length === 0}
                className="px-3.5 py-2 bg-creme-200 hover:bg-creme-300 text-ferro-900 border border-ferro-300 font-display font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
              >
                ↩️ Devolver Sobras
              </button>
            </div>
          )}
        </div>
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
            placeholder={context === 'lanchonete' ? '🔍 Buscar produto na sua bag...' : '🔍 Buscar produto...'}
            className="w-full"
          />

          {/* Grid de Produtos */}
          {paginatedProducts.length === 0 ? (
            <div className="bg-creme-100 rounded-xl border border-ferro-200 p-8 text-center space-y-3">
              <div className="text-5xl mb-2">{context === 'lanchonete' ? '🎒' : '🚉'}</div>
              <p className="text-ferro-700 font-medium">
                {searchFilter
                  ? 'Nenhum produto encontrado.'
                  : context === 'lanchonete'
                    ? 'Sua bag está vazia no momento.'
                    : 'Nenhum produto disponível.'}
              </p>
              {context === 'lanchonete' && !searchFilter && (
                <button
                  type="button"
                  onClick={() => void handleOpenBagModal('take')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-ferro-800 hover:bg-ferro-700 text-creme-100 font-display font-semibold text-sm rounded-lg transition-colors"
                >
                  + Pegar itens do estoque geral
                </button>
              )}
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
                      <p className="text-xs text-ferro-600 mb-2">
                        {context === 'lanchonete' ? 'Na sua bag' : 'Estoque disponível'}: {p.stock} {p.stock === 1 ? 'unidade' : 'unidades'}
                      </p>
                      <p className="font-slab text-lg text-vagao-600 mb-3 mt-auto">R$ {formatPrice(p.price)}</p>
                      <button
                        onClick={() => handleAddToCart(p)}
                        disabled={isSaving || (context === 'lojinha' && !selectedAccount)}
                        className="w-full bg-ferro-800 hover:bg-ferro-700 text-creme-200 font-display font-semibold tracking-wide text-sm py-2 px-2 rounded-lg transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
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

            {/* Conta a debitar */}
            <div className="mb-3 space-y-2">
              <label htmlFor="account-search" className="block text-sm font-semibold text-ferro-700 mb-1">Nome ou e-mail do cliente</label>
              <input
                id="account-search"
                type="text"
                value={accountSearch}
                onChange={handleAccountSearchChange}
                className="w-full"
                placeholder="Digite o nome ou e-mail"
                autoComplete="off"
              />

              {accountSuggestions.length > 0 && !selectedAccount && (
                <ul aria-label="Sugestões de clientes" className="max-h-48 overflow-y-auto rounded-lg border border-ferro-200 bg-creme-50">
                  {accountSuggestions.map((account) => (
                    <li key={account.id}>
                      <button type="button" onClick={() => void handleAccountChoice(account)} className="w-full px-3 py-2 text-left hover:bg-creme-200 focus:bg-creme-200">
                        <span className="block text-sm font-semibold text-ferro-900">{account.name || 'Sem nome'}</span>
                        <span className="block break-all text-xs text-ferro-600">{account.email}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {selectedAccount ? (
                <div className="bg-creme-200 rounded-lg p-3 border border-ferro-200 space-y-0.5">
                  <p className="text-sm text-ferro-900">
                    <span className="text-ferro-500">Nome:</span> <strong>{selectedAccount.name}</strong>
                  </p>
                  <p className="text-sm text-ferro-900">
                    <span className="text-ferro-500">Saldo:</span> <span className="font-slab">R$ {selectedAccount.balance.toFixed(2)}</span>
                  </p>
                  <p className={`text-sm font-semibold ${
                    discountedTotal > selectedAccount.balance ? 'text-vagao-600' : 'text-green-700'
                  }`}>
                    <span className="text-ferro-500 font-normal">Após:</span> <span className="font-slab">R$ {(selectedAccount.balance - discountedTotal).toFixed(2)}</span>
                  </p>
                </div>
              ) : (
                <p className={`text-sm ${error ? 'text-vagao-600' : 'text-ferro-500'}`}>
                  {error || (isSearchingAccounts ? 'Buscando clientes...' : accountSuggestions.length ? 'Selecione um cliente da lista.' : 'Digite pelo menos 2 caracteres para localizar a conta.')}
                </p>
              )}
            </div>

            {context === 'lojinha' && (
              <p className="mb-3 text-xs text-ferro-600">
                {isCartLoading
                  ? 'Carregando carrinho compartilhado...'
                  : lojinhaCartId
                    ? 'Carrinho compartilhado: alterações de outros vendedores são sincronizadas automaticamente.'
                    : selectedAccount
                      ? error || 'Carrinho encerrado. Um novo será criado ao adicionar um produto.'
                      : 'Selecione um cliente para carregar ou criar o carrinho compartilhado.'}
              </p>
            )}

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
                    const p = products.find(pr => pr.id === productId)
                    const snapshot = cartItemSnapshots[productId]
                    const productName = snapshot?.product_name || p?.name || 'Produto indisponível'
                    const productPrice = snapshot?.price ?? p?.price ?? 0
                    return (
                      <div key={productId} className="bg-creme-50 p-2 rounded-lg border border-ferro-200">
                        <div className="flex items-center gap-2">
                          <OptimizedImage
                            src={snapshot?.image_url || p?.image_url || ''}
                            alt={productName}
                            className="w-10 h-10 rounded object-cover flex-shrink-0"
                            context={context}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-ferro-900 truncate leading-tight">{productName}</p>
                            <p className="text-xs text-ferro-500">R$ {formatPrice(productPrice)}</p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleDecrease(productId)}
                              disabled={isSaving}
                              className={`${smallBtn} w-8 h-8 bg-creme-200 hover:bg-creme-300 border border-ferro-200 text-ferro-800 text-base`}
                              aria-label="Diminuir"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-sm font-semibold text-ferro-900">{qty}</span>
                            <button
                              onClick={() => handleIncrease(productId)}
                              disabled={isSaving}
                              className={`${smallBtn} w-8 h-8 bg-creme-200 hover:bg-creme-300 border border-ferro-200 text-ferro-800 text-base`}
                              aria-label="Aumentar"
                            >
                              +
                            </button>
                          </div>
                          <div className="font-slab text-sm text-ferro-900">
                            R$ {formatPrice(productPrice * qty)}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Cupom (apenas Vendas Ambulantes / Lanchonete) */}
                {context === 'lanchonete' && (
                  <div className="pt-2 border-t border-ferro-200">
                    <label className="block text-sm font-semibold text-ferro-700 mb-1">Cupom</label>
                    <div className="flex gap-2">
                      <select
                        value={couponCode}
                        onChange={e => {
                          setCouponCode(e.target.value)
                          if (e.target.value) {
                            const selectedCoupon = coupons.find(c => c.name === e.target.value)
                            if (selectedCoupon && selectedCoupon.discountAmount) {
                              setCouponDiscountAmount(selectedCoupon.discountAmount)
                            } else {
                              setCouponDiscountAmount(0)
                            }
                          } else {
                            setCouponDiscountAmount(0)
                          }
                        }}
                        disabled={isSaving || isCouponApplied}
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
                          if (!isCouponApplied && couponCode) {
                            setIsCouponApplied(true)
                            const selectedCoupon = coupons.find(c => c.name === couponCode)
                            const discount = selectedCoupon?.discountAmount || 0
                            showSuccess('Cupom aplicado!', `Desconto de R$ ${discount.toFixed(2)}`)
                          }
                        }}
                        disabled={isSaving || isCouponApplied || !couponCode}
                        className="px-3 py-2 bg-latao-400 hover:bg-latao-300 text-ferro-900 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed font-display font-semibold rounded-lg text-sm flex-shrink-0"
                      >
                        Aplicar
                      </button>
                    </div>
                    {isCouponApplied && (
                      <p className="text-xs text-green-700 font-semibold mt-1">
                        ✓ -R$ {couponDiscountAmount.toFixed(2)}
                      </p>
                    )}
                  </div>
                )}

                {/* Total */}
                <div className="picote-horizontal pt-3 space-y-0.5">
                  {context === 'lanchonete' && isCouponApplied && (
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
                    onClick={() => context === 'lojinha'
                      ? setShowCancelCartConfirmation(true)
                      : handleClearCart()}
                    disabled={isSaving}
                    className="flex-1 bg-creme-200 hover:bg-creme-300 text-ferro-800 border border-ferro-200 font-display font-semibold py-2.5 px-2 rounded-lg text-sm disabled:opacity-50"
                  >
                    {context === 'lojinha' ? 'Cancelar carrinho' : 'Limpar'}
                  </button>
                  <button
                    onClick={handleOpenConfirmation}
                    disabled={isSaving}
                    className="flex-1 bg-vagao-600 hover:bg-vagao-700 text-creme-50 font-display font-semibold tracking-wide py-2.5 px-2 rounded-lg disabled:opacity-50 text-sm shadow-sm"
                  >
                    {isSaving ? 'Salvando...' : 'Finalizar'}
                  </button>
                </div>
                {context === 'lojinha' && showCancelCartConfirmation && (
                  <div className="rounded-lg border border-vagao-300 bg-vagao-50 p-3">
                    <p className="text-sm text-ferro-800">
                      Cancelar este carrinho devolverá ao estoque todas as unidades reservadas.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCancelCartConfirmation(false)}
                        disabled={isSaving}
                        className="flex-1 rounded-lg border border-ferro-300 bg-creme-50 px-2 py-2 text-sm text-ferro-800 disabled:opacity-50"
                      >
                        Voltar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleCancelLojinhaCart()}
                        disabled={isSaving}
                        className="flex-1 rounded-lg bg-vagao-600 px-2 py-2 text-sm font-semibold text-creme-50 disabled:opacity-50"
                      >
                        Confirmar cancelamento
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Movimentação da Bag (Abastecer / Devolver) */}
      {context === 'lanchonete' && bagModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-creme-50 rounded-2xl border-2 border-ferro-800 shadow-bilhete w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-ferro-200 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-display font-semibold uppercase text-ferro-900">
                  {bagModalMode === 'take' ? '🎒 Abastecer Bag' : '↩️ Devolver Sobras ao Estoque'}
                </h3>
                <p className="text-xs text-ferro-600 mt-0.5">
                  {bagModalMode === 'take'
                    ? 'Escolha quantos itens deseja retirar do estoque geral para vender.'
                    : 'Escolha quantos itens da sua bag deseja devolver ao estoque geral.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setBagModalMode(null)}
                disabled={isBagSubmitting}
                className="text-ferro-600 hover:text-ferro-900 font-bold text-lg px-2"
              >
                ✕
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-2.5 flex-1">
              {bagModalMode === 'take' ? (
                generalLanchoneteProducts.filter(p => p.active !== false).length === 0 ? (
                  <p className="text-center text-sm text-ferro-600 py-6">Nenhum produto cadastrado na lanchonete.</p>
                ) : (
                  generalLanchoneteProducts
                    .filter((p): p is Product & { id: string } => p.active !== false && Boolean(p.id))
                    .map(prod => {
                      const availableGeneral = prod.stock ?? null
                      const selectedQty = bagDraftQuantities[prod.id] || 0
                      const currentInBag = bagItems.find(b => b.productId === prod.id)?.quantity || 0
                      return (
                        <div key={prod.id} className="flex items-center justify-between gap-3 bg-creme-100 p-3 rounded-xl border border-ferro-200">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-sm text-ferro-900 truncate">{prod.name}</p>
                            <p className="text-xs text-ferro-600">
                              Estoque geral: <strong>{availableGeneral === null ? 'Ilimitado' : `${availableGeneral} un.`}</strong>
                              {currentInBag > 0 && ` · Já na bag: ${currentInBag}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleChangeBagDraftQty(prod.id, -1, availableGeneral)}
                              disabled={isBagSubmitting || selectedQty === 0}
                              className={`${smallBtn} w-8 h-8 bg-creme-200 hover:bg-creme-300 border border-ferro-300 text-ferro-900 text-base leading-none disabled:opacity-40`}
                            >
                              −
                            </button>
                            <span className="w-7 text-center font-semibold text-sm text-ferro-900">{selectedQty}</span>
                            <button
                              type="button"
                              onClick={() => handleChangeBagDraftQty(prod.id, 1, availableGeneral)}
                              disabled={isBagSubmitting || (availableGeneral !== null && selectedQty >= availableGeneral)}
                              className={`${smallBtn} w-8 h-8 bg-ferro-800 hover:bg-ferro-700 text-creme-100 text-base leading-none disabled:opacity-40`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      )
                    })
                )
              ) : bagItems.length === 0 ? (
                <p className="text-center text-sm text-ferro-600 py-6">Sua bag não possui itens para devolver.</p>
              ) : (
                bagItems.map(entry => {
                  const selectedQty = bagDraftQuantities[entry.productId] || 0
                  return (
                    <div key={entry.productId} className="flex items-center justify-between gap-3 bg-creme-100 p-3 rounded-xl border border-ferro-200">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-sm text-ferro-900 truncate">{entry.product.name}</p>
                        <p className="text-xs text-ferro-600">
                          Na sua bag: <strong>{entry.quantity} un.</strong>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleChangeBagDraftQty(entry.productId, -1, entry.quantity)}
                          disabled={isBagSubmitting || selectedQty === 0}
                          className={`${smallBtn} w-8 h-8 bg-creme-200 hover:bg-creme-300 border border-ferro-300 text-ferro-900 text-base leading-none disabled:opacity-40`}
                        >
                          −
                        </button>
                        <span className="w-7 text-center font-semibold text-sm text-ferro-900">{selectedQty}</span>
                        <button
                          type="button"
                          onClick={() => handleChangeBagDraftQty(entry.productId, 1, entry.quantity)}
                          disabled={isBagSubmitting || selectedQty >= entry.quantity}
                          className={`${smallBtn} w-8 h-8 bg-ferro-800 hover:bg-ferro-700 text-creme-100 text-base leading-none disabled:opacity-40`}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="p-4 border-t border-ferro-200 bg-creme-100 flex gap-2">
              <button
                type="button"
                onClick={() => setBagModalMode(null)}
                disabled={isBagSubmitting}
                className="flex-1 py-2.5 px-3 rounded-lg bg-creme-200 hover:bg-creme-300 text-ferro-800 border border-ferro-300 font-display font-semibold text-sm disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmBagAction()}
                disabled={isBagSubmitting || Object.keys(bagDraftQuantities).length === 0}
                className="flex-1 py-2.5 px-3 rounded-lg bg-vagao-600 hover:bg-vagao-700 text-creme-50 font-display font-semibold text-sm disabled:opacity-50"
              >
                {isBagSubmitting
                  ? 'Salvando...'
                  : bagModalMode === 'take'
                    ? 'Confirmar Retirada'
                    : 'Confirmar Devolução'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação */}
      {pendingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-labelledby="security-code-title">
          <form onSubmit={handleVerifySecurityCode} className="w-full max-w-sm rounded-xl border-2 border-ferro-800 bg-creme-100 p-5 shadow-xl">
            <h2 id="security-code-title" className="text-lg font-display font-semibold text-ferro-900">Código de segurança</h2>
            <p className="mt-2 text-sm text-ferro-700">Informe os 4 últimos números do WhatsApp cadastrado de {pendingAccount.name || pendingAccount.email}.</p>
            <label htmlFor="security-code" className="mt-4 block text-sm font-semibold text-ferro-700">Código de segurança</label>
            <input id="security-code" type="password" inputMode="numeric" autoComplete="off" maxLength={4} autoFocus value={securityCode}
              onChange={(event) => { setSecurityCode(event.target.value.replace(/\D/g, '').slice(0, 4)); setSecurityError('') }}
              className="mt-1 w-full" placeholder="4 dígitos" disabled={isVerifyingCode} />
            {securityError && <p role="alert" className="mt-2 text-sm text-vagao-600">{securityError}</p>}
            <div className="mt-5 flex gap-2">
              <button type="button" disabled={isVerifyingCode} onClick={() => { setPendingAccount(null); setSecurityCode(''); setSecurityError('') }} className="flex-1 rounded-lg border border-ferro-300 bg-creme-200 px-3 py-2 text-ferro-800">Cancelar</button>
              <button type="submit" disabled={isVerifyingCode || securityCode.length !== 4} className="flex-1 rounded-lg bg-vagao-600 px-3 py-2 text-creme-50 disabled:opacity-50">{isVerifyingCode ? 'Verificando...' : 'Confirmar'}</button>
            </div>
          </form>
        </div>
      )}
      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={handleCancelConfirmation}
        onConfirm={() => { setShowConfirmation(false); handleConfirmSale() }}
        title={context === 'lojinha' ? 'Confirmar Venda' : 'Confirmar Venda Ambulante'}
        icon={config.icon}
        account={selectedAccount}
        variant="account-transaction"
        transactionType="debit"
        amount={discountedTotal.toFixed(2)}
        formattedAmount={discountedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        description={`${Object.entries(cartItems).map(([id, q]) => {
          const p = products.find(pp => pp.id === id)
          const productName = cartItemSnapshots[id]?.product_name || p?.name
          return productName ? `${productName} (${q}x)` : ''
        }).filter(Boolean).join(', ')}`}
        isLoading={isSaving}
      />

      {/* Modal de Loading - Bloqueia a tela durante o processamento */}
      {isLoading && (
        <TrainLoader
          title={context === 'lojinha' ? 'Processando venda...' : 'Processando venda ambulante...'}
          message={`Por favor, aguarde enquanto finalizamos ${context === 'lojinha' ? 'a venda' : 'a venda ambulante'}`}
        />
      )}
    </div>
  )
}

export default SalesPage
