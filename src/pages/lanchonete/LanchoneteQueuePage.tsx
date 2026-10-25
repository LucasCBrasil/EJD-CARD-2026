import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ConfirmationModal } from '../../components/shared'
import { useToastContext } from '../../contexts/ToastContext'
import { useLanchoneteQueue, useSelfOrderEnabled, useUpdateLanchoneteOrder } from '../../hooks/useLanchoneteOrders'
import type { LanchoneteOrder } from '../../lib/api-client'
import { getOrderStatusClass, getOrderStatusLabel } from '../../lib/orderStatus'

type QueueTab = 'pending' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
type OrderAction = 'preparing' | 'ready' | 'delivered' | 'cancel'

const TABS: { id: QueueTab; label: string }[] = [
  { id: 'pending', label: 'Novos' },
  { id: 'preparing', label: 'Preparando' },
  { id: 'ready', label: 'Prontos' },
  { id: 'delivered', label: 'Entregues' },
  { id: 'cancelled', label: 'Cancelados' },
]

const NEXT_ACTION: Partial<Record<LanchoneteOrder['status'], { action: OrderAction; label: string }>> = {
  pending: { action: 'preparing', label: '👨‍🍳 Começar preparo' },
  preparing: { action: 'ready', label: '🔔 Marcar pronto' },
  ready: { action: 'delivered', label: '✓ Entregar' },
}

const formatPrice = (value: number) =>
  value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const minutesSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))

