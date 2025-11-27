import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { Sale, useSupabaseData } from '../../contexts/SupabaseDataContext'


type ContextType = 'lojinha' | 'lanchonete'

const SalesHistoryPage: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  
  // TODOS OS HOOKS DEVEM SER CHAMADOS ANTES DE QUALQUER RETURN CONDICIONAL
  const { getSales } = useSupabaseData()
  const [allSales, setAllSales] = useState<Sale[]>([])
  const [searchName, setSearchName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  // Verificar se está na rota correta
  const isCorrectRoute = location.pathname.includes('/historico/lojinha') || location.pathname.includes('/historico/lanchonete')
  const context: ContextType = location.pathname.endsWith('/lojinha') ? 'lojinha' : 'lanchonete'

  const loadSales = useCallback(async () => {
    if (isLoading) return
    
    try {
      setIsLoading(true)
        // Carregar até 200 vendas (10 páginas)
        const fetchedSales = await getSales(context, 200)
        setAllSales(fetchedSales)
    } catch (error) {
      console.error('Erro ao carregar vendas:', error)
    } finally {
      setIsLoading(false)
    }
  }, [getSales, context])

  useEffect(() => {
    // Só carregar vendas se estiver na rota correta
    if (isCorrectRoute) {
      loadSales()
      setCurrentPage(1)
    }
  }, [context, location.pathname, isCorrectRoute, loadSales])

  const filteredSales = useMemo(() => {
    let sales = allSales.filter(sale => sale.category === context);
    if (searchName.trim()) {
      sales = sales.filter(sale =>
        sale.card?.user_name?.toLowerCase().includes(searchName.toLowerCase())
      )
    }
    return sales;
  }, [allSales, searchName])

  // Paginação
  const totalPages = Math.ceil(filteredSales.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedSales = filteredSales.slice(startIndex, startIndex + itemsPerPage)
  
  const salesInContext = useMemo(() => {
  return allSales.filter(sale => sale.category === context);
  }, [allSales, context]);

  const isEmpty = useMemo(() => salesInContext.length === 0, [salesInContext]);

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
              <div className="mb-6 text-center">
                <p className="text-sm text-gray-600">
                  Mostrando {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredSales.length)} de {filteredSales.length} vendas
                  {totalPages > 1 && ` • Página ${currentPage} de ${totalPages}`}
                </p>
              </div>
            )}
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
                    <p className="text-base text-gray-700">
                      Criado em: {sale.createdAt ? formatDate(sale.createdAt) : 'Data não disponível'}
                    </p>
                    {sale.card?.card_number && sale.card?.user_name && (
                      <p className="text-base text-gray-700 mt-1">
                        Cartão: <span className="font-semibold">{sale.card?.card_number}</span> • 
                        Cliente: <span className="font-semibold">{sale.card?.user_name}</span>
                      </p>
                    )}
                    {sale.seller?.name && (
                      <p className="text-base text-gray-700 mt-1">
                        Vendedor: <span className="font-semibold">{sale.seller.name}</span>
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
                    <div className="space-y-3">
                      {sale.items?.map((item, index) => (
                        <div key={item.productId || index} className="flex justify-between items-center py-2 border-b border-gray-300 last:border-b-0">
                          <div>
                            <span className="text-base font-semibold text-gray-900">{item.productName}</span>
                            <span className="text-base text-gray-700 ml-3">x{item.quantity}</span>
                          </div>
                          <span className="text-lg font-bold text-gray-900">
                            R$ {formatPrice(item.price * item.quantity)}
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

