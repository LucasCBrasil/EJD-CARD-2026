import { useState, useEffect } from 'react'
import { useToastContext } from '../../contexts/ToastContext'
import { Button, Header } from '../../components/shared'
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
    return <div className="flex justify-center p-8">Carregando pedidos...</div>
  }

  return (
    <div className="space-y-6">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border-2 border-yellow-200 p-6 md:p-8">
        <Header title="📦 Pedidos Pendentes - Lojinha"
          subtitle={"Confirme as entregas dos pedidos realizados na lojinha"}
          showLogo={false}/>

        {orders.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">Nenhum pedido pendente</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 [grid-auto-rows:1fr]">
            {orders.map(order => (
              <div
                key={order.id}
                className="bg-white shadow-md rounded-xl p-4 flex flex-col justify-between h-full"
              >
        <div>
            <div className="flex justify-between items-start mb-4">
            <div>
                <h3 className="font-bold">Pedido #{order.saleNumber}</h3>
                <p className="text-sm text-gray-600">{order.customerName}</p>
            </div>
            <span className="text-lg font-semibold">
                R$ {order.total.toFixed(2)}
            </span>
            </div>

            <div className="mb-4">
            <h4 className="font-semibold mb-2">Itens:</h4>
            <ul className="text-sm space-y-1">
                {order.items?.map((item, index) => (
                <li key={index}>
                    {item.productName} ({item.quantity}x)
                </li>
            ))}
            </ul>
            </div>
        </div>

        <div className="flex justify-between items-center mt-auto">
            <span className="text-sm text-gray-500">
            {formatDate(order.createdAt)}
            </span>
            <Button
            onClick={() => handleOpenConfirmation(order)}
            className="bg-ferro-500 hover:bg-ferro-600 text-white text-xs px-1 py-2.5"
            >
            ✅ Confirmar Entrega
            </Button>
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
        card={null}
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