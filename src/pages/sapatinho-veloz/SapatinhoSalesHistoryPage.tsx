import React, { useEffect, useMemo, useState } from 'react'
import { sapatinhoVelozApi } from '../../api/sapatinho-veloz.api'
import { SapatinhoVelozOrder } from '../../types'
import { supabase } from '../../lib/supabase'

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
      // Carregar todos os pedidos (incluindo entregues)
      const fetchedOrders = await sapatinhoVelozApi.getAll()
      
      // ✅ OTIMIZAÇÃO: Buscar todos os cards de uma vez (evita N+1 queries)
      const userIdsNeedingCards = fetchedOrders
        .filter(order => !order.senderName && order.senderUserId)
        .map(order => order.senderUserId)
        .filter((id, index, self) => self.indexOf(id) === index) // Remove duplicatas
      
      let cardsMap = new Map<string, string>()
      
      if (userIdsNeedingCards.length > 0) {
        const { data: cards, error: cardsError } = await supabase
          .from('cards')
          .select('user_id, user_name')
          .in('user_id', userIdsNeedingCards)
        
        if (!cardsError && cards) {
          cards.forEach(card => {
            if (card.user_name) {
              cardsMap.set(card.user_id, card.user_name)
            }
          })
        }
      }
      
      // Processar pedidos com os cards já carregados
      const ordersWithSenders = fetchedOrders.map((order) => {
        let senderName = order.senderName
        let isAnonymous = false
        
        // Se não tem sender_name, buscar do map de cards
        if (!senderName && order.senderUserId) {
          senderName = cardsMap.get(order.senderUserId) || null
        }
        
        // Verificar se é anônimo (sender_name null)
        if (!order.senderName) {
          isAnonymous = true
        }
        
        return {
          ...order,
          senderName: senderName || null,
          isAnonymous
        }
      })
      
      setAllOrders(ordersWithSenders)
    } catch (error) {
      console.error('Erro ao carregar pedidos:', error)
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
    const baseClasses = `
    px-4 py-2
    rounded-full
    text-base
    font-bold
    border-2
    max-[413px]:!px-0.5
    max-[413px]:!py-1
    max-[413px]:!text-xs
    max-[413px]:!rounded-md`

     switch (status) {
      case 'pending':
        return <span className={`${baseClasses} bg-yellow-200 text-yellow-900 border-yellow-400`}>⏳ Pendente</span>
      case 'completed':
        return <span className={`${baseClasses} bg-blue-200 text-blue-900 border-blue-400`}>📦 Aguardando entrega</span>
      case 'delivered':
        return <span className={`${baseClasses} bg-green-200 text-green-900 border-green-400`}>🚚 Entregue</span>
      default:
        return <span className={`${baseClasses} bg-gray-200 text-gray-900 border-gray-400`}>{status}</span>
    }
  }

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border-2 border-yellow-300 p-10">
      <div className="mb-8">
        <h2 className="text-4xl font-bold text-black mb-4">📊 Histórico de Pedidos - Sapatinho velOz</h2>
        <p className="text-lg text-gray-800">Visualize todos os pedidos do Sapatinho velOz</p>
      </div>

      {/* Search Filter */}
      <div className="mb-6">
        <input
          type="text"
          value={searchName}
          onChange={e => setSearchName(e.target.value)}
          placeholder="Buscar por remetente ou destinatário..."
          className="w-full px-5 py-3 bg-white border-2 border-gray-300 rounded-lg
                    focus:border-yellow-400 focus:outline-none focus:ring-0 transition-all
                    placeholder:text-gray-400 text-gray-900 text-base shadow-sm"
        />
      </div>

      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-400 mx-auto mb-4"></div>
          <p className="text-gray-500">Carregando pedidos...</p>
        </div>
      ) : paginatedOrders.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-gray-500 text-lg">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <>
          {/* Info de Paginação */}
          <div className="mb-6 text-center">
            <p className="text-sm text-gray-600">
              Mostrando {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredOrders.length)} de {filteredOrders.length} pedidos
              {totalPages > 1 && ` • Página ${currentPage} de ${totalPages}`}
            </p>
          </div>

          <div className="space-y-6">
          {paginatedOrders.map(order => (
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
                  {order.deliveredAt && (
                    <p className="text-base text-gray-700 mt-1">
                      Entregue em: {formatDate(order.deliveredAt)}
                    </p>
                  )}
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
                      <span className="
                        px-3 py-1
                        bg-purple-200 text-purple-900
                        rounded-full
                        text-sm font-bold
                        border-2 border-purple-400

                        /* Ajustes para telas pequenas (360px–413px) */
                        max-[413px]:!px-1
                        max-[413px]:!py-0.5
                        max-[413px]:!text-xs
                        max-[413px]:!rounded-md
                      ">
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

              {order.message && (
                <div className="bg-yellow-100 border-l-4 border-yellow-500 p-5 mb-5 rounded-r-lg">
                  <h4 className="text-lg font-bold text-black mb-2">💌 Mensagem:</h4>
                  <p className="text-base text-gray-900">{order.message}</p>
                </div>
              )}

              {/* Items */}
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
            </div>
          ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-10 flex items-center justify-center gap-3">
              {/* Botão Anterior */}
              <button
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                className="px-5 py-2.5 bg-white border-2 border-yellow-400 rounded-lg
                          text-yellow-600 font-semibold text-sm
                          hover:bg-yellow-400 hover:text-black
                          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-yellow-600
                          transition-all duration-200"
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
                      className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold text-sm transition-all duration-200 ${
                        isActive
                          ? 'bg-yellow-400 text-black border-2 border-yellow-500 shadow-md'
                          : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-yellow-400 hover:bg-yellow-50'
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
                className="px-5 py-2.5 bg-white border-2 border-yellow-400 rounded-lg
                          text-yellow-600 font-semibold text-sm
                          hover:bg-yellow-400 hover:text-black
                          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-yellow-600
                          transition-all duration-200"
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

