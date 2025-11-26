import React, { useState, useEffect } from 'react'
import { usePermissions } from '../../hooks/usePermissions'
import { sapatinhoVelozApi } from '../../api/sapatinho-veloz.api'
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
      const openOrders = await sapatinhoVelozApi.getOpenOrders()
      setOrders(openOrders)
    } catch (error: any) {
      showError('Erro', error?.message || 'Erro ao carregar pedidos')
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
      await sapatinhoVelozApi.markAsDelivered(orderId)
      showSuccess('Sucesso', 'Pedido marcado como entregue')
      loadOrders()
    } catch (error: any) {
      showError('Erro', error?.message || 'Erro ao marcar pedido como entregue')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-4 py-2 bg-yellow-200 text-yellow-900 rounded-full text-base font-bold border-2 border-yellow-400">⏳ Pendente</span>
      case 'completed':
        return <span className="px-4 py-2 bg-blue-200 text-blue-900 rounded-full text-base font-bold border-2 border-blue-400">📦 Aguardando entrega</span>
      case 'delivered':
        return <span className="px-4 py-2 bg-green-200 text-green-900 rounded-full text-base font-bold border-2 border-green-400">🚚 Entregue</span>
      default:
        return <span className="px-4 py-2 bg-gray-200 text-gray-900 rounded-full text-base font-bold border-2 border-gray-400">{status}</span>
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
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-red-200 p-8 text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h2 className="text-2xl font-bold text-red-700 mb-4">Acesso Negado</h2>
        <p className="text-red-600">Você não tem permissão para visualizar pedidos do Sapatinho velOz.</p>
      </div>
    )
  }

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border-2 border-yellow-300 p-10">
      <div className="mb-8">
        <h2 className="text-4xl font-bold text-black mb-4">📦 Pedidos Sapatinho velOz</h2>
        <p className="text-lg text-gray-800">Visualize e gerencie os pedidos do Sapatinho velOz</p>
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Carregando pedidos...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-gray-500 text-lg">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="space-y-6">
          {orders.map(order => (
            <div key={order.id} className="border-2 border-gray-300 rounded-lg p-6 bg-white shadow-lg">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <div className="flex items-center space-x-4 mb-3">
                    <h3 className="text-2xl font-bold text-black">Pedido #{order.id.slice(-5)}</h3>
                    {getStatusBadge(order.status)}
                  </div>
                  <p className="text-base text-gray-700">
                    Criado em: {formatDate(order.createdAt)}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-emerald-700">
                    R$ {order.total.toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                <div className={`rounded-lg p-5 border-2 ${
                  order.isAnonymous 
                    ? 'bg-purple-50 border-purple-300' 
                    : 'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-lg font-bold text-black">👤 Remetente</h4>
                    {order.isAnonymous && (
                      <span className="px-3 py-1 bg-purple-200 text-purple-900 rounded-full text-sm font-bold border-2 border-purple-400">
                        🔒 Anônimo
                      </span>
                    )}
                  </div>
                  {order.senderName ? (
                    <>
                      <p className={`text-base font-medium ${
                        order.isAnonymous ? 'text-purple-900 italic' : 'text-gray-900'
                      }`}>
                        {order.senderName}
                      </p>
                      <p className={`text-base mt-1 ${
                        order.isAnonymous ? 'text-purple-700 italic' : 'text-gray-700'
                      }`}>
                        {order.senderTeam ? (
                          <>
                            Equipe: {order.senderTeam}
                            {order.isAnonymous && ' (não será exibida)'}
                          </>
                        ) : (
                          <span className="text-gray-500 italic">Equipe não informada</span>
                        )}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-base text-purple-900 font-medium italic">Mensagem Anônima</p>
                      <p className="text-base text-purple-700 mt-1 italic">
                        {order.senderTeam ? (
                          <>Equipe: {order.senderTeam} (não será exibida)</>
                        ) : (
                          <span className="text-gray-500">Equipe não informada</span>
                        )}
                      </p>
                    </>
                  )}
                </div>
                <div className="bg-gray-50 rounded-lg p-5 border-2 border-gray-200">
                  <h4 className="text-lg font-bold text-black mb-3">📍 Destinatário</h4>
                  <p className="text-base text-gray-900 font-medium">{order.recipientName}</p>
                  <p className="text-base text-gray-700 mt-1">Equipe: {order.recipientAddress}</p>
                  <p className="text-base text-gray-600 mt-2 font-medium">
                    Entrega na Sala de Apoio da {order.recipientAddress}
                  </p>
                </div>
              </div>

              {order.message &&  (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 p-5 mb-5 rounded-r-lg">
                  <h4 className="text-lg font-bold text-black mb-2">💌 Mensagem:</h4>
                  <p className="text-base text-gray-900">{order.message}</p>
                </div>
              )}

              <div className="mb-5">
                <h4 className="text-lg font-bold text-black mb-3">🛍️ Produtos:</h4>
                <div className="bg-gray-50 rounded-lg p-5 border-2 border-gray-200">
                  <div className="space-y-3">
                    {order.items.map(item => (
                      <div key={item.id} className="flex justify-between items-center py-2 border-b border-gray-300 last:border-b-0">
                        <div>
                          <span className="text-base font-semibold text-gray-900">{item.productName}</span>
                          <span className="text-base text-gray-700 ml-3">x{item.quantity}</span>
                        </div>
                        <span className="text-lg font-bold text-gray-900">
                          R$ {(item.price * item.quantity).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {order.status !== 'delivered' && canMarkAsDelivered && (
                <div className="flex justify-end">
                  <Button
                    onClick={() => handleMarkAsDelivered(order.id)}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-8 py-3 text-lg font-bold rounded-lg shadow-lg"
                  >
                    ✅ Marcar como Entregue
                  </Button>
                </div>
              )}

              {order.status === 'delivered' && order.deliveredAt && (
                <div className="text-base text-gray-700 text-right font-medium">
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