const LanchoneteQueuePage: React.FC = () => {
  const { showSuccess, showError, showInfo } = useToastContext()
  const [tab, setTab] = useState<QueueTab>('pending')
  const [confirm, setConfirm] = useState<{ order: LanchoneteOrder; action: OrderAction } | null>(null)

  const openQueue = useLanchoneteQueue('open')
  const closedQueue = useLanchoneteQueue(
    tab === 'delivered' || tab === 'cancelled' ? tab : 'delivered',
    tab === 'delivered' || tab === 'cancelled',
  )
  const flag = useSelfOrderEnabled()
  const updateOrder = useUpdateLanchoneteOrder()

  const openOrders = openQueue.data || []
  const counts = useMemo(() => ({
    pending: openOrders.filter((o) => o.status === 'pending').length,
    preparing: openOrders.filter((o) => o.status === 'preparing').length,
    ready: openOrders.filter((o) => o.status === 'ready').length,
  }), [openOrders])

  const isClosedTab = tab === 'delivered' || tab === 'cancelled'
  const visibleOrders = isClosedTab ? (closedQueue.data || []) : openOrders.filter((o) => o.status === tab)
  const activeQuery = isClosedTab ? closedQueue : openQueue

  // Destaca pedidos novos que chegam pelo polling
  const knownIds = useRef<Set<string> | null>(null)
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    if (!openQueue.data) return
    const pendingIds = openQueue.data.filter((o) => o.status === 'pending').map((o) => o.id)
    if (knownIds.current) {
      const arrived = pendingIds.filter((id) => !knownIds.current!.has(id))
      if (arrived.length > 0) {
        setFreshIds((prev) => new Set([...prev, ...arrived]))
        showInfo('🔔 Novo pedido', arrived.length === 1 ? 'Chegou 1 pedido novo' : `Chegaram ${arrived.length} pedidos novos`)
        try { navigator.vibrate?.(200) } catch { /* vibração não suportada */ }
      }
    }
    knownIds.current = new Set(openQueue.data.map((o) => o.id))
  }, [openQueue.data, showInfo])

  const runAction = (order: LanchoneteOrder, action: OrderAction) => {
    updateOrder.mutate({ saleId: order.id, action }, {
      onSuccess: () => {
        setFreshIds((prev) => {
          const next = new Set(prev)
          next.delete(order.id)
          return next
        })
        if (action === 'cancel') showSuccess('Pedido cancelado', `Pedido Nº ${order.saleNumber} estornado (R$ ${formatPrice(order.total)}).`)
        else if (action === 'delivered') showSuccess('Entregue', `Pedido Nº ${order.saleNumber} entregue.`)
        setConfirm(null)
      },
      onError: (error) => {
        showError('Não foi possível atualizar', error instanceof Error ? error.message : 'Tente novamente')
        setConfirm(null)
      },
    })
  }

  // Avançar para preparo/pronto é reversível na prática; entregar e cancelar pedem confirmação
  const handleAction = (order: LanchoneteOrder, action: OrderAction) => {
    if (action === 'delivered' || action === 'cancel') setConfirm({ order, action })
    else runAction(order, action)
  }

  return (
    <div className="painel p-4 md:p-8 space-y-5">
      <div>
        <span className="carimbo text-vagao-600 text-xs">☕ Vagão-restaurante</span>
        <h2 className="mt-3 text-2xl md:text-3xl font-display font-semibold uppercase tracking-wide text-ferro-900">Fila de pedidos</h2>
        <p className="text-base text-ferro-700">Pedidos feitos pelo app. Atualiza a cada 5 segundos.</p>
        {flag.data === false && (
          <p className="mt-2 rounded-lg bg-latao-100 border border-latao-300 p-2 text-sm text-latao-900">
            Os pedidos pelo app estão fechados (flag <code>lanchonete_self_order</code> desligada). Os pedidos em aberto continuam aqui.
          </p>
        )}
        <div className="trilho w-full mt-4" />
      </div>

      <div role="tablist" className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {TABS.map((item) => {
          const count = item.id in counts ? counts[item.id as keyof typeof counts] : undefined
          const active = tab === item.id
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setTab(item.id)}
              className={`shrink-0 rounded-lg px-3 py-2 font-display text-sm uppercase tracking-wide touch-manipulation ${
                active ? 'bg-ferro-800 text-creme-200' : 'bg-creme-200 text-ferro-800 border border-ferro-200'
              }`}
            >
              {item.label}
              {count !== undefined && (
                <span className={`ml-2 rounded-full px-2 py-0.5 font-ticket text-xs ${active ? 'bg-latao-500 text-ferro-900' : 'bg-ferro-200'}`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {activeQuery.isLoading ? (
        <p className="py-8 text-center text-ferro-600">Carregando pedidos...</p>
      ) : activeQuery.isError ? (
        <p role="alert" className="py-8 text-center text-vagao-700">
          Erro ao carregar a fila.{' '}
          <button type="button" className="underline" onClick={() => void activeQuery.refetch()}>Tentar de novo</button>
        </p>
      ) : visibleOrders.length === 0 ? (
        <div className="bg-creme-100 rounded-xl border border-ferro-200 p-8 text-center">
          <div className="text-5xl mb-3">🚉</div>
          <p className="text-ferro-600">Nenhum pedido aqui.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {visibleOrders.map((order) => {
            const next = NEXT_ACTION[order.status]
            const canCancel = ['pending', 'preparing', 'ready'].includes(order.status)
            const waiting = minutesSince(order.createdAt)
            return (
              <article
                key={order.id}
                className={`bilhete !p-4 space-y-3 ${freshIds.has(order.id) ? 'ring-4 ring-latao-400 animate-pulse' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-ticket text-3xl font-bold text-ferro-900 leading-none">Nº {order.saleNumber}</p>
                    <p className="mt-1 font-semibold text-ferro-900 truncate">{order.customerName}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={`carimbo text-[11px] ${getOrderStatusClass(order.status)}`}>{getOrderStatusLabel(order.status)}</span>
                    {!isClosedTab && (
                      <p className={`text-xs mt-1 ${waiting >= 15 ? 'text-vagao-700 font-semibold' : 'text-ferro-500'}`}>
                        há {waiting} min
                      </p>
                    )}
                  </div>
                </div>

                <ul className="space-y-0.5 text-ferro-900">
                  {order.items.map((item) => (
                    <li key={item.productId} className="flex gap-2">
                      <span className="font-ticket font-bold w-8">{item.quantity}×</span>
                      <span>{item.productName}</span>
                    </li>
                  ))}
                </ul>

                <div className="picote-horizontal pt-2 flex justify-between text-sm text-ferro-600">
                  <span>Pago com saldo</span>
                  <span className="font-slab text-ferro-900">R$ {formatPrice(order.total)}</span>
                </div>

                {!isClosedTab && (
                  <div className="flex gap-2">
                    {next && (
                      <button
                        type="button"
                        disabled={updateOrder.isPending}
                        onClick={() => handleAction(order, next.action)}
                        className="flex-1 rounded-lg bg-ferro-800 hover:bg-ferro-700 py-3 font-display font-semibold tracking-wide text-creme-200 disabled:opacity-50 active:scale-[0.98] touch-manipulation"
                      >
                        {next.label}
                      </button>
                    )}
                    {canCancel && (
                      <button
                        type="button"
                        disabled={updateOrder.isPending}
                        onClick={() => handleAction(order, 'cancel')}
                        aria-label={`Cancelar pedido ${order.saleNumber}`}
                        className="rounded-lg border border-vagao-300 px-3 py-3 font-display text-sm text-vagao-700 hover:bg-vagao-50 disabled:opacity-50 touch-manipulation"
                      >
                        Estornar
                      </button>
                    )}
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      <ConfirmationModal
        isOpen={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && runAction(confirm.order, confirm.action)}
        title={confirm?.action === 'cancel' ? `Estornar pedido Nº ${confirm.order.saleNumber}?` : `Entregar pedido Nº ${confirm?.order.saleNumber}?`}
        icon={confirm?.action === 'cancel' ? '↩️' : '🎫'}
        variant="delivery-confirmation"
        message={confirm?.action === 'cancel'
          ? `O pedido de ${confirm.order.customerName} será cancelado e R$ ${formatPrice(confirm.order.total)} voltarão para o saldo do cliente.`
          : confirm ? `Confira o nome: ${confirm.order.customerName}.` : ''}
        isLoading={updateOrder.isPending}
      />
    </div>
  )
}

export default LanchoneteQueuePage
