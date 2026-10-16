import React, { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { usePermissions } from '../../hooks/usePermissions'
import { useAccounts } from '../../hooks/useAccounts'
import { LoadingSpinner, BackButton } from '../../components/shared'

interface Account {
  id: string
  email: string
  name: string
  balance: number
}

const DebitCardsPage: React.FC = () => {
  const navigate = useNavigate()
  const { canManageUsers } = usePermissions()
  const { data: allAccounts, isLoading, error, refetch } = useAccounts()
  const [sortBy, setSortBy] = useState<'balance' | 'name' | 'email'>('balance')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Filtrar apenas contas com saldo negativo.
  const debitCards = useMemo(() => {
    if (!allAccounts) return []
    return (allAccounts as Account[]).filter(account => account.balance < 0)
  }, [allAccounts])

  // Ordenar contas.
  const sortedCards = useMemo(() => {
    const sorted = [...debitCards].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'balance':
          comparison = parseFloat(a.balance?.toString() || '0') - parseFloat(b.balance?.toString() || '0')
          break
        case 'name':
          comparison = (a.name || '').localeCompare(b.name || '')
          break
        case 'email':
          comparison = (a.email || '').localeCompare(b.email || '')
          break
      }
      return sortOrder === 'asc' ? comparison : -comparison
    })
    return sorted
  }, [debitCards, sortBy, sortOrder])

  // Estatísticas
  const stats = useMemo(() => {
    const totalDebito = debitCards.reduce((sum, card) => sum + Math.abs(parseFloat(card.balance?.toString() || '0')), 0)
    const maiorDebito = debitCards.length > 0 
      ? Math.abs(Math.min(...debitCards.map(c => parseFloat(c.balance?.toString() || '0'))))
      : 0
    const mediaDebito = debitCards.length > 0 ? totalDebito / debitCards.length : 0
    
    return {
      totalContas: debitCards.length,
      totalDebito,
      maiorDebito,
      mediaDebito
    }
  }, [debitCards])

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const toggleSort = (field: 'balance' | 'name' | 'email') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder(field === 'balance' ? 'asc' : 'asc')
    }
  }

  if (!canManageUsers) {
    return (
      <div className="painel border-2 !border-vagao-600/40 p-6 sm:p-8 text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h2 className="text-2xl font-display font-semibold uppercase text-vagao-600 mb-3">Acesso Negado</h2>
        <p className="text-ferro-700">Você não tem permissão para acessar esta área.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="painel p-8 text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-ferro-500">Carregando contas...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="painel border-2 !border-vagao-600/40 p-6 sm:p-8 text-center">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-2xl font-display font-semibold uppercase text-vagao-600 mb-3">Erro ao Carregar</h2>
        <p className="text-ferro-700 mb-5 break-words">{(error as Error).message}</p>
        <button
          onClick={() => refetch()}
          className="!px-5 !py-2.5 bg-vagao-600 hover:bg-vagao-700 text-creme-50 rounded-xl font-display uppercase tracking-wide transition-colors"
        >
          Tentar Novamente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="painel text-ferro-900 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <BackButton onClick={() => navigate({ to: '/admin' })} />
            <div className="min-w-0">
              <h1 className="text-2xl font-display font-semibold uppercase text-ferro-900 leading-tight">
                Contas com Saldo Negativo
              </h1>
              <p className="text-sm text-ferro-500">
                Contas com saldo negativo que precisam ser regularizadas
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            aria-label="Atualizar"
            className="!px-3 !py-2 shrink-0 bg-creme-200 hover:bg-creme-300 text-ferro-800 border border-ferro-200 rounded-xl transition-colors text-sm font-display uppercase tracking-wide flex items-center gap-2"
          >
            <span aria-hidden>↻</span>
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-creme-100 border border-ferro-200 rounded-xl p-3 sm:p-4 text-center">
            <div className="text-3xl font-slab text-vagao-600 tabular-nums">{stats.totalContas}</div>
            <div className="text-xs font-display uppercase tracking-wider text-ferro-500 mt-1">Contas em Débito</div>
          </div>
          <div className="bg-creme-100 border border-ferro-200 rounded-xl p-3 sm:p-4 text-center">
            <div className="text-lg sm:text-xl font-slab text-vagao-600 tabular-nums break-words">{formatMoney(stats.totalDebito)}</div>
            <div className="text-xs font-display uppercase tracking-wider text-ferro-500 mt-1">Total a Receber</div>
          </div>
          <div className="bg-creme-100 border border-ferro-200 rounded-xl p-3 sm:p-4 text-center">
            <div className="text-lg sm:text-xl font-slab text-latao-700 tabular-nums break-words">{formatMoney(stats.maiorDebito)}</div>
            <div className="text-xs font-display uppercase tracking-wider text-ferro-500 mt-1">Maior Débito</div>
          </div>
          <div className="bg-creme-100 border border-ferro-200 rounded-xl p-3 sm:p-4 text-center">
            <div className="text-lg sm:text-xl font-slab text-ferro-700 tabular-nums break-words">{formatMoney(stats.mediaDebito)}</div>
            <div className="text-xs font-display uppercase tracking-wider text-ferro-500 mt-1">Média por Conta</div>
          </div>
        </div>
      </div>

      {/* Lista de contas */}
      <div className="painel overflow-hidden">
        {debitCards.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-xl font-display font-semibold uppercase text-green-700 mb-2">Nenhuma conta em débito!</h3>
            <p className="text-ferro-500">Todas as contas estão com saldo positivo ou zerado.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                {/* Cabeçalho da tabela */}
                <div className="bg-ferro-800 text-creme-200 px-4 py-2.5 grid grid-cols-12 gap-3 text-xs font-display uppercase tracking-wider">
                  <button
                    onClick={() => toggleSort('email')}
                    className="!p-0 col-span-2 flex items-center gap-1 text-xs font-display uppercase tracking-wider text-creme-200 hover:text-latao-300 transition-colors"
                  >
                    Email
                    {sortBy === 'email' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                  <button
                    onClick={() => toggleSort('name')}
                    className="!p-0 col-span-5 flex items-center gap-1 text-xs font-display uppercase tracking-wider text-creme-200 hover:text-latao-300 transition-colors text-left"
                  >
                    Nome
                    {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                  <button
                    onClick={() => toggleSort('balance')}
                    className="!p-0 col-span-3 flex items-center gap-1 text-xs font-display uppercase tracking-wider text-creme-200 hover:text-latao-300 transition-colors justify-end"
                  >
                    Débito
                    {sortBy === 'balance' && (sortOrder === 'asc' ? '↑' : '↓')}
                  </button>
                  <div className="col-span-2 text-right">Ação</div>
                </div>

                {/* Lista de contas */}
                <div className="divide-y divide-ferro-200">
                  {sortedCards.map((card, index) => {
                    const balance = parseFloat(card.balance?.toString() || '0')
                    const absBalance = Math.abs(balance)
                    
                    return (
                      <div
                        key={card.id}
                        className={`px-4 py-3 grid grid-cols-12 gap-3 items-center hover:bg-creme-200 transition-colors ${
                          index % 2 === 0 ? 'bg-creme-50' : 'bg-creme-100'
                        }`}
                      >
                        {/* Identificação da conta */}
                        <div className="col-span-2">
                          <span className="text-xs text-ferro-700 break-all">{card.email}</span>
                        </div>

                        {/* Nome */}
                        <div className="col-span-5 min-w-0">
                          <div className="font-medium text-ferro-900 truncate">{card.name || 'Sem nome'}</div>
                        </div>

                        {/* Débito */}
                        <div className="col-span-3 text-right">
                          <span className="font-slab text-vagao-600 tabular-nums whitespace-nowrap">
                            -{formatMoney(absBalance)}
                          </span>
                        </div>

                        {/* Ações */}
                        <div className="col-span-2 text-right">
                          <button
                            onClick={() => navigate({ to: '/accounts/add' })}
                            className="inline-flex items-center px-3 py-1.5 bg-ferro-800 hover:bg-ferro-700 text-creme-200 rounded-lg text-xs font-display uppercase tracking-wide transition-colors whitespace-nowrap"
                          >
                            Creditar
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Rodapé */}
            <div className="bg-creme-200 border-t border-ferro-200 px-4 py-3 text-sm text-ferro-700">
              <div className="flex flex-wrap justify-between items-center gap-2">
                <span>
                  Mostrando {sortedCards.length} conta{sortedCards.length !== 1 ? 's' : ''} em débito
                </span>
                <span className="font-slab text-vagao-600">
                  Total: {formatMoney(stats.totalDebito)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Informação adicional */}
      <div className="rounded-xl border border-anil-200 bg-anil-100/60 p-4">
        <h3 className="font-display font-semibold uppercase tracking-wide text-anil-800 mb-2 flex items-center gap-2">
          ℹ️ Sobre contas com saldo negativo
        </h3>
        <ul className="text-sm text-anil-800 space-y-1">
          <li>• O saldo negativo representa valores usados e que precisam ser regularizados</li>
          <li>• O saldo negativo representa o valor gasto que precisa ser quitado</li>
          <li>• Para regularizar, a pessoa deve adicionar crédito via PIX ou com a coordenação</li>
          <li>• Contas com saldo negativo não podem realizar novas compras até regularização</li>
        </ul>
      </div>
    </div>
  )
}

export default DebitCardsPage
