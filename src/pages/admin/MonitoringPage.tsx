import React, { useEffect, useState, useRef, useMemo } from 'react'
import { usePermissions } from '../../hooks/usePermissions'
import { api } from '../../lib/api-client'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  Box,
  Chip,
  LinearProgress,
  Typography,
} from '@mui/material'

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
    <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-emerald-400'}`}>
      {isActive && (
        <>
          <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
          <span className="absolute inset-0 rounded-full bg-emerald-300 animate-pulse" />
        </>
      )}
    </div>
  </div>
)

// Componente de barra de progresso para countdown
const CountdownBar: React.FC<{ progress: number; isFetching: boolean }> = ({ progress, isFetching }) => (
  <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
    <div 
      className={`h-full transition-all duration-200 ${isFetching ? 'bg-cyan-500 animate-pulse' : 'bg-emerald-500'}`}
      style={{ width: `${progress}%` }}
    />
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

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  // Transações visíveis na página atual
  const visibleTransactions = useMemo(() => {
    return transactions.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
  }, [transactions, page, rowsPerPage])

  if (!canManageUsers) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-red-200 p-8 text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h2 className="text-2xl font-bold text-red-600 mb-4">Acesso Negado</h2>
        <p className="text-gray-600">Você não tem permissão para acessar esta área.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-emerald-200 p-6 relative overflow-hidden">
        {/* Efeito de onda sutil no fundo */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-emerald-100/50 to-transparent rounded-full animate-pulse" style={{ animationDuration: '3s' }} />
          <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-cyan-100/50 to-transparent rounded-full animate-pulse" style={{ animationDuration: '4s', animationDelay: '1s' }} />
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center relative">
                <span className="text-2xl">📡</span>
                {/* Ondas de sinal */}
                <div className="absolute -right-1 -top-1">
                  <div className="flex gap-0.5">
                    <div className="w-1 h-2 bg-emerald-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 h-3 bg-emerald-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                    <div className="w-1 h-4 bg-emerald-600 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Acompanhar</h1>
                <p className="text-slate-500 text-sm">Pulso do sistema em tempo real</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Toggle de valores */}
              <button
                onClick={() => setShowValues(!showValues)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${
                  showValues 
                    ? 'bg-amber-100 border-amber-300 text-amber-700' 
                    : 'bg-slate-100 border-slate-300 text-slate-600'
                }`}
                title={showValues ? 'Esconder valores' : 'Mostrar valores'}
              >
                <span>{showValues ? '👁️' : '🙈'}</span>
                <span className="text-sm font-medium">{showValues ? 'R$' : '•••'}</span>
              </button>

              {/* Indicador LIVE com heartbeat */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 rounded-lg border border-emerald-300">
                <Heartbeat isActive={!isFetching} />
                <span className="text-emerald-700 text-sm font-medium">LIVE</span>
              </div>
              
              {/* Contador e horário */}
              <div className="text-right">
                <div className="text-slate-500 text-xs">
                  {lastUpdate.toLocaleTimeString('pt-BR')}
                </div>
                <div className="text-slate-400 text-xs">
                  {isFetching ? (
                    <span className="text-cyan-600 animate-pulse">Atualizando...</span>
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
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('transactions')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'transactions'
                  ? 'bg-emerald-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>📊</span>
              <span>Transações</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === 'transactions' ? 'bg-emerald-600' : 'bg-slate-200'
              }`}>
                {stats.count}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('cards')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === 'cards'
                  ? 'bg-amber-500 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>💳</span>
              <span>Cartões Hoje</span>
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === 'cards' ? 'bg-amber-600' : 'bg-slate-200'
              }`}>
                {cardStats.count}
              </span>
            </button>
          </div>

          {/* Stats Cards - Transações */}
          {activeTab === 'transactions' && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className={`bg-slate-50 rounded-xl p-4 border border-slate-200 transition-all duration-300 ${isFetching ? 'opacity-70' : ''}`}>
                <div className="text-slate-500 text-xs uppercase tracking-wide mb-1">Transações</div>
                <div className="text-2xl font-bold text-slate-800 tabular-nums">{stats.count}</div>
              </div>
              <div className={`bg-cyan-50 rounded-xl p-4 border border-cyan-200 transition-all duration-300 ${isFetching ? 'opacity-70' : ''} ${stats.last5min > 0 ? 'ring-2 ring-cyan-300 ring-opacity-50' : ''}`}>
                <div className="text-slate-500 text-xs uppercase tracking-wide mb-1 flex items-center gap-1">
                  Últimos 5min
                  {stats.last5min > 0 && <span className="w-1.5 h-1.5 bg-cyan-500 rounded-full animate-pulse" />}
                </div>
                <div className="text-2xl font-bold text-cyan-600 tabular-nums">{stats.last5min}</div>
              </div>
              <div className={`bg-emerald-50 rounded-xl p-4 border border-emerald-200 transition-all duration-300 ${isFetching ? 'opacity-70' : ''}`}>
                <div className="text-slate-500 text-xs uppercase tracking-wide mb-1 flex items-center gap-1">
                  Créditos
                  <span className="text-emerald-500">↑</span>
                </div>
                <div className="text-xl font-bold text-emerald-600 tabular-nums">{formatCurrency(stats.totalCredits, !showValues)}</div>
              </div>
              <div className={`bg-rose-50 rounded-xl p-4 border border-rose-200 transition-all duration-300 ${isFetching ? 'opacity-70' : ''}`}>
                <div className="text-slate-500 text-xs uppercase tracking-wide mb-1 flex items-center gap-1">
                  Débitos
                  <span className="text-rose-500">↓</span>
                </div>
                <div className="text-xl font-bold text-rose-600 tabular-nums">{formatCurrency(stats.totalDebits, !showValues)}</div>
              </div>
              <div className={`rounded-xl p-4 border transition-all duration-300 ${isFetching ? 'opacity-70' : ''} ${stats.netFlow >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                <div className="text-slate-500 text-xs uppercase tracking-wide mb-1">Fluxo Líquido</div>
                <div className={`text-xl font-bold tabular-nums ${stats.netFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {formatCurrency(stats.netFlow, !showValues)}
                </div>
              </div>
            </div>
          )}

          {/* Stats Cards - Cartões Hoje */}
          {activeTab === 'cards' && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <div className="text-slate-500 text-xs uppercase tracking-wide mb-1">Total</div>
                <div className="text-2xl font-bold text-amber-600 tabular-nums">{cardStats.count}</div>
              </div>
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200">
                <div className="text-slate-500 text-xs uppercase tracking-wide mb-1">Com Saldo</div>
                <div className="text-2xl font-bold text-emerald-600 tabular-nums">{cardStats.withBalance}</div>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="text-slate-500 text-xs uppercase tracking-wide mb-1">Sem Saldo</div>
                <div className="text-2xl font-bold text-slate-600 tabular-nums">{cardStats.withoutBalance}</div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
                <div className="text-slate-500 text-xs uppercase tracking-wide mb-1">Soma Saldos</div>
                <div className="text-lg font-bold text-blue-600 tabular-nums">{formatCurrency(cardStats.totalBalance, !showValues)}</div>
              </div>
              <div className="bg-purple-50 rounded-xl p-4 border border-purple-200">
                <div className="text-slate-500 text-xs uppercase tracking-wide mb-1">Média</div>
                <div className="text-lg font-bold text-purple-600 tabular-nums">{formatCurrency(cardStats.avgBalance, !showValues)}</div>
              </div>
              <div className="bg-cyan-50 rounded-xl p-4 border border-cyan-200">
                <div className="text-slate-500 text-xs uppercase tracking-wide mb-1">Maior Saldo</div>
                <div className="text-lg font-bold text-cyan-600 tabular-nums">{formatCurrency(cardStats.maxBalance, !showValues)}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Lista de Cartões Hoje */}
      {activeTab === 'cards' && cardStats.count > 0 && (
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl border border-amber-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-800">Lista de Cartões Cadastrados Hoje</h3>
            <span className="text-sm text-slate-500">{cardStats.count} cartões</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-96 overflow-y-auto">
            {todayCards.map(card => (
              <div 
                key={card.id} 
                className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 text-sm border border-slate-100"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-slate-400">#{card.card_number}</span>
                  <span className="text-slate-700 truncate">{card.user_name || 'Sem nome'}</span>
                </div>
                <span className={`font-medium tabular-nums ${parseFloat(card.balance) > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>
                  {formatCurrency(card.balance, !showValues)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transactions Table with MUI */}
      {activeTab === 'transactions' && (
      <Paper 
        elevation={0}
        sx={{ 
          borderRadius: 4, 
          overflow: 'hidden',
          border: '1px solid',
          borderColor: 'grey.200',
          bgcolor: 'rgba(255,255,255,0.9)',
          backdropFilter: 'blur(8px)'
        }}
      >
        {/* Header */}
        <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'grey.200', bgcolor: 'grey.50' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6" fontWeight={600} color="text.primary">
                Transações Recentes
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Atualiza automaticamente a cada 5 segundos
              </Typography>
            </Box>
            {isFetching && !loading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'info.main' }}>
                <div className="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <Typography variant="body2">Sincronizando...</Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Loading state */}
        {isFetching && <LinearProgress color="success" />}

        {loading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 10 }}>
            <Box sx={{ textAlign: 'center' }}>
              <div className="relative mb-4 mx-auto" style={{ width: 64, height: 64 }}>
                <div className="w-16 h-16 border-4 border-emerald-200 rounded-full" />
                <div className="absolute inset-0 w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              </div>
              <Typography color="text.secondary">Carregando transações...</Typography>
              <div className="flex gap-1 justify-center mt-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-emerald-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </Box>
          </Box>
        ) : error ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 10 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h2" sx={{ mb: 1 }}>⚠️</Typography>
              <Typography color="error">{error}</Typography>
            </Box>
          </Box>
        ) : transactions.length === 0 ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', py: 10 }}>
            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="h2" sx={{ mb: 1 }}>📭</Typography>
              <Typography color="text.secondary">Nenhuma transação encontrada</Typography>
              <Typography variant="body2" color="text.disabled" sx={{ mt: 0.5 }}>
                Aguardando atividade...
              </Typography>
            </Box>
          </Box>
        ) : (
          <>
            <TableContainer>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Tempo</TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Tipo</TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Cartão</TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Usuário</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Valor</TableCell>
                    <TableCell sx={{ fontWeight: 600, bgcolor: 'grey.100' }}>Descrição</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleTransactions.map((t) => {
                    const isNew = newTransactionIds.has(t.id)
                    const amount = parseFloat(t.amount)
                    const isCredit = t.type === 'credit'

                    return (
                      <TableRow 
                        key={t.id}
                        hover
                        sx={{
                          bgcolor: isNew ? 'success.light' : 'inherit',
                          transition: 'background-color 0.5s',
                          '&:hover': {
                            bgcolor: isNew ? 'success.light' : 'action.hover'
                          }
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {isNew && (
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                              </span>
                            )}
                            <Typography 
                              variant="body2" 
                              fontWeight={isNew ? 600 : 400}
                              color={isNew ? 'success.dark' : 'text.primary'}
                            >
                              {timeAgo(t.created_at)}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={isCredit ? '↑ Crédito' : '↓ Débito'}
                            color={isCredit ? 'success' : 'error'}
                            variant="outlined"
                            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            label={`#${t.card_number || '---'}`}
                            variant="filled"
                            sx={{ 
                              bgcolor: 'grey.100', 
                              fontFamily: 'monospace',
                              fontSize: '0.75rem'
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography 
                            variant="body2" 
                            sx={{ 
                              maxWidth: 150, 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap' 
                            }}
                            title={t.user_name || undefined}
                          >
                            {t.user_name || <em style={{ color: '#9ca3af' }}>Sem nome</em>}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography 
                            variant="body2" 
                            fontWeight={700}
                            color={isCredit ? 'success.main' : 'error.main'}
                            sx={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {isCredit ? '+' : ''}{formatCurrency(amount, !showValues)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography 
                            variant="body2" 
                            color="text.secondary"
                            sx={{ 
                              maxWidth: 200, 
                              overflow: 'hidden', 
                              textOverflow: 'ellipsis', 
                              whiteSpace: 'nowrap' 
                            }}
                            title={t.description}
                          >
                            {t.description}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Pagination */}
            <TablePagination
              component="div"
              count={transactions.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[25, 50, 100]}
              labelRowsPerPage="Por página:"
              labelDisplayedRows={({ from, to, count }) => `${from}-${to} de ${count}`}
              sx={{
                borderTop: 1,
                borderColor: 'grey.200',
                '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': {
                  fontSize: '0.875rem'
                }
              }}
            />
          </>
        )}

        {/* Footer com status */}
        {!loading && !error && transactions.length > 0 && (
          <Box 
            sx={{ 
              px: 3, 
              py: 1.5, 
              bgcolor: 'grey.50', 
              borderTop: 1, 
              borderColor: 'grey.200',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Heartbeat isActive={true} />
              <Typography variant="body2" color="text.secondary">Sistema ativo</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              Total: {transactions.length} transações
            </Typography>
          </Box>
        )}
      </Paper>
      )}
    </div>
  )
}

export default MonitoringPage
