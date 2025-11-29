import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { Sale } from '../../contexts/SupabaseDataContext'
import { api } from '../../lib/api-client'

type ContextType = 'lojinha' | 'lanchonete'

const SalesHistoryPage: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  
  const [allSales, setAllSales] = useState<Sale[]>([])
  const [searchName, setSearchName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalSales, setTotalSales] = useState(0)
  const itemsPerPage = 20

  // Verificar se está na rota correta
  const isCorrectRoute = location.pathname.includes('/historico/lojinha') || location.pathname.includes('/historico/lanchonete')
  const context: ContextType = location.pathname.endsWith('/lojinha') ? 'lojinha' : 'lanchonete'

  const loadSales = useCallback(async (page: number = 1) => {
    if (isLoading) return
    
    try {
      setIsLoading(true)
      // Usar api.listSales() com paginação server-side
      const response = await api.listSales(context, undefined, page, itemsPerPage)
      
      if (!response.success) {
        const errorMsg = (response as any).error || 'Erro ao carregar vendas'
        console.error('Erro ao carregar vendas:', errorMsg)
        setAllSales([])
        setTotalSales(0)
        
        // Se for erro de permissão, mostrar mensagem mas não redirecionar
        if (errorMsg.includes('Acesso negado') || errorMsg.includes('permissão') || errorMsg.includes('403')) {
          console.warn('Sem permissão para ver histórico:', errorMsg)
        }
        return
      }
      
      // Converter os dados da API (formato do banco) para o formato Sale esperado
      const sales = (response.data || []).map((sale: any) => {
        // Mapear items - pode vir como array ou objeto
        let items = []
        if (sale.sale_items) {
          if (Array.isArray(sale.sale_items)) {
            items = sale.sale_items.map((item: any) => ({
              id: item.id,
              productId: item.product_id || item.productId || '',
              productName: item.product_name || item.productName || 'Produto sem nome',
              quantity: item.quantity || 0,
              price: parseFloat(item.price) || 0
            }))
          } else {
            // Se não for array, tentar tratar como objeto único
            items = [{
              id: sale.sale_items.id,
              productId: sale.sale_items.product_id || sale.sale_items.productId || '',
              productName: sale.sale_items.product_name || sale.sale_items.productName || 'Produto sem nome',
              quantity: sale.sale_items.quantity || 0,
              price: parseFloat(sale.sale_items.price) || 0
            }]
          }
        }
        
        // Debug: logar para ver o formato dos dados
        if (items.length === 0 && sale.sale_items) {
          console.warn('Sale sem items mapeados:', { sale_id: sale.id, sale_items: sale.sale_items })
        }
        
        return {
          id: sale.id,
          userId: sale.card_id || sale.userId || '',
          sellerId: sale.seller_id || sale.sellerId || '',
          saleId: sale.sale_number?.toString() || sale.sale_id || sale.id,
          category: sale.category || context,
          items: items,
          total: parseFloat(sale.total) || 0,
          status: sale.status || 'completed',
          createdAt: sale.created_at || sale.createdAt || null,
          card: sale.cards ? (Array.isArray(sale.cards) ? (sale.cards[0] ? {
            cardNumber: sale.cards[0].card_number || sale.cards[0].cardNumber,
            userName: sale.cards[0].user_name || sale.cards[0].userName
          } : null) : {
            cardNumber: sale.cards.card_number || sale.cards.cardNumber,
            userName: sale.cards.user_name || sale.cards.userName
          }) : null,
          seller: (sale.app_users && (Array.isArray(sale.app_users) ? sale.app_users[0] : sale.app_users)) || sale.seller ? {
            id: sale.seller_id || (Array.isArray(sale.app_users) ? sale.app_users[0]?.id : sale.app_users?.id) || sale.seller?.id || '',
            name: (Array.isArray(sale.app_users) ? sale.app_users[0]?.name : sale.app_users?.name) || sale.seller?.name || 'Vendedor',
            email: (Array.isArray(sale.app_users) ? sale.app_users[0]?.email : sale.app_users?.email) || sale.seller?.email || ''
          } : null
        } as Sale
      })
      
      // Atualizar total de vendas para paginação
      if (response.total !== undefined) {
        setTotalSales(response.total)
      } else if (sales.length > 0) {
        // Se não veio total mas há vendas, estimar baseado no que temos
        // Isso evita mostrar "Nenhuma venda encontrada" quando há vendas na página
        setTotalSales(Math.max(totalSales, (page - 1) * itemsPerPage + sales.length))
      }
      
      console.log('Sales mapeadas:', sales.slice(0, 2)) // Debug: ver primeiras 2 vendas
      setAllSales(sales)
    } catch (error: any) {
      console.error('Erro ao carregar vendas:', error)
      // Não quebrar a UI - apenas mostrar array vazio
      setAllSales([])
      
      // Se for erro de permissão, mostrar mensagem mas não redirecionar
      const errorMsg = error?.message || error?.error || ''
      if (errorMsg.includes('Acesso negado') || errorMsg.includes('permissão') || errorMsg.includes('403')) {
        console.warn('Sem permissão para ver histórico:', errorMsg)
      }
    } finally {
      setIsLoading(false)
    }
  }, [context, isLoading, itemsPerPage])

  useEffect(() => {
    // Só carregar vendas se estiver na rota correta
    if (isCorrectRoute) {
      // Resetar para página 1 quando mudar de contexto
      setCurrentPage(1)
    }
  }, [context, location.pathname, isCorrectRoute])

  useEffect(() => {
    // Carregar vendas quando a página mudar ou quando mudar de contexto
    if (isCorrectRoute && currentPage > 0) {
      loadSales(currentPage)
    }
  }, [currentPage, context, isCorrectRoute])

  // Filtrar por nome do cliente (filtro local na página atual)
  const filteredSales = useMemo(() => {
    if (!searchName.trim()) {
      return allSales
    }
    return allSales.filter(sale =>
      sale.card?.userName?.toLowerCase().includes(searchName.toLowerCase())
    )
  }, [allSales, searchName])

  // Paginação baseada no total do servidor
  const totalPages = Math.ceil(totalSales / itemsPerPage)
  const paginatedSales = filteredSales // Já vem paginado do servidor
  
  const isEmpty = useMemo(() => allSales.length === 0 && !isLoading, [allSales.length, isLoading]);

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => {
        const nextPage = prev + 1
        loadSales(nextPage)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return nextPage
      })
    }
  }

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => {
        const prevPage = prev - 1
        loadSales(prevPage)
        window.scrollTo({ top: 0, behavior: 'smooth' })
        return prevPage
      })
    }
  }

  const goToPage = (page: number) => {
    setCurrentPage(page)
    loadSales(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }


  const title = context === 'lojinha' ? '🏪 Histórico de Vendas - Lojinha' : '🍔 Histórico de Vendas - Lanchonete'
  const borderColor = context === 'lojinha' ? 'border-blue-300' : 'border-orange-300'
  const accentColor = context === 'lojinha' ? 'blue' : 'orange'

  const formatDate = (iso?: string | null): string => {
    if (!iso) {
      return 'Data não disponível'
    }
    try {
      const date = new Date(iso)
      if (isNaN(date.getTime())) {
        return 'Data inválida'
      }
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch (error) {
      console.error('Erro ao formatar data:', error)
      return 'Erro na data'
    }
  }
  
  const formatPrice = (price: number) => price.toFixed(2)

  // Se não estiver na rota correta, não renderizar nada (DEPOIS de todos os hooks)
  if (!isCorrectRoute) {
    return null
  }

  return (
    <div className={`bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl border-2 ${borderColor} p-10`}>
      <div className="mb-8">
        <h2 className="text-4xl font-bold text-black mb-4">{title}</h2>
        <p className="text-lg text-gray-800">Visualize todas as vendas realizadas</p>
      </div>

      {isEmpty ? (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-gray-500 text-lg mb-6">Nenhuma venda registrada ainda.</p>
          <button 
            onClick={() => navigate({ to: context === 'lojinha' ? '/lojinha' : '/lanchonete' })} 
            className={`bg-${accentColor}-500 hover:bg-${accentColor}-600 text-white font-semibold px-8 py-3 rounded-lg shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5`}
          >
            + NOVA VENDA
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Search Filter */}
          <div className="mb-6">
            <input
              type="text"
              value={searchName}
              onChange={e => setSearchName(e.target.value)}
              placeholder="Buscar por cliente..."
              className={`w-full px-5 py-3 bg-white border-2 border-gray-300 rounded-lg
                        focus:border-${accentColor}-400 focus:outline-none focus:ring-0 transition-all
                        placeholder:text-gray-400 text-gray-900 text-base shadow-sm`}
            />
          </div>

          {/* Info de Paginação */}
          <div className="mb-6 text-center">
            <p className="text-sm text-gray-600">
              {allSales.length > 0 ? (
                <>
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1}-{Math.min(currentPage * itemsPerPage, totalSales || (currentPage * itemsPerPage))} de {totalSales || '?'} vendas
                  {totalPages > 1 && ` • Página ${currentPage} de ${totalPages}`}
                </>
              ) : isLoading ? (
                'Carregando vendas...'
              ) : (
                'Nenhuma venda encontrada'
              )}
            </p>
          </div>

          {/* Sales List */}
          <div className="space-y-6">
            {paginatedSales.map(sale => (
              <div key={sale.id} className="border-2 border-gray-300 rounded-lg p-6 bg-white shadow-lg">
                <div className="flex justify-between items-start mb-5">
                  <div>
                    <div className="flex items-center space-x-4 mb-3">
                      <h3 className="text-2xl font-bold text-black">Venda #{sale.saleId}</h3>
                    </div>
                    <p className="text-base text-gray-700 mb-2">
                      📅 <span className="font-semibold">{sale.createdAt ? formatDate(sale.createdAt) : 'Data não disponível'}</span>
                    </p>
                    {sale.card?.cardNumber && sale.card?.userName && (
                      <p className="text-base text-gray-700 mt-2">
                        💳 Cartão: <span className="font-semibold">{sale.card.cardNumber}</span> • 
                        👤 Cliente: <span className="font-semibold">{sale.card.userName}</span>
                      </p>
                    )}
                    {sale.seller?.name && (
                      <p className="text-base text-gray-700 mt-1">
                        🏪 Vendedor: <span className="font-semibold">{sale.seller.name}</span>
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-emerald-700">
                      R$ {formatPrice(sale.total)}
                    </div>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="mb-5">
                  <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold ${
                    sale.status === 'completed' ? 'bg-emerald-100 text-emerald-800' :
                    sale.status === 'delivered' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {sale.status === 'completed' ? '✓ Concluída' :
                     sale.status === 'delivered' ? '📦 Entregue' :
                     sale.status}
                  </span>
                </div>

                {/* Items */}
                <div className="mb-5">
                  <h4 className="text-lg font-bold text-black mb-3">🛍️ Produtos:</h4>
                  <div className="bg-gray-50 rounded-lg p-5 border-2 border-gray-200">
                    {sale.items && sale.items.length > 0 ? (
                      <div className="space-y-3">
                        {sale.items.map((item, index) => (
                          <div key={item.productId || item.id || index} className="flex justify-between items-center py-2 border-b border-gray-300 last:border-b-0">
                            <div>
                              <span className="text-base font-semibold text-gray-900">{item.productName || 'Produto sem nome'}</span>
                              <span className="text-base text-gray-700 ml-3">x{item.quantity || 0}</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">
                              R$ {formatPrice((item.price || 0) * (item.quantity || 0))}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">Nenhum item encontrado nesta venda</p>
                    )}
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
                className={`px-5 py-2.5 bg-white border-2 border-${accentColor}-400 rounded-lg
                          text-${accentColor}-600 font-semibold text-sm
                          hover:bg-${accentColor}-400 hover:text-${context === 'lojinha' ? 'white' : 'black'}
                          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-${accentColor}-600
                          transition-all duration-200`}
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
                          ? `bg-${accentColor}-400 text-${context === 'lojinha' ? 'white' : 'black'} border-2 border-${accentColor}-500 shadow-md`
                          : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-' + accentColor + '-400 hover:bg-' + accentColor + '-50'
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
                className={`px-5 py-2.5 bg-white border-2 border-${accentColor}-400 rounded-lg
                          text-${accentColor}-600 font-semibold text-sm
                          hover:bg-${accentColor}-400 hover:text-${context === 'lojinha' ? 'white' : 'black'}
                          disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-${accentColor}-600
                          transition-all duration-200`}
              >
                Próxima →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SalesHistoryPage

