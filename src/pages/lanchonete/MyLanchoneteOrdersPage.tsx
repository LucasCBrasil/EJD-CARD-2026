import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ConfirmationModal } from '../../components/shared'
import { useToastContext } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
import { useCancelMyLanchoneteOrder, useMyLanchoneteOrders, useSelfOrderEnabled } from '../../hooks/useLanchoneteOrders'
import type { LanchoneteOrder } from '../../lib/api-client'
import { getOrderStatusClass, getOrderStatusLabel } from '../../lib/orderStatus'

const STEPS: { status: LanchoneteOrder['status']; label: string }[] = [
  { status: 'pending', label: 'Recebido' },
  { status: 'preparing', label: 'Preparando' },
  { status: 'ready', label: 'Pronto' },
  { status: 'delivered', label: 'Entregue' },
]

const formatPrice = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

const OrderProgress: React.FC<{ status: LanchoneteOrder['status'] }> = ({ status }) => {
  const currentIndex = STEPS.findIndex((step) => step.status === status)
  return (
    <ol className="grid grid-cols-4 gap-1" aria-label="Andamento do pedido">
      {STEPS.map((step, index) => {
        const done = index <= currentIndex
        return (
          <li key={step.status} className="flex flex-col items-center gap-1">
            <span className={`h-2 w-full rounded-full ${done ? 'bg-latao-500' : 'bg-ferro-200'}`} />
            <span className={`text-[11px] font-display uppercase tracking-wide ${done ? 'text-ferro-900' : 'text-ferro-400'}`}>
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const MyLanchoneteOrdersPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showSuccess, showError, showInfo } = useToastContext()
  const orders = useMyLanchoneteOrders()
  const flag = useSelfOrderEnabled()
  const cancelOrder = useCancelMyLanchoneteOrder()
  const [orderToCancel, setOrderToCancel] = useState<LanchoneteOrder | null>(null)

  // Avisa quando um pedido fica pronto enquanto a tela está aberta
  const previousStatus = useRef<Map<string, string>>(new Map())
  useEffect(() => {
    if (!orders.data) return
    orders.data.forEach((order) => {
      const before = previousStatus.current.get(order.id)
      if (before && before !== 'ready' && order.status === 'ready') {
        showInfo('🔔 Pedido pronto!', `Seu pedido Nº ${order.saleNumber} está pronto. Retire no balcão.`, 8000)
        try { navigator.vibrate?.([200, 100, 200]) } catch { /* vibração não suportada */ }
      }
      previousStatus.current.set(order.id, order.status)
    })
  }, [orders.data, showInfo])

  const handleConfirmCancel = () => {
    if (!orderToCancel) return
    cancelOrder.mutate(orderToCancel.id, {
      onSuccess: (data) => {
        showSuccess('Pedido cancelado', `R$ ${formatPrice(data.refundedAmount)} voltaram para o seu saldo.`)
        setOrderToCancel(null)
      },
      onError: (error) => {
        showError('Não foi possível cancelar', error instanceof Error ? error.message : 'Tente novamente')
        setOrderToCancel(null)
        void orders.refetch()
      },
    })
  }

  const openOrders = (orders.data || []).filter((o) => ['pending', 'preparing', 'ready'].includes(o.status))
  const pastOrders = (orders.data || []).filter((o) => !['pending', 'preparing', 'ready'].includes(o.status))

  const renderOrder = (order: LanchoneteOrder, highlight: boolean) => (
    <article key={order.id} className={`bilhete !p-4 space-y-3 ${order.status === 'ready' ? 'ring-4 ring-green-500/60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-[11px] tracking-[0.3em] uppercase text-ferro-500">Pedido</p>
          <p className={`font-ticket font-bold text-ferro-900 leading-none ${highlight ? 'text-4xl' : 'text-2xl'}`}>Nº {order.saleNumber}</p>
          <p className="text-xs text-ferro-500 mt-1">{formatTime(order.createdAt)}</p>
        </div>
        <div className="text-right">
          <span className={`carimbo text-[11px] ${getOrderStatusClass(order.status)}`}>{getOrderStatusLabel(order.status)}</span>
          <p className="font-slab text-lg text-vagao-600 mt-1">R$ {formatPrice(order.total)}</p>
        </div>
      </div>

      {highlight && <OrderProgress status={order.status} />}

      {order.status === 'ready' && (
        <p className="rounded-lg bg-green-50 border border-green-200 p-2 text-sm text-green-800">
          Pronto! Vá ao balcão da Lanchonete e mostre o número do pedido e seu nome: <strong>{user?.name || user?.email}</strong>.
        </p>
      )}

      <ul className="text-sm text-ferro-800">
        {order.items.map((item) => (
          <li key={item.productId}>{item.quantity}× {item.productName}</li>
        ))}
      </ul>

      {order.status === 'pending' && (
        <button
          type="button"
          onClick={() => setOrderToCancel(order)}
          className="w-full rounded-lg border border-vagao-300 py-2.5 font-display text-sm uppercase tracking-wide text-vagao-700 hover:bg-vagao-50 touch-manipulation"
        >
          Cancelar pedido
        </button>
      )}
    </article>
  )

  return (
    <div className="painel p-4 md:p-8 space-y-5">
      <div>
        <span className="carimbo text-vagao-600 text-xs">☕ Vagão-restaurante</span>
        <h2 className="mt-3 text-2xl md:text-3xl font-display font-semibold uppercase tracking-wide text-ferro-900">Meus pedidos</h2>
        <p className="text-base text-ferro-700">Acompanhe seus pedidos da Lanchonete. A tela se atualiza sozinha.</p>
        <div className="trilho w-full mt-4" />
      </div>

      {flag.data && (
        <button
          type="button"
          onClick={() => navigate({ to: '/lanchonete/pedir' as any })}
          className="w-full rounded-lg bg-ferro-800 hover:bg-ferro-700 py-3 font-display font-semibold uppercase tracking-wide text-creme-200 touch-manipulation"
        >
          🍔 Fazer novo pedido
        </button>
      )}

      {orders.isLoading ? (
        <p className="py-8 text-center text-ferro-600">Carregando seus pedidos...</p>
      ) : orders.isError ? (
        <p role="alert" className="py-8 text-center text-vagao-700">
          Não foi possível carregar seus pedidos.{' '}
          <button type="button" className="underline" onClick={() => void orders.refetch()}>Tentar de novo</button>
        </p>
      ) : (orders.data || []).length === 0 ? (
        <div className="bg-creme-100 rounded-xl border border-ferro-200 p-8 text-center">
          <div className="text-5xl mb-3">🚉</div>
          <p className="text-ferro-600">Você ainda não fez pedidos pelo app.</p>
        </div>
      ) : (
        <>
          {openOrders.length > 0 && (
            <section className="space-y-3" aria-label="Pedidos em andamento">
              <h3 className="font-display text-sm uppercase tracking-widest text-ferro-600">Em andamento</h3>
              {openOrders.map((order) => renderOrder(order, true))}
            </section>
          )}
          {pastOrders.length > 0 && (
            <section className="space-y-3" aria-label="Pedidos anteriores">
              <h3 className="font-display text-sm uppercase tracking-widest text-ferro-600">Anteriores</h3>
              {pastOrders.map((order) => renderOrder(order, false))}
            </section>
          )}
        </>
      )}

      <ConfirmationModal
        isOpen={!!orderToCancel}
        onClose={() => setOrderToCancel(null)}
        onConfirm={handleConfirmCancel}
        title="Desistir do pedido?"
        icon="↩️"
        variant="delivery-confirmation"
        message={orderToCancel
          ? `O pedido Nº ${orderToCancel.saleNumber} será cancelado e R$ ${formatPrice(orderToCancel.total)} voltarão para o seu saldo.`
          : ''}
        isLoading={cancelOrder.isPending}
      />
    </div>
  )
}

export default MyLanchoneteOrdersPage
