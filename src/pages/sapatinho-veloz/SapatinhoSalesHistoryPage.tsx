import React, { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api-client'
import { SapatinhoVelozOrder } from '../../types'
import { TrainLoader } from '../../components/shared'

const SapatinhoSalesHistoryPage: React.FC = () => {
  const [allOrders, setAllOrders] = useState<SapatinhoVelozOrder[]>([])
  const [searchName, setSearchName] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    loadOrders()
  }, [])

  const loadOrders = async () => {
    try {
      setIsLoading(true)
      // Carregar todos os pedidos (incluindo entregues) via Edge Function
      const response = await api.listOrders('sapatinho')
      
      if (!response.success) {
        // Não quebrar a UI se não autenticado - apenas logar e mostrar array vazio
        const errorMsg = (response as any).error || 'Erro ao carregar pedidos'
        if (errorMsg.includes('Não autenticado') || errorMsg.includes('autenticado') || errorMsg.includes('Unauthorized')) {
          console.warn('Não autenticado - pedidos não serão carregados')
          setAllOrders([])
          setIsLoading(false)
          return
        }
        throw new Error(errorMsg)
      }

      // Transformar dados da Edge Function para o formato esperado
      const ordersWithSenders = (response.data || []).map((order: any) => {
        // A Edge Function já retorna os dados formatados
        const senderName = order.sender_name || null
        const isAnonymous = !order.sender_name && order.sender_user_id !== null
        
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
          senderName: senderName,
          senderTeam: order.sender_team || null,
          recipientName: order.recipient_name,
          recipientAddress: order.recipient_address,
          message: order.message || null,
          items: mappedItems,
          total: parseFloat(order.total) || 0,
          status: order.status,
          createdAt: order.created_at,
          deliveredAt: order.delivered_at || null,
          isAnonymous
        } as SapatinhoVelozOrder
      })
      
      setAllOrders(ordersWithSenders)
    } catch (error: any) {
      console.error('Erro ao carregar pedidos:', error)
      // Não quebrar a UI se houver erro
      setAllOrders([])
    } finally {
      setIsLoading(false)
    }
  }

  const filteredOrders = useMemo(() => {
    if (!searchName.trim()) return allOrders
    return allOrders.filter(order =>
      order.recipientName?.toLowerCase().includes(searchName.toLowerCase()) ||
      order.senderName?.toLowerCase().includes(searchName.toLowerCase())
    )
  }, [allOrders, searchName])

  // Paginação
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedOrders = filteredOrders.slice(startIndex, startIndex + itemsPerPage)

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const goToPage = (page: number) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
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

  const pagerButtonClass = `!px-4 !py-2 bg-creme-200 border-2 border-ferro-200 rounded-xl
                          text-ferro-800 font-display uppercase tracking-wide text-sm
                          hover:bg-creme-300
                          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-creme-200
                          transition-all duration-200`

  return (
    <div className="painel p-4 sm:p-6 md:p-10 text-ferro-900">
      <div className="mb-6 md:mb-8">
        <p className="text-xs font-display uppercase tracking-[0.2em] text-vagao-600 mb-1">Livro de despachos</p>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-display font-semibold uppercase tracking-wide text-ferro-900 mb-2">💌 Histórico – Sapatinho Veloz</h2>
        <p className="text-base sm:text-lg text-ferro-700 mb-4">Visualize todos os pedidos do Sapatinho Veloz</p>
        <div className="trilho w-full" />
      </div>

      {/* Search Filter */}
      <div className="mb-6">
        <input
          type="text"
          value={searchName}
          onChange={e => setSearchName(e.target.value)}
          placeholder="🔍 Buscar por remetente ou destinatário..."
          className="w-full px-4 py-3 bg-creme-50 border-2 border-ferro-200 rounded-xl
                    focus:border-ferro-500 transition-all
                    text-ferro-900 text-base shadow-sm"
        />
      </div>

      {isLoading ? (
        <div className="py-4">
          <TrainLoader fullScreen={false} title="Carregando pedidos..." message="Consultando o livro de despachos" />
        </div>
      ) : paginatedOrders.length === 0 ? (
        <div className="text-center py-10 bg-creme-100 border border-ferro-200 rounded-xl">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-ferro-600 text-lg">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <>
          {/* Info de Paginação */}
          <div className="mb-6 text-center">
            <p className="text-sm text-ferro-600">
              Mostrando {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredOrders.length)} de {filteredOrders.length} pedidos
              {totalPages > 1 && ` • Página ${currentPage} de ${totalPages}`}
            </p>
          </div>

          <div className="space-y-6">
          {paginatedOrders.map(order => (
            <div key={order.id} className="bilhete p-4 sm:p-6">
              <div className="flex flex-wrap justify-between items-start gap-3 mb-4">
                <div className="min-w-0">
                  <p className="text-xs font-display uppercase tracking-[0.2em] text-ferro-500">Encomenda</p>
                  <h3 className="text-xl sm:text-2xl font-ticket font-bold text-ferro-900 mb-2">#{order.id.slice(-5)}</h3>
                  <div className="mb-2">{getStatusBadge(order.status)}</div>
                  <p className="text-sm text-ferro-600">
                    Criado em: {formatDate(order.createdAt)}
                  </p>
                  {order.deliveredAt && (
                    <p className="text-sm text-ferro-600 mt-1">
                      Entregue em: {formatDate(order.deliveredAt)}
                    </p>
                  )}
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

              {order.message && (
                <div className="bg-creme-200 border border-ferro-200 border-l-4 border-l-vagao-600 p-4 mb-4 rounded-xl">
                  <h4 className="text-base font-display uppercase tracking-wide text-ferro-800 mb-2">💌 Mensagem</h4>
                  <p className="text-base text-ferro-900 italic leading-relaxed whitespace-pre-line break-words">{order.message}</p>
                </div>
              )}

              {/* Items */}
              <div>
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
            </div>
          ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
              {/* Botão Anterior */}
              <button
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                className={pagerButtonClass}
              >
                ← Anterior
              </button>

              {/* Números de Página */}
              <div className="flex items-center gap-2">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number
                  if (totalPages <= 5) {
                    pageNum = i + 1
                  } else if (currentPage <= 3) {
                    pageNum = i + 1
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i
                  } else {
                    pageNum = currentPage - 2 + i
                  }

                  const isActive = currentPage === pageNum

                  return (
                    <button
                      key={pageNum}
                      onClick={() => goToPage(pageNum)}
                      className={`!p-0 w-10 h-10 flex items-center justify-center rounded-lg font-ticket font-bold text-sm transition-all duration-200 ${
                        isActive
                          ? 'bg-ferro-800 text-creme-200 border-2 border-ferro-800 shadow-md'
                          : 'bg-creme-50 text-ferro-800 border-2 border-ferro-200 hover:border-ferro-400'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              {/* Botão Próxima */}
              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className={pagerButtonClass}
              >
                Próxima →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default SapatinhoSalesHistoryPage

