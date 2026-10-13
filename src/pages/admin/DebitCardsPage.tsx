import React, { useState, useMemo } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { usePermissions } from '../../hooks/usePermissions'
import { useCards } from '../../hooks/useCards'
import { LoadingSpinner, BackButton } from '../../components/shared'

interface Card {
  id: string
  card_number: string
  user_name: string
  balance: number
  phone_number?: string
  is_associated: boolean
  created_at: string
}

const DebitCardsPage: React.FC = () => {
  const navigate = useNavigate()
  const { canManageUsers } = usePermissions()
  const { data: allCards, isLoading, error, refetch } = useCards()
  const [sortBy, setSortBy] = useState<'balance' | 'name' | 'number'>('balance')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')

  // Filtrar apenas cartões com saldo negativo
  const debitCards = useMemo(() => {
    if (!allCards) return []
    return (allCards as Card[]).filter(card => parseFloat(card.balance?.toString() || '0') < 0)
  }, [allCards])

  // Ordenar cartões
  const sortedCards = useMemo(() => {
    const sorted = [...debitCards].sort((a, b) => {
      let comparison = 0
      switch (sortBy) {
        case 'balance':
          comparison = parseFloat(a.balance?.toString() || '0') - parseFloat(b.balance?.toString() || '0')
          break
        case 'name':
          comparison = (a.user_name || '').localeCompare(b.user_name || '')
          break
        case 'number':
          comparison = (a.card_number || '').localeCompare(b.card_number || '')
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
      totalCartoes: debitCards.length,
      totalDebito,
      maiorDebito,
      mediaDebito
    }
  }, [debitCards])

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  const toggleSort = (field: 'balance' | 'name' | 'number') => {
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
        <p className="mt-4 text-ferro-500">Carregando cartões...</p>
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
                Cartões em Débito
              </h1>
              <p className="text-sm text-ferro-500">
                Cartões com saldo negativo que precisam ser regularizados
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
            <div className="text-3xl font-slab text-vagao-600 tabular-nums">{stats.totalCartoes}</div>
            <div className="text-xs font-display uppercase tracking-wider text-ferro-500 mt-1">Cartões em Débito</div>
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
            <div className="text-xs font-display uppercase tracking-wider text-ferro-500 mt-1">Média por Cartão</div>
          </div>
        </div>
      </div>

      {/* Lista de cartões */}
      <div className="painel overflow-hidden">
        {debitCards.length === 0 ? (
          <div className="p-10 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h3 className="text-xl font-display font-semibold uppercase text-green-700 mb-2">Nenhum cartão em débito!</h3>
            <p className="text-ferro-500">Todos os cartões estão com saldo positivo ou zerado.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                {/* Cabeçalho da tabela */}
                <div className="bg-ferro-800 text-creme-200 px-4 py-2.5 grid grid-cols-12 gap-3 text-xs font-display uppercase tracking-wider">
                  <button
                    onClick={() => toggleSort('number')}
                    className="!p-0 col-span-2 flex items-center gap-1 text-xs font-display uppercase tracking-wider text-creme-200 hover:text-latao-300 transition-colors"
                  >
                    Cartão
                    {sortBy === 'number' && (sortOrder === 'asc' ? '↑' : '↓')}
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

                {/* Lista de cartões */}
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
                        {/* Número do cartão */}
                        <div className="col-span-2">
                          <span className="inline-flex items-center px-2 py-1 bg-creme-200 border border-ferro-200 text-ferro-800 rounded-md font-ticket font-bold text-sm">
                            #{card.card_number}
                          </span>
                        </div>

                        {/* Nome */}
                        <div className="col-span-5 min-w-0">
                          <div className="font-medium text-ferro-900 truncate">{card.user_name || 'Sem nome'}</div>
                          <div className="text-xs text-ferro-500 flex flex-wrap items-center gap-x-2">
                            {card.is_associated ? (
                              <span className="text-green-700">✓ Associado</span>
                            ) : (
                              <span className="text-fumaca-500">○ Não associado</span>
                            )}
                            {card.phone_number && (
                              <span>• {card.phone_number}</span>
                            )}
                          </div>
                        </div>

                        {/* Débito */}
                        <div className="col-span-3 text-right">
                          <span className="font-slab text-vagao-600 tabular-nums whitespace-nowrap">
                            -{formatMoney(absBalance)}
                          </span>
                        </div>

                        {/* Ações */}
                        <div className="col-span-2 text-right">
                          <Link
                            to="/cards/add"
                            search={{ cardNumber: card.card_number }}
                            className="inline-flex items-center px-3 py-1.5 bg-ferro-800 hover:bg-ferro-700 text-creme-200 rounded-lg text-xs font-display uppercase tracking-wide transition-colors whitespace-nowrap"
                          >
                            Creditar
                          </Link>
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
                  Mostrando {sortedCards.length} cartão{sortedCards.length !== 1 ? 's' : ''} em débito
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
          ℹ️ Sobre os cartões em débito
        </h3>
        <ul className="text-sm text-anil-800 space-y-1">
          <li>• Estes cartões receberam R$100 de crédito emprestado no início do encontro</li>
          <li>• O saldo negativo representa o valor gasto que precisa ser quitado</li>
          <li>• Para regularizar, a pessoa deve adicionar crédito via PIX ou com a coordenação</li>
          <li>• Cartões em débito não podem realizar novas compras até regularização</li>
        </ul>
      </div>
    </div>
  )
}

export default DebitCardsPage

