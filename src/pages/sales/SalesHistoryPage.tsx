import React, { useEffect, useMemo, useState, useCallback } from 'react'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { Sale } from '../../contexts/SupabaseDataContext'
import { api } from '../../lib/api-client'
import { getOrderStatusClass, getOrderStatusLabel } from '../../lib/orderStatus'

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
          userId: sale.user_id || sale.userId || '',
          sellerId: sale.seller_id || sale.sellerId || '',
          saleId: sale.sale_number?.toString() || sale.sale_id || sale.id,
          category: sale.category || context,
          items: items,
          total: parseFloat(sale.total) || 0,
          status: sale.status || 'completed',
          createdAt: sale.created_at || sale.createdAt || null,
          customerName: sale.user_name || sale.customer_name || sale.user?.name || '',
          customerEmail: sale.user_email || sale.user?.email || '',
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
      sale.customerName?.toLowerCase().includes(searchName.toLowerCase())
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


  const title = context === 'lojinha' ? 'Histórico · Lojinha' : 'Histórico · Lanchonete'

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

  const navBtn = 'px-3 py-2 bg-creme-200 hover:bg-creme-300 text-ferro-800 border border-ferro-200 font-display text-sm rounded-lg disabled:opacity-40 disabled:cursor-not-allowed transition-colors'

  // Se não estiver na rota correta, não renderizar nada (DEPOIS de todos os hooks)
  if (!isCorrectRoute) {
    return null
  }

  return (
    <div className="painel p-4 md:p-8">
      <div className="mb-6">
        <span className="carimbo text-anil-700 text-xs">📜 Diário de bordo</span>
        <h2 className="mt-3 text-2xl md:text-3xl font-display font-semibold uppercase tracking-wide text-ferro-900">{title}</h2>
        <p className="text-base text-ferro-700">Visualize todas as vendas realizadas</p>
        <div className="trilho w-full mt-4" />
      </div>

      {isEmpty ? (
        <div className="bg-creme-100 border border-ferro-200 rounded-xl text-center py-10 px-4">
          <div className="text-5xl mb-3">🚉</div>
          <p className="text-ferro-600 text-lg mb-6">Nenhuma venda registrada ainda.</p>
          <button
            onClick={() => navigate({ to: context === 'lojinha' ? '/lojinha' : '/lanchonete' })}
            className="bg-vagao-600 hover:bg-vagao-700 text-creme-50 font-display font-semibold tracking-wide uppercase px-8 py-3 rounded-xl shadow-sm transition-all duration-200 hover:-translate-y-0.5"
          >
            + Nova venda
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Search Filter */}
          <input
            type="text"
            value={searchName}
            onChange={e => setSearchName(e.target.value)}
            placeholder="🔍 Buscar por cliente..."
            className="w-full"
          />

          {/* Info de Paginação */}
          <p className="text-center text-sm text-ferro-500">
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

          {/* Sales List */}
          <div className="space-y-5">
            {paginatedSales.map(sale => (
              <div key={sale.id} className="bilhete">
                <div className="p-4 md:p-5">
                  <div className="flex justify-between items-start gap-3 mb-3">
                    <div className="min-w-0">
                      <span className="font-display text-[11px] tracking-[0.3em] text-ferro-500 uppercase">Venda</span>
                      <h3 className="font-ticket text-xl font-bold text-ferro-900 leading-tight">Nº {sale.saleId}</h3>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-slab text-2xl text-vagao-600 leading-tight">
                        R$ {formatPrice(sale.total)}
                      </div>
                      <span className={`carimbo text-[11px] mt-1 ${getOrderStatusClass(sale.status)}`}>
                        {getOrderStatusLabel(sale.status)}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1 text-sm text-ferro-700">
                    <p>
                      <span className="text-ferro-500">Data:</span> <span className="font-semibold text-ferro-900">{sale.createdAt ? formatDate(sale.createdAt) : 'Data não disponível'}</span>
                    </p>
                    {sale.customerName && (
                      <p>
                        <span className="text-ferro-500">Cliente:</span> <span className="font-semibold text-ferro-900">{sale.customerName}</span>
                        {sale.customerEmail && <span className="ml-2 text-ferro-500">({sale.customerEmail})</span>}
                      </p>
                    )}
                    {sale.seller?.name && (
                      <p>
                        <span className="text-ferro-500">Vendedor:</span> <span className="font-semibold text-ferro-900">{sale.seller.name}</span>
                      </p>
                    )}
                  </div>
                </div>

                {/* Items */}
                <div className="picote-horizontal bg-creme-100 rounded-b-xl px-4 md:px-5 py-3">
                  <h4 className="font-display text-xs tracking-[0.2em] uppercase text-ferro-500 mb-2">Produtos</h4>
                  {sale.items && sale.items.length > 0 ? (
                    <div className="divide-y divide-ferro-200">
                      {sale.items.map((item, index) => (
                        <div key={item.productId || item.id || index} className="flex justify-between items-center gap-3 py-1.5">
                          <div className="min-w-0">
                            <span className="text-sm font-semibold text-ferro-900">{item.productName || 'Produto sem nome'}</span>
                            <span className="font-ticket text-sm text-ferro-500 ml-2">x{item.quantity || 0}</span>
                          </div>
                          <span className="font-slab text-sm text-ferro-900 shrink-0">
                            R$ {formatPrice((item.price || 0) * (item.quantity || 0))}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-ferro-500 italic">Nenhum item encontrado nesta venda</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              <button onClick={goToPrevPage} disabled={currentPage === 1} className={navBtn}>
                ← Anterior
              </button>

              <div className="flex items-center gap-1.5">
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
                      className={`w-10 h-10 p-0 flex items-center justify-center rounded-lg font-display text-sm transition-colors ${
                        isActive
                          ? 'bg-ferro-800 text-creme-200'
                          : 'bg-creme-200 text-ferro-800 border border-ferro-200 hover:bg-creme-300'
                      }`}
                    >
                      {pageNum}
                    </button>
                  )
                })}
              </div>

              <button onClick={goToNextPage} disabled={currentPage === totalPages} className={navBtn}>
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
