import React, { useState, useEffect } from 'react'
import { usePermissions } from '../../hooks/usePermissions'
import { api } from '../../lib/api-client'
import { SapatinhoVelozOrder } from '../../types'
import { Button } from '../../components/shared'
import { useToastContext } from '../../contexts/ToastContext'

const SapatinhoVelozOrdersPage: React.FC = () => {
  const { canViewOpenOrders, canMarkAsDelivered } = usePermissions()
  const { showSuccess, showError } = useToastContext()
  const [orders, setOrders] = useState<SapatinhoVelozOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (canViewOpenOrders) {
      loadOrders()
    }
  }, [canViewOpenOrders])

  const loadOrders = async () => {
    try {
      setIsLoading(true)
      // Carregar pedidos abertos via Edge Function
      const response = await api.listOrders('sapatinho')
      
      if (!response.success) {
        throw new Error((response as any).error || 'Erro ao carregar pedidos')
      }

      // Filtrar apenas pedidos pendentes ou completos (não entregues)
      const openOrders = (response.data || [])
        .filter((order: any) => ['pending', 'completed'].includes(order.status))
        .map((order: any) => {
          const mappedItems = (order.sapatinho_veloz_order_items || []).map((item: any) => ({
            id: item.id,
            orderId: item.order_id,
            productId: item.product_id,
            productName: item.product_name,
            quantity: item.quantity,
            price: parseFloat(item.price) || 0,
            createdAt: item.created_at
          }))
          
          return {
            id: order.id,
            saleId: order.sale_id,
            senderUserId: order.sender_user_id,
            senderName: order.sender_name || null,
            senderTeam: order.sender_team || null,
            recipientName: order.recipient_name,
            recipientAddress: order.recipient_address,
            message: order.message || null,
            items: mappedItems,
            total: parseFloat(order.total) || 0,
            status: order.status,
            createdAt: order.created_at,
            deliveredAt: order.delivered_at || null,
            isAnonymous: !order.sender_name && order.sender_user_id !== null
          } as SapatinhoVelozOrder
        })
      
      setOrders(openOrders)
    } catch (error: any) {
      showError('Erro', error?.message || 'Erro ao carregar pedidos')
      setOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  const handleMarkAsDelivered = async (orderId: string) => {
    if (!canMarkAsDelivered) {
      showError('Erro', 'Você não tem permissão para marcar pedidos como entregues')
      return
    }

    try {
      const response = await api.markOrderAsDelivered(orderId)
      if (!response.success) {
        throw new Error((response as any).error || 'Erro ao marcar pedido como entregue')
      }
      showSuccess('Sucesso', 'Pedido marcado como entregue')
      loadOrders()
    } catch (error: any) {
      showError('Erro', error?.message || 'Erro ao marcar pedido como entregue')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="carimbo text-sm text-latao-700 bg-latao-50">⏳ Pendente</span>
      case 'completed':
        return <span className="carimbo text-sm text-anil-700 bg-anil-100/60">📦 Aguardando entrega</span>
      case 'delivered':
        return <span className="carimbo text-sm text-green-700 bg-green-50">🚂 Entregue</span>
      default:
        return <span className="carimbo text-sm text-ferro-600">{status}</span>
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!canViewOpenOrders) {
    return (
      <div className="painel p-8 text-center">
        <div className="text-6xl mb-4">🚧</div>
        <h2 className="text-2xl font-display font-semibold uppercase tracking-wide text-vagao-600 mb-4">Acesso Negado</h2>
        <p className="text-ferro-700">Você não tem permissão para visualizar pedidos do Sapatinho Veloz.</p>
      </div>
    )
  }

  return (
    <div className="painel p-4 sm:p-6 md:p-10 text-ferro-900">
      <div className="mb-6 md:mb-8">
        <p className="text-xs font-display uppercase tracking-[0.2em] text-vagao-600 mb-1">Correio do Encontrão</p>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold uppercase tracking-wide text-ferro-900 mb-2">💌 Pedidos Sapatinho Veloz</h2>
        <p className="text-base sm:text-lg text-ferro-700 mb-4">Visualize e gerencie as encomendas do Sapatinho Veloz</p>
        <div className="trilho w-full" />
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-ferro-500">Carregando pedidos...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-10 bg-creme-100 border border-ferro-200 rounded-xl">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-ferro-600 text-lg">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map(order => (
            <div key={order.id} className="bilhete p-4 sm:p-6">
              <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                <div className="min-w-0">
                  <p className="text-xs font-display uppercase tracking-[0.2em] text-ferro-500">Encomenda</p>
                  <h3 className="text-xl sm:text-2xl font-ticket font-bold text-ferro-900 mb-2">#{order.id.slice(-5)}</h3>
                  <div className="mb-2">{getStatusBadge(order.status)}</div>
                  <p className="text-sm text-ferro-600">
                    Criado em: {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl sm:text-3xl font-slab text-vagao-600">
                    R$ {order.total.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="picote-horizontal pt-4 grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className={`rounded-xl p-4 border ${
                  order.isAnonymous 
                    ? 'bg-anil-100/50 border-anil-200' 
                    : 'bg-creme-100 border-ferro-200'
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h4 className="text-base font-display uppercase tracking-wide text-ferro-800">👤 Remetente</h4>
                    {order.isAnonymous && (
                      <span className="carimbo text-xs text-anil-700">
                        🔒 Anônimo
                      </span>
                    )}
                  </div>
                  {order.senderName ? (
                    <>
                      <p className={`text-base font-medium ${
                        order.isAnonymous ? 'text-anil-800 italic' : 'text-ferro-900'
                      }`}>
                        {order.senderName}
                      </p>
                      <p className={`text-base mt-1 ${
                        order.isAnonymous ? 'text-anil-700 italic' : 'text-ferro-700'
                      }`}>
                        {order.senderTeam ? (
                          <>
                            Equipe: {order.senderTeam}
                            {order.isAnonymous && ' (não será exibida)'}
                          </>
                        ) : (
                          <span className="text-ferro-500 italic">Equipe não informada</span>
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-base text-anil-800 font-medium italic">Mensagem Anônima</p>
                      <p className="text-base text-anil-700 mt-1 italic">
                        {order.senderTeam ? (
                          <>Equipe: {order.senderTeam} (não será exibida)</>
                        ) : (
                          <span className="text-ferro-500">Equipe não informada</span>
                        )}
                      </p>
                    </>
                  )}
                </div>
                <div className="bg-creme-100 rounded-xl p-4 border border-ferro-200">
                  <h4 className="text-base font-display uppercase tracking-wide text-ferro-800 mb-2">📍 Destino</h4>
                  <p className="text-base text-ferro-900 font-medium">{order.recipientName}</p>
                  <p className="text-base text-ferro-700 mt-1">Equipe: {order.recipientAddress}</p>
                  <p className="text-sm text-ferro-600 mt-2 font-medium">
                    Entrega na Sala de Apoio da {order.recipientAddress}
                  </p>
                </div>
              </div>

              {order.message &&  (
                <div className="bg-creme-200 border border-ferro-200 border-l-4 border-l-vagao-600 p-4 mb-4 rounded-xl">
                  <h4 className="text-base font-display uppercase tracking-wide text-ferro-800 mb-2">💌 Mensagem</h4>
                  <p className="text-base text-ferro-900 italic leading-relaxed whitespace-pre-line break-words">{order.message}</p>
                </div>
              )}

              <div className="mb-4">
                <h4 className="text-base font-display uppercase tracking-wide text-ferro-800 mb-2">🧳 Bagagem</h4>
                <div className="bg-creme-100 rounded-xl px-4 py-2 border border-ferro-200">
                  {order.items.map(item => (
                    <div key={item.id} className="flex justify-between items-center gap-3 py-2 border-b border-dashed border-ferro-200 last:border-b-0">
                      <div className="min-w-0">
                        <span className="text-base font-semibold text-ferro-900 break-words">{item.productName}</span>
                        <span className="text-base text-ferro-600 ml-2 font-ticket">x{item.quantity}</span>
                      </div>
                      <span className="text-base font-slab text-ferro-900 whitespace-nowrap">
                        R$ {(item.price * item.quantity).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {order.status !== 'delivered' && canMarkAsDelivered && (
                <div className="flex justify-end">
                  <Button
                    onClick={() => handleMarkAsDelivered(order.id)}
                    className="w-full sm:w-auto uppercase"
                  >
                    ✅ Marcar como Entregue
                  </Button>
                </div>
              )}

              {order.status === 'delivered' && order.deliveredAt && (
                <div className="text-sm text-ferro-700 text-right font-medium">
                  Entregue em: {formatDate(order.deliveredAt)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default SapatinhoVelozOrdersPage

