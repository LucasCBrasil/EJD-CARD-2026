import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { TrainLoader } from '../../components/shared'
import OptimizedImage from '../../components/ui/OptimizedImage'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
import {
  LanchoneteOrderError,
  useCreateSelfOrder,
  useLanchoneteMenu,
  useMyBalance,
  useSelfOrderEnabled,
  type MenuProduct,
} from '../../hooks/useLanchoneteOrders'

// Mesmos limites da RPC create_lanchonete_self_order (o servidor é quem garante)
const MAX_PER_ITEM = 10
const MAX_PER_ORDER = 20

const formatPrice = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

interface PlacedOrder {
  saleNumber: number
  total: number
  newBalance: number
  items: { name: string; quantity: number; price: number }[]
}

const SelfOrderPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showError, showWarning } = useToastContext()

  const flag = useSelfOrderEnabled()
  const menu = useLanchoneteMenu()
  const balance = useMyBalance()
  const createOrder = useCreateSelfOrder()

  const [cart, setCart] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [isReviewOpen, setIsReviewOpen] = useState(false)
  const [placedOrder, setPlacedOrder] = useState<PlacedOrder | null>(null)
  // Mesmo requestId em retentativas da mesma confirmação: o servidor não duplica o pedido
  const requestIdRef = useRef<string | null>(null)

  const products = menu.data || []
  const productsById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const filteredProducts = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term ? products.filter((p) => p.name.toLowerCase().includes(term)) : products
  }, [products, search])

  const cartLines = useMemo(
    () => Object.entries(cart)
      .map(([id, quantity]) => ({ product: productsById.get(id), quantity }))
      .filter((line): line is { product: MenuProduct; quantity: number } => !!line.product && line.quantity > 0),
    [cart, productsById],
  )
  const totalUnits = cartLines.reduce((sum, line) => sum + line.quantity, 0)
  const total = Math.round(cartLines.reduce((sum, line) => sum + line.product.price * line.quantity, 0) * 100) / 100
  const currentBalance = balance.data ?? 0
  const hasEnoughBalance = currentBalance >= total

  // Item saiu do cardápio (removido/inativado) enquanto estava no carrinho
  useEffect(() => {
    if (!menu.data) return
    const removed = Object.keys(cart).filter((id) => !productsById.has(id))
    if (removed.length === 0) return
    setCart((prev) => {
      const next = { ...prev }
      removed.forEach((id) => delete next[id])
      return next
    })
    showWarning('Cardápio atualizado', 'Um item do seu carrinho não está mais disponível e foi removido.')
  }, [menu.data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Carrinho mudou: a próxima confirmação é um pedido novo
  useEffect(() => {
    requestIdRef.current = null
  }, [cart])

  const maxFor = (product: MenuProduct) => Math.min(MAX_PER_ITEM, product.stock ?? MAX_PER_ITEM)

  const changeQuantity = (product: MenuProduct, delta: number) => {
    setCart((prev) => {
      const current = prev[product.id] || 0
      const next = current + delta
      if (delta > 0) {
        if (next > maxFor(product)) {
          showWarning('Limite do item', product.stock !== null && product.stock < MAX_PER_ITEM
            ? `Só restam ${product.stock} unidade(s) de ${product.name}.`
            : `Máximo de ${MAX_PER_ITEM} unidades por item.`)
          return prev
        }
        if (totalUnits + delta > MAX_PER_ORDER) {
          showWarning('Limite do pedido', `O pedido pode ter no máximo ${MAX_PER_ORDER} unidades.`)
          return prev
        }
      }
      const updated = { ...prev }
      if (next <= 0) delete updated[product.id]
      else updated[product.id] = next
      return updated
    })
  }

  const handleOrderError = (error: unknown) => {
    const code = error instanceof LanchoneteOrderError ? error.code : undefined
    const message = error instanceof Error ? error.message : 'Erro ao enviar o pedido'
    const productName = error instanceof LanchoneteOrderError ? error.details?.productName : undefined

    switch (code) {
      case 'PRODUCT_UNAVAILABLE':
      case 'OUT_OF_STOCK': {
        const productId = (error as LanchoneteOrderError).details?.productId
        const available = (error as LanchoneteOrderError).details?.available
        setCart((prev) => {
          const next = { ...prev }
          if (code === 'OUT_OF_STOCK' && typeof available === 'number' && available > 0) next[productId] = available
          else delete next[productId]
          return next
        })
        void menu.refetch()
        showWarning(
          code === 'OUT_OF_STOCK' ? 'Estoque acabou' : 'Item indisponível',
          code === 'OUT_OF_STOCK' && available > 0
            ? `${productName || 'Um item'} tem só ${available} unidade(s). Ajustamos seu carrinho, confira e confirme de novo.`
            : `${productName || 'Um item'} saiu do cardápio e foi removido do carrinho. Confira e confirme de novo.`,
        )
        return
      }
      case 'INSUFFICIENT_BALANCE':
        void balance.refetch()
        showError('Saldo insuficiente', 'Seu saldo não cobre este pedido. Remova itens ou recarregue seu saldo.')
        return
      case 'SELF_ORDER_DISABLED':
        setIsReviewOpen(false)
        void flag.refetch()
        showWarning('Lanchonete fechada', message)
        return
      default:
        showError('Pedido não enviado', message)
    }
  }

  const handleConfirm = () => {
    if (cartLines.length === 0 || createOrder.isPending) return
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID()

    const items = cartLines.map((line) => ({ productId: line.product.id, quantity: line.quantity }))
    const snapshot = cartLines.map((line) => ({ name: line.product.name, quantity: line.quantity, price: line.product.price }))

    createOrder.mutate(
      { items, requestId: requestIdRef.current },
      {
        onSuccess: (data) => {
          setPlacedOrder({ saleNumber: data.saleNumber, total: data.total, newBalance: data.newBalance, items: snapshot })
          setCart({})
          setIsReviewOpen(false)
          window.scrollTo({ top: 0, behavior: 'smooth' })
        },
        onError: handleOrderError,
      },
    )
  }

  if (flag.isLoading || menu.isLoading || balance.isLoading) {
    return <div className="painel py-10 text-center text-ferro-600">Carregando o cardápio...</div>
  }

  if (placedOrder) {
    return (
      <div className="painel p-4 md:p-8 space-y-5">
        <div className="text-center">
          <span className="carimbo text-green-700 text-xs">✓ Pedido enviado</span>
          <p className="mt-4 font-display text-sm tracking-[0.3em] uppercase text-ferro-500">Seu pedido</p>
          <p className="font-ticket text-6xl font-bold text-ferro-900 leading-none mt-1">Nº {placedOrder.saleNumber}</p>
          <p className="mt-2 text-lg font-display font-semibold text-ferro-900">{user?.name || user?.email}</p>
          <p className="text-ferro-700 mt-1">Mostre este número no balcão da Lanchonete para retirar.</p>
        </div>

        <div className="bilhete !p-4 space-y-1">
          {placedOrder.items.map((item) => (
            <div key={item.name} className="flex justify-between gap-3 text-ferro-900">
              <span>{item.quantity}× {item.name}</span>
              <span className="font-slab">R$ {formatPrice(item.price * item.quantity)}</span>
            </div>
          ))}
          <div className="picote-horizontal pt-2 mt-2 flex justify-between font-semibold text-ferro-900">
            <span>Total debitado</span>
            <span className="font-slab text-vagao-600">R$ {formatPrice(placedOrder.total)}</span>
          </div>
          <div className="flex justify-between text-sm text-ferro-600">
            <span>Saldo restante</span>
            <span className="font-slab">R$ {formatPrice(placedOrder.newBalance)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => navigate({ to: '/lanchonete/meus-pedidos' as any })}
            className="w-full bg-ferro-800 hover:bg-ferro-700 text-creme-200 font-display font-semibold tracking-wide py-3 rounded-lg active:scale-[0.98] touch-manipulation"
          >
            Acompanhar meus pedidos
          </button>
          <button
            type="button"
            onClick={() => setPlacedOrder(null)}
            className="w-full bg-creme-200 hover:bg-creme-300 text-ferro-800 border border-ferro-200 font-display font-semibold tracking-wide py-3 rounded-lg active:scale-[0.98] touch-manipulation"
          >
            Fazer outro pedido
          </button>
        </div>
      </div>
    )
  }

  if (!flag.data) {
    return (
      <div className="painel p-6 md:p-8 text-center space-y-3">
        <div className="text-5xl">🚧</div>
        <h2 className="text-2xl font-display font-semibold uppercase tracking-wide text-ferro-900">Lanchonete fechada</h2>
        <p className="text-ferro-700">Os pedidos pelo app estão fechados no momento. Volte mais tarde!</p>
        <button
          type="button"
          onClick={() => navigate({ to: '/lanchonete/meus-pedidos' as any })}
          className="mt-2 bg-ferro-800 hover:bg-ferro-700 text-creme-200 font-display font-semibold tracking-wide py-3 px-6 rounded-lg touch-manipulation"
        >
          Ver meus pedidos
        </button>
      </div>
    )
  }

  return (
    <div className="painel p-4 md:p-8 pb-32">
      <div className="mb-5">
        <span className="carimbo text-vagao-600 text-xs">☕ Vagão-restaurante</span>
        <h2 className="mt-3 text-2xl md:text-3xl font-display font-semibold uppercase tracking-wide text-ferro-900">
          Fazer pedido
        </h2>
        <p className="text-base text-ferro-700">Escolha seus lanches e pague com o seu saldo</p>
        <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-creme-200 border border-ferro-200 px-3 py-2">
          <span className="text-sm text-ferro-600">Seu saldo:</span>
          <span className="font-slab text-lg text-ferro-900">R$ {formatPrice(currentBalance)}</span>
        </div>
        <div className="trilho w-full mt-4" />
      </div>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Buscar no cardápio..."
        className="w-full mb-4"
      />

      {menu.isError ? (
        <div role="alert" className="bg-creme-100 rounded-xl border border-ferro-200 p-8 text-center text-vagao-700">
          Não foi possível carregar o cardápio.{' '}
          <button type="button" className="underline" onClick={() => void menu.refetch()}>Tentar de novo</button>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-creme-100 rounded-xl border border-ferro-200 p-8 text-center">
          <div className="text-5xl mb-3">🚉</div>
          <p className="text-ferro-600">{search ? 'Nenhum item encontrado.' : 'Nenhum item disponível no momento.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {filteredProducts.map((product) => {
            const quantity = cart[product.id] || 0
            const soldOut = product.stock !== null && product.stock <= 0
            return (
              <div
                key={product.id}
                className={`flex flex-col bg-creme-50 rounded-xl border-2 overflow-hidden shadow-sm ${
                  quantity > 0 ? 'border-latao-500 ring-2 ring-latao-300' : 'border-ferro-800'
                } ${soldOut ? 'opacity-50' : ''}`}
              >
                <div className="h-24 sm:h-36 bg-creme-200 flex items-center justify-center">
                  <OptimizedImage src={product.imageUrl || ''} alt={product.name} className="w-full h-full object-cover" context="lanchonete" />
                </div>
                <div className="picote-horizontal flex flex-col flex-1 p-3">
                  <h3 className="font-display font-medium text-ferro-900 text-sm leading-tight mb-1 line-clamp-2">{product.name}</h3>
                  <p className="font-slab text-lg text-vagao-600 mt-auto">R$ {formatPrice(product.price)}</p>
                  {product.stock !== null && product.stock > 0 && product.stock <= 5 && (
                    <p className="text-xs text-latao-700 mb-1">Últimas {product.stock} unidades</p>
                  )}
                  {soldOut ? (
                    <p className="mt-2 text-center font-display text-sm uppercase tracking-wide text-ferro-500 py-2">Esgotado</p>
                  ) : quantity === 0 ? (
                    <button
                      type="button"
                      onClick={() => changeQuantity(product, 1)}
                      className="mt-2 w-full bg-ferro-800 hover:bg-ferro-700 text-creme-200 font-display font-semibold tracking-wide text-sm py-2.5 rounded-lg active:scale-[0.98] touch-manipulation"
                    >
                      + Adicionar
                    </button>
                  ) : (
                    <div className="mt-2 flex items-center justify-between gap-1">
                      <button
                        type="button"
                        aria-label={`Remover um ${product.name}`}
                        onClick={() => changeQuantity(product, -1)}
                        className="h-10 w-10 p-0 flex items-center justify-center leading-none rounded-lg bg-creme-200 border border-ferro-300 text-xl font-bold text-ferro-800 active:scale-95 touch-manipulation"
                      >
                        −
                      </button>
                      <span className="font-ticket text-xl text-ferro-900" aria-live="polite">{quantity}</span>
                      <button
                        type="button"
                        aria-label={`Adicionar mais um ${product.name}`}
                        onClick={() => changeQuantity(product, 1)}
                        className="h-10 w-10 p-0 flex items-center justify-center leading-none rounded-lg bg-ferro-800 text-xl font-bold text-creme-200 active:scale-95 touch-manipulation"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Barra fixa do carrinho */}
      {totalUnits > 0 && !isReviewOpen && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 bg-gradient-to-t from-creme-100 via-creme-100/95 to-transparent">
          <button
            type="button"
            onClick={() => setIsReviewOpen(true)}
            className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 rounded-xl bg-ferro-900 px-4 py-4 text-creme-100 shadow-bilhete active:scale-[0.99] touch-manipulation"
          >
            <span className="flex items-center gap-2">
              <span className="rounded-full bg-latao-500 px-2.5 py-0.5 font-ticket text-sm text-ferro-900">{totalUnits}</span>
              <span className="font-display font-semibold uppercase tracking-wide">Ver pedido</span>
            </span>
            <span className="font-slab text-xl">R$ {formatPrice(total)}</span>
          </button>
        </div>
      )}

      {/* Revisão e confirmação */}
      {isReviewOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ferro-900/60" role="dialog" aria-modal="true" aria-labelledby="review-title">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-creme-50 border-2 border-ferro-800 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="flex items-center justify-between mb-3">
              <h3 id="review-title" className="text-xl font-display font-semibold uppercase tracking-wide text-ferro-900">🧾 Seu pedido</h3>
              <button
                type="button"
                onClick={() => setIsReviewOpen(false)}
                disabled={createOrder.isPending}
                aria-label="Fechar"
                className="h-10 w-10 p-0 flex items-center justify-center leading-none rounded-lg text-2xl text-ferro-600 hover:bg-creme-200"
              >
                ×
              </button>
            </div>

            {cartLines.length === 0 ? (
              <p className="py-6 text-center text-ferro-600">Seu carrinho está vazio.</p>
            ) : (
              <ul className="divide-y divide-ferro-100">
                {cartLines.map(({ product, quantity }) => (
                  <li key={product.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-ferro-900 truncate">{product.name}</p>
                      <p className="text-sm text-ferro-600 font-slab">R$ {formatPrice(product.price * quantity)}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        aria-label={`Remover um ${product.name}`}
                        onClick={() => changeQuantity(product, -1)}
                        disabled={createOrder.isPending}
                        className="h-9 w-9 p-0 flex items-center justify-center leading-none rounded-lg bg-creme-200 border border-ferro-300 text-lg font-bold text-ferro-800 touch-manipulation"
                      >
                        −
                      </button>
                      <span className="w-6 text-center font-ticket text-lg">{quantity}</span>
                      <button
                        type="button"
                        aria-label={`Adicionar mais um ${product.name}`}
                        onClick={() => changeQuantity(product, 1)}
                        disabled={createOrder.isPending}
                        className="h-9 w-9 p-0 flex items-center justify-center leading-none rounded-lg bg-ferro-800 text-lg font-bold text-creme-200 touch-manipulation"
                      >
                        +
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 space-y-1 rounded-lg bg-creme-200 border border-ferro-200 p-3">
              <div className="flex justify-between text-ferro-700">
                <span>Seu saldo</span>
                <span className="font-slab">R$ {formatPrice(currentBalance)}</span>
              </div>
              <div className="flex justify-between font-semibold text-ferro-900">
                <span>Total do pedido</span>
                <span className="font-slab text-vagao-600">R$ {formatPrice(total)}</span>
              </div>
              <div className={`flex justify-between ${hasEnoughBalance ? 'text-ferro-700' : 'text-vagao-700 font-semibold'}`}>
                <span>Saldo após o pedido</span>
                <span className="font-slab">R$ {formatPrice(currentBalance - total)}</span>
              </div>
            </div>

            {!hasEnoughBalance && cartLines.length > 0 && (
              <p role="alert" className="mt-3 text-sm text-vagao-700">
                Saldo insuficiente. Remova itens ou recarregue seu saldo em Minha Conta.
              </p>
            )}

            <button
              type="button"
              onClick={handleConfirm}
              disabled={cartLines.length === 0 || !hasEnoughBalance || createOrder.isPending}
              className="mt-4 w-full rounded-lg bg-vagao-600 hover:bg-vagao-700 py-4 font-display text-lg font-semibold uppercase tracking-wide text-creme-50 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99] touch-manipulation"
            >
              {createOrder.isPending ? 'Enviando...' : `Confirmar e pagar R$ ${formatPrice(total)}`}
            </button>
            <p className="mt-2 text-center text-xs text-ferro-500">
              O valor é debitado do seu saldo na hora. Dá para cancelar enquanto o pedido estiver aguardando.
            </p>
          </div>
        </div>
      )}

      {createOrder.isPending && <TrainLoader fullScreen />}
    </div>
  )
}

export default SelfOrderPage
