import { useState, useEffect } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { Header, TrainLoader } from '../../components/shared'
import { ConfirmationModal } from '../../components/shared'
import { Order, useSupabaseData } from '../../contexts/SupabaseDataContext'

const LojinhaOrdersPage = () => {
  const { markAsDelivered, getOpenOrders } = useSupabaseData()
  const { showSuccess, showError } = useToastContext()
  
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [showConfirmation, setShowConfirmation] = useState(false)
const [isConfirming, setIsConfirming] = useState(false)
  const formatDate = (iso: string) => new Date(iso).toLocaleString('pt-BR')

  // Carregar pedidos pendentes
  const loadOrders = async () => {
    try {
      setLoading(true)
      const fetchedOrders = await getOpenOrders()
      setOrders(fetchedOrders)
      console.log(fetchedOrders)
    } catch (err) {
      console.error('Error loading orders:', err)
      showError('Erro', 'Falha ao carregar pedidos')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  // Confirmar entrega
  const handleConfirmDelivery = async () => {
  if (!selectedOrder) return

  try {
    setIsConfirming(true)
    await markAsDelivered(selectedOrder.id)
    
    // Aguardar um momento antes de recarregar (dar tempo para atualizar o banco de dados)
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Recarregar pedidos e atualizar o estado
    const updatedOrders = await getOpenOrders()
    
    setOrders(updatedOrders)
    showSuccess('Sucesso', 'Entrega confirmada com sucesso!')
    setShowConfirmation(false)
    setSelectedOrder(null)
  } catch (err) {
    console.error('Erro ao confirmar entrega:', err)
    showError('Erro', 'Falha ao confirmar entrega')
  } finally {
    setIsConfirming(false)
  }
}

  useEffect(() => {
  }, [showConfirmation, selectedOrder])

  const handleOpenConfirmation = (order: Order) => {
    setSelectedOrder(order)
    setShowConfirmation(true)
  }

  if (loading) {
    return <TrainLoader title="Carregando pedidos..." fullScreen={false} />
  }

  return (
    <div className="space-y-6">
      <div className="painel p-4 md:p-8">
        <Header title="Pedidos Pendentes"
          subtitle={"Confirme as entregas dos pedidos realizados na lojinha"}
          showLogo={false}/>

        {orders.length === 0 ? (
          <div className="bg-creme-100 border border-ferro-200 rounded-xl text-center py-10 px-4">
            <div className="text-5xl mb-3">🚉</div>
            <p className="text-ferro-600">Nenhum pedido pendente</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 [grid-auto-rows:1fr]">
            {orders.map(order => (
              <div
                key={order.id}
                className="bilhete flex flex-col justify-between h-full"
              >
                <div className="p-4">
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div className="min-w-0">
                      <span className="font-display text-[11px] tracking-[0.3em] text-ferro-500 uppercase">Pedido</span>
                      <h3 className="font-ticket text-lg font-bold text-ferro-900 leading-tight">Nº {order.saleNumber}</h3>
                      <p className="text-sm text-ferro-700 truncate">{order.customerName}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-slab text-xl text-vagao-600">
                        R$ {order.total.toFixed(2)}
                      </span>
                      <div>
                        <span className="carimbo text-latao-700 text-[11px] mt-1">Pendente</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-creme-100 border border-ferro-200 rounded-xl p-3">
                    <h4 className="font-display text-xs tracking-[0.2em] uppercase text-ferro-500 mb-1">Itens</h4>
                    <ul className="text-sm text-ferro-900 space-y-1">
                      {order.items?.map((item, index) => (
                        <li key={index} className="flex justify-between gap-2">
                          <span>{item.productName}</span>
                          <span className="font-ticket text-ferro-500 shrink-0">{item.quantity}x</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="picote-horizontal flex justify-between items-center gap-2 px-4 py-3 mt-auto">
                  <span className="text-xs text-ferro-500 font-ticket">
                    {formatDate(order.createdAt)}
                  </span>
                  <button
                    onClick={() => handleOpenConfirmation(order)}
                    className="bg-ferro-800 hover:bg-ferro-700 text-creme-200 font-display font-semibold tracking-wide text-sm px-3 py-2 rounded-lg shrink-0 transition-colors"
                  >
                    ✓ Confirmar entrega
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmationModal
        isOpen={showConfirmation}
        onClose={() => {
          setShowConfirmation(false)
          setSelectedOrder(null)
        }}
        onConfirm={handleConfirmDelivery}
        title="Confirmar Entrega"
        variant="delivery-confirmation"
        message={selectedOrder ? `Deseja confirmar a entrega do pedido #${selectedOrder.saleNumber ? selectedOrder.saleNumber : selectedOrder.id} de ${selectedOrder.customerName}?` : ''}
        amount={selectedOrder ? selectedOrder.total.toString() : '0'}
        formattedAmount={selectedOrder ? selectedOrder.total.toFixed(2).replace('.', ',') : '0,00'}
        description={selectedOrder ? `Pedido realizado por ${selectedOrder.customerName}` : ''}
        icon="📦"
        isLoading={isConfirming}
      />
    </div>
  )
}

export default LojinhaOrdersPage
