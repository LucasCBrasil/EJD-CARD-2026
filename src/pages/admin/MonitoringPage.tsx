import React, { useEffect, useState, useRef, useMemo } from 'react'
import { usePermissions } from '../../hooks/usePermissions'
import { api } from '../../lib/api-client'

interface Transaction {
  id: string
  card_id: string
  amount: string
  type: 'credit' | 'debit'
  description: string
  created_by: string | null
  created_at: string
  user_name: string | null
  card_number: string | null
}

// Formatar tempo relativo
function timeAgo(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 10) return 'agora'
  if (diffSec < 60) return `${diffSec}s`
  if (diffMin < 60) return `${diffMin}min`
  if (diffHour < 24) return `${diffHour}h`
  return `${diffDay}d`
}

// Formatar valor monetário
function formatCurrency(value: string | number, hidden: boolean = false): string {
  if (hidden) return '•••••'
  const num = typeof value === 'string' ? parseFloat(value) : value
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

type TabType = 'transactions' | 'cards'

// Componente de Heartbeat animado
const Heartbeat: React.FC<{ isActive: boolean }> = ({ isActive }) => (
  <div className="relative flex items-center justify-center">
    <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-green-500' : 'bg-latao-500'}`}>
      {isActive && (
        <>
          <span className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-75" />
          <span className="absolute inset-0 rounded-full bg-green-300/60 animate-pulse" />
        </>
      )}
    </div>
  </div>
)

// Componente de barra de progresso para countdown
const CountdownBar: React.FC<{ progress: number; isFetching: boolean }> = ({ progress, isFetching }) => (
  <div className="h-1 bg-creme-200/15 rounded-full overflow-hidden">
    <div 
      className={`h-full transition-all duration-200 ${isFetching ? 'bg-anil-300 animate-pulse' : 'bg-latao-400'}`}
      style={{ width: `${progress}%` }}
    />
  </div>
)

// Célula do painel de partidas
const BoardStat: React.FC<{ label: React.ReactNode; value: React.ReactNode; tone?: string; small?: boolean; className?: string }> = ({
  label,
  value,
  tone = 'text-latao-400',
  small = false,
  className = '',
}) => (
  <div className={`rounded-lg bg-ferro-950/60 border border-creme-200/10 px-3 py-2.5 transition-all duration-300 ${className}`}>
    <div className="font-display text-[10px] sm:text-xs uppercase tracking-[0.18em] text-creme-200/60 mb-1 flex items-center gap-1">
      {label}
    </div>
    <div className={`font-slab tabular-nums leading-tight break-words ${small ? 'text-base sm:text-lg' : 'text-2xl'} ${tone}`}>
      {value}
    </div>
  </div>
)

interface CardData {
  id: string
  user_name: string | null
  card_number: string
  balance: string
  created_at: string
}

const MonitoringPage: React.FC = () => {
  const { canManageUsers } = usePermissions()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [todayCards, setTodayCards] = useState<CardData[]>([])
  const [loading, setLoading] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())
  const [newTransactionIds, setNewTransactionIds] = useState<Set<string>>(new Set())
  const [countdown, setCountdown] = useState(5)
  const [page, setPage] = useState(0)
  const [rowsPerPage, setRowsPerPage] = useState(50)
  const previousIdsRef = useRef<Set<string>>(new Set())
  const intervalRef = useRef<number | null>(null)
  const countdownRef = useRef<number | null>(null)
  
  // Estados para abas e visibilidade de valores
  const [activeTab, setActiveTab] = useState<TabType>('transactions')
  const [showValues, setShowValues] = useState(false) // Padrão: escondido

  // Estatísticas calculadas
  const stats = useMemo(() => {
    if (transactions.length === 0) {
      return { totalCredits: 0, totalDebits: 0, netFlow: 0, count: 0, last5min: 0 }
    }

    const now = new Date()
    const fiveMinAgo = new Date(now.getTime() - 5 * 60 * 1000)

    let totalCredits = 0
    let totalDebits = 0
    let last5min = 0

    transactions.forEach(t => {
      const amount = parseFloat(t.amount)
      if (t.type === 'credit') {
        totalCredits += amount
      } else {
        totalDebits += Math.abs(amount)
      }
      if (new Date(t.created_at) > fiveMinAgo) {
        last5min++
      }
    })

    return {
      totalCredits,
      totalDebits,
      netFlow: totalCredits - totalDebits,
      count: transactions.length,
      last5min
    }
  }, [transactions])

  // Estatísticas dos cartões cadastrados hoje
  const cardStats = useMemo(() => {
    if (todayCards.length === 0) {
      return { 
        count: 0, 
        totalBalance: 0, 
        avgBalance: 0, 
        withBalance: 0, 
        withoutBalance: 0,
        maxBalance: 0,
        minBalance: 0
      }
    }

    let totalBalance = 0
    let withBalance = 0
    let withoutBalance = 0
    let maxBalance = 0
    let minBalance = Infinity

    todayCards.forEach(card => {
      const balance = parseFloat(card.balance) || 0
      totalBalance += balance
      if (balance > 0) {
        withBalance++
      } else {
        withoutBalance++
      }
      if (balance > maxBalance) maxBalance = balance
      if (balance < minBalance) minBalance = balance
    })

    return {
      count: todayCards.length,
      totalBalance,
      avgBalance: todayCards.length > 0 ? totalBalance / todayCards.length : 0,
      withBalance,
      withoutBalance,
      maxBalance,
      minBalance: minBalance === Infinity ? 0 : minBalance
    }
  }, [todayCards])

  const fetchTransactions = async () => {
    setIsFetching(true)
    try {
      // Buscar transações e cartões em paralelo
      const [transactionsResponse, cardsResponse] = await Promise.all([
        api.listTransactions(),
        api.listCards()
      ])

      // Processar transações
      if (transactionsResponse.success && transactionsResponse.data) {
        const newData = transactionsResponse.data as Transaction[]
        
        // Detectar novas transações
        const newIds = new Set(newData.map(t => t.id))
        const brandNew = new Set<string>()
        newIds.forEach(id => {
          if (!previousIdsRef.current.has(id)) {
            brandNew.add(id)
          }
        })
        
        if (brandNew.size > 0 && previousIdsRef.current.size > 0) {
          setNewTransactionIds(brandNew)
          // Limpar animação após 3s
          setTimeout(() => setNewTransactionIds(new Set()), 3000)
        }
        
        previousIdsRef.current = newIds
        setTransactions(newData)
      }

      // Processar cartões - filtrar apenas os cadastrados hoje
      if (cardsResponse.success && cardsResponse.data) {
        const allCards = cardsResponse.data as CardData[]
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        
        const cardsToday = allCards.filter(card => {
          const cardDate = new Date(card.created_at)
          cardDate.setHours(0, 0, 0, 0)
          return cardDate.getTime() === today.getTime()
        })
        
        setTodayCards(cardsToday)
      }

      setLastUpdate(new Date())
      setError(null)
    } catch (err: any) {
      setError(err.message || 'Erro ao buscar dados')
    } finally {
      setLoading(false)
      setIsFetching(false)
      setCountdown(5) // Reset countdown
    }
  }

  useEffect(() => {
    fetchTransactions()
    
    // Polling a cada 5 segundos
    intervalRef.current = window.setInterval(fetchTransactions, 5000)

    // Countdown timer (atualiza a cada 100ms para animação suave)
    countdownRef.current = window.setInterval(() => {
      setCountdown(prev => Math.max(0, prev - 0.1))
    }, 100)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  // Transações visíveis na página atual
  const visibleTransactions = useMemo(() => {
    return transactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
  }, [transactions, page, rowsPerPage])

  if (!canManageUsers) {
    return (
      <div className="painel border-2 !border-vagao-600/40 p-6 sm:p-8 text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h2 className="text-2xl font-display font-semibold uppercase text-vagao-600 mb-3">Acesso Negado</h2>
        <p className="text-ferro-700">Você não tem permissão para acessar esta área.</p>
      </div>
    )
  }

  const totalPagesTx = Math.max(1, Math.ceil(transactions.length / rowsPerPage))
  const fromTx = transactions.length === 0 ? 0 : page * rowsPerPage + 1
  const toTx = Math.min(transactions.length, (page + 1) * rowsPerPage)

  return (
    <div className="space-y-5">
      {/* Painel de partidas */}
      <div className="rounded-2xl bg-caldeira shadow-bilhete border-2 border-ferro-950 p-4 sm:p-6 text-creme-200">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 shrink-0 bg-creme-200/10 border border-creme-200/20 rounded-xl flex items-center justify-center text-2xl">
              📡
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-display font-semibold uppercase tracking-wide !text-creme-100 leading-tight">Acompanhar</h1>
              <p className="text-creme-200/70 text-sm">Pulso do sistema em tempo real</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Toggle de valores */}
            <button
              onClick={() => setShowValues(!showValues)}
              className={`!px-3 !py-1.5 flex items-center gap-2 rounded-lg border text-sm transition-all ${
                showValues 
                  ? 'bg-latao-400 border-latao-300 text-ferro-900' 
                  : 'bg-creme-200/10 border-creme-200/25 text-creme-200'
              }`}
              title={showValues ? 'Esconder valores' : 'Mostrar valores'}
            >
              <span>{showValues ? '👁️' : '🙈'}</span>
              <span className="font-display tracking-wide">{showValues ? 'R$' : '•••'}</span>
            </button>

            {/* Indicador AO VIVO com heartbeat */}
            <div className="flex items-center gap-2 px-3 py-1.5 bg-creme-200/10 rounded-lg border border-creme-200/25">
              <Heartbeat isActive={!isFetching} />
              <span className="font-display text-sm tracking-widest uppercase text-creme-100">Ao vivo</span>
            </div>
            
            {/* Contador e horário */}
            <div className="text-right font-ticket leading-tight">
              <div className="text-latao-300 text-xs tabular-nums">
                {lastUpdate.toLocaleTimeString('pt-BR')}
              </div>
              <div className="text-creme-200/60 text-xs">
                {isFetching ? (
                  <span className="text-anil-200 animate-pulse">Atualizando...</span>
                ) : (
                  `${Math.ceil(countdown)}s`
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Barra de progresso do countdown */}
        <div className="mb-4">
          <CountdownBar progress={(countdown / 5) * 100} isFetching={isFetching} />
        </div>

        {/* Abas */}
        <div className="flex gap-2 mb-4 overflow-x-auto">
          <button
            onClick={() => setActiveTab('transactions')}
            className={`!px-4 !py-2 shrink-0 flex items-center gap-2 rounded-lg font-display uppercase tracking-wide text-sm transition-all ${
              activeTab === 'transactions'
                ? 'bg-latao-400 text-ferro-900 shadow-md'
                : 'bg-creme-200/10 text-creme-200 hover:bg-creme-200/20'
            }`}
          >
            <span>Transações</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-ticket ${
              activeTab === 'transactions' ? 'bg-ferro-900 text-latao-300' : 'bg-creme-200/15'
            }`}>
              {stats.count}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('cards')}
            className={`!px-4 !py-2 shrink-0 flex items-center gap-2 rounded-lg font-display uppercase tracking-wide text-sm transition-all ${
              activeTab === 'cards'
                ? 'bg-latao-400 text-ferro-900 shadow-md'
                : 'bg-creme-200/10 text-creme-200 hover:bg-creme-200/20'
            }`}
          >
            <span>Cartões Hoje</span>
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-ticket ${
              activeTab === 'cards' ? 'bg-ferro-900 text-latao-300' : 'bg-creme-200/15'
            }`}>
              {cardStats.count}
            </span>
          </button>
        </div>

        {/* Stats - Transações */}
        {activeTab === 'transactions' && (
          <div className={`grid grid-cols-2 md:grid-cols-5 gap-2 sm:gap-3 ${isFetching ? 'opacity-80' : ''}`}>
            <BoardStat label="Transações" value={stats.count} />
            <BoardStat
              label={<>Últimos 5min{stats.last5min > 0 && <span className="w-1.5 h-1.5 bg-latao-400 rounded-full animate-pulse" />}</>}
              value={stats.last5min}
              className={stats.last5min > 0 ? 'ring-1 ring-latao-400/50' : ''}
            />
            <BoardStat label={<>Créditos <span className="text-green-400">↑</span></>} value={formatCurrency(stats.totalCredits, !showValues)} tone="text-green-400" small />
            <BoardStat label={<>Débitos <span className="text-vagao-300">↓</span></>} value={formatCurrency(stats.totalDebits, !showValues)} tone="text-vagao-300" small />
            <BoardStat
              label="Fluxo Líquido"
              value={formatCurrency(stats.netFlow, !showValues)}
              tone={stats.netFlow >= 0 ? 'text-green-400' : 'text-vagao-300'}
              small
              className="col-span-2 md:col-span-1"
            />
          </div>
        )}

        {/* Stats - Cartões Hoje */}
        {activeTab === 'cards' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
            <BoardStat label="Total" value={cardStats.count} />
            <BoardStat label="Com Saldo" value={cardStats.withBalance} tone="text-green-400" />
            <BoardStat label="Sem Saldo" value={cardStats.withoutBalance} tone="text-fumaca-200" />
            <BoardStat label="Soma Saldos" value={formatCurrency(cardStats.totalBalance, !showValues)} small />
            <BoardStat label="Média" value={formatCurrency(cardStats.avgBalance, !showValues)} small />
            <BoardStat label="Maior Saldo" value={formatCurrency(cardStats.maxBalance, !showValues)} small />
          </div>
        )}
      </div>

      {/* Lista de Cartões Hoje */}
      {activeTab === 'cards' && cardStats.count > 0 && (
        <div className="painel p-4 sm:p-6">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h3 className="font-display font-semibold uppercase tracking-wide text-ferro-800">Cartões Cadastrados Hoje</h3>
            <span className="text-sm text-ferro-500 shrink-0">{cardStats.count} cartões</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
            {todayCards.map(card => (
              <div 
                key={card.id} 
                className="flex items-center justify-between gap-2 bg-creme-100 rounded-lg px-3 py-2 text-sm border border-ferro-200"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-ticket font-bold text-ferro-500">#{card.card_number}</span>
                  <span className="text-ferro-900 truncate">{card.user_name || 'Sem nome'}</span>
                </div>
                <span className={`font-semibold tabular-nums shrink-0 ${parseFloat(card.balance) > 0 ? 'text-green-700' : 'text-fumaca-500'}`}>
                  {formatCurrency(card.balance, !showValues)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabela de transações */}
      {activeTab === 'transactions' && (
      <div className="painel overflow-hidden">
        {/* Header */}
        <div className="px-4 sm:px-6 py-3 border-b border-ferro-200 bg-creme-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display font-semibold uppercase tracking-wide text-ferro-900">
              Transações Recentes
            </h3>
            <p className="text-sm text-ferro-500">
              Atualiza automaticamente a cada 5 segundos
            </p>
          </div>
          {isFetching && !loading && (
            <div className="flex items-center gap-2 text-anil-700 shrink-0">
              <div className="w-4 h-4 border-2 border-anil-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm hidden sm:inline">Sincronizando...</span>
            </div>
          )}
        </div>

        {/* Loading state */}
        <div className="h-1 bg-creme-200 overflow-hidden">
          {isFetching && <div className="h-full w-1/3 bg-latao-500 animate-pulse" />}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="relative mb-4 mx-auto" style={{ width: 64, height: 64 }}>
                <div className="w-16 h-16 border-4 border-ferro-200 rounded-full" />
                <div className="absolute inset-0 w-16 h-16 border-4 border-ferro-700 border-t-transparent rounded-full animate-spin" />
              </div>
              <p className="text-ferro-500">Carregando transações...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-16 px-4">
            <div className="text-center">
              <div className="text-5xl mb-2">⚠️</div>
              <p className="text-vagao-600 break-words">{error}</p>
            </div>
          </div>
        ) : transactions.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <div className="text-5xl mb-2">📭</div>
              <p className="text-ferro-700">Nenhuma transação encontrada</p>
              <p className="text-sm text-ferro-400 mt-1">Aguardando atividade...</p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="bg-ferro-800 text-creme-200 font-display uppercase tracking-wider text-xs">
                    <th className="px-3 py-2.5 text-left font-semibold">Tempo</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Tipo</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Cartão</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Usuário</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Valor</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ferro-200">
                  {visibleTransactions.map((t, index) => {
                    const isNew = newTransactionIds.has(t.id)
                    const amount = parseFloat(t.amount)
                    const isCredit = t.type === 'credit'

                    return (
                      <tr
                        key={t.id}
                        className={`transition-colors duration-500 hover:bg-creme-200 ${
                          isNew ? 'bg-latao-100' : index % 2 === 0 ? 'bg-creme-50' : 'bg-creme-100'
                        }`}
                      >
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            {isNew && (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-latao-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-latao-500" />
                              </span>
                            )}
                            <span className={`font-ticket ${isNew ? 'font-bold text-latao-800' : 'text-ferro-700'}`}>
                              {timeAgo(t.created_at)}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-display uppercase tracking-wide whitespace-nowrap ${
                              isCredit ? 'border-green-600 text-green-700' : 'border-vagao-500 text-vagao-600'
                            }`}
                          >
                            {isCredit ? '↑ Crédito' : '↓ Débito'}
                          </span>
                        </td>
                        <td className="px-3 py-2">
                          <span className="inline-flex rounded-md bg-creme-200 border border-ferro-200 px-2 py-0.5 font-ticket text-xs text-ferro-800">
                            #{t.card_number || '---'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-ferro-900">
                          <div className="max-w-[150px] truncate" title={t.user_name || undefined}>
                            {t.user_name || <em className="text-ferro-400">Sem nome</em>}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`font-bold tabular-nums whitespace-nowrap ${isCredit ? 'text-green-700' : 'text-vagao-600'}`}>
                            {isCredit ? '+' : ''}{formatCurrency(amount, !showValues)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-ferro-500">
                          <div className="max-w-[200px] truncate" title={t.description}>
                            {t.description}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 px-4 py-2.5 border-t border-ferro-200 bg-creme-100 text-sm text-ferro-700">
              <div className="flex items-center gap-2">
                <span className="text-sm">Por página:</span>
                <select
                  aria-label="Linhas por página"
                  value={rowsPerPage}
                  onChange={handleChangeRowsPerPage}
                  className="!py-1 !px-2 !rounded-lg text-ferro-900"
                >
                  {[25, 50, 100].map(n => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <span className="font-ticket">{fromTx}-{toTx} de {transactions.length}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  data-btn-type="pagination"
                  onClick={() => handleChangePage(null, page - 1)}
                  disabled={page <= 0}
                  aria-label="Página anterior"
                  className="!px-3 !py-1 rounded-lg disabled:opacity-40"
                >
                  ‹
                </button>
                <button
                  type="button"
                  data-btn-type="pagination"
                  onClick={() => handleChangePage(null, page + 1)}
                  disabled={page >= totalPagesTx - 1}
                  aria-label="Próxima página"
                  className="!px-3 !py-1 rounded-lg disabled:opacity-40"
                >
                  ›
                </button>
              </div>
            </div>
          </>
        )}

        {/* Footer com status */}
        {!loading && !error && transactions.length > 0 && (
          <div className="px-4 sm:px-6 py-2.5 bg-creme-200 border-t border-ferro-200 flex items-center justify-between gap-3 text-sm text-ferro-500">
            <div className="flex items-center gap-2">
              <Heartbeat isActive={true} />
              <span>Sistema ativo</span>
            </div>
            <span>Total: {transactions.length} transações</span>
          </div>
        )}
      </div>
      )}
    </div>
  )
}

export default MonitoringPage
