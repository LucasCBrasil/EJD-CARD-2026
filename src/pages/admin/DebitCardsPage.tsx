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
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-red-200 p-8 text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h2 className="text-2xl font-bold text-red-600 mb-4">Acesso Negado</h2>
        <p className="text-gray-600">Você não tem permissão para acessar esta área.</p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-8 text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-gray-600">Carregando cartões...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-red-200 p-8 text-center">
        <div className="text-6xl mb-4">❌</div>
        <h2 className="text-2xl font-bold text-red-600 mb-4">Erro ao Carregar</h2>
        <p className="text-gray-600 mb-4">{(error as Error).message}</p>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 transition-colors font-medium"
        >
          Tentar Novamente
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-red-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <BackButton onClick={() => navigate({ to: '/admin' })} />
            <div>
              <h1 className="text-2xl font-bold text-black flex items-center gap-2">
                💳 Cartões em Débito
              </h1>
              <p className="text-sm text-gray-600">
                Cartões com saldo negativo que precisam ser regularizados
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
          >
            🔄 Atualizar
          </button>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-3xl font-bold text-red-600">{stats.totalCartoes}</div>
            <div className="text-sm text-red-700">Cartões em Débito</div>
          </div>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-600">{formatMoney(stats.totalDebito)}</div>
            <div className="text-sm text-red-700">Total a Receber</div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-orange-600">{formatMoney(stats.maiorDebito)}</div>
            <div className="text-sm text-orange-700">Maior Débito</div>
          </div>
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-yellow-600">{formatMoney(stats.mediaDebito)}</div>
            <div className="text-sm text-yellow-700">Média por Cartão</div>
          </div>
        </div>
      </div>

      {/* Lista de cartões */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
        {debitCards.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-6xl mb-4">🎉</div>
            <h3 className="text-xl font-bold text-green-600 mb-2">Nenhum cartão em débito!</h3>
            <p className="text-gray-600">Todos os cartões estão com saldo positivo ou zerado.</p>
          </div>
        ) : (
          <>
            {/* Cabeçalho da tabela */}
            <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 grid grid-cols-12 gap-4 text-sm font-semibold text-gray-600">
              <button
                onClick={() => toggleSort('number')}
                className="col-span-2 flex items-center gap-1 hover:text-gray-900 transition-colors"
              >
                Cartão
                {sortBy === 'number' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => toggleSort('name')}
                className="col-span-5 flex items-center gap-1 hover:text-gray-900 transition-colors text-left"
              >
                Nome
                {sortBy === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <button
                onClick={() => toggleSort('balance')}
                className="col-span-3 flex items-center gap-1 hover:text-gray-900 transition-colors justify-end"
              >
                Débito
                {sortBy === 'balance' && (sortOrder === 'asc' ? '↑' : '↓')}
              </button>
              <div className="col-span-2 text-right">Ação</div>
            </div>

            {/* Lista de cartões */}
            <div className="divide-y divide-gray-100">
              {sortedCards.map((card, index) => {
                const balance = parseFloat(card.balance?.toString() || '0')
                const absBalance = Math.abs(balance)
                
                return (
                  <div
                    key={card.id}
                    className={`px-4 py-4 grid grid-cols-12 gap-4 items-center hover:bg-gray-50 transition-colors ${
                      index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                    }`}
                  >
                    {/* Número do cartão */}
                    <div className="col-span-2">
                      <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-800 rounded-lg font-mono font-bold text-sm">
                        #{card.card_number}
                      </span>
                    </div>

                    {/* Nome */}
                    <div className="col-span-5">
                      <div className="font-medium text-gray-900">{card.user_name || 'Sem nome'}</div>
                      <div className="text-xs text-gray-500 flex items-center gap-2">
                        {card.is_associated ? (
                          <span className="text-green-600">✓ Associado</span>
                        ) : (
                          <span className="text-gray-400">○ Não associado</span>
                        )}
                        {card.phone_number && (
                          <span>• {card.phone_number}</span>
                        )}
                      </div>
                    </div>

                    {/* Débito */}
                    <div className="col-span-3 text-right">
                      <span className="text-lg font-bold text-red-600">
                        -{formatMoney(absBalance)}
                      </span>
                    </div>

                    {/* Ações */}
                    <div className="col-span-2 text-right">
                      <Link
                        to="/cards/add"
                        search={{ cardNumber: card.card_number }}
                        className="inline-flex items-center px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        💰 Creditar
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Rodapé */}
            <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 text-sm text-gray-600">
              <div className="flex justify-between items-center">
                <span>
                  Mostrando {sortedCards.length} cartão{sortedCards.length !== 1 ? 's' : ''} em débito
                </span>
                <span className="font-semibold text-red-600">
                  Total: {formatMoney(stats.totalDebito)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Informação adicional */}
      <div className="bg-blue-50/80 backdrop-blur-sm rounded-xl border border-blue-200 p-4">
        <h3 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
          ℹ️ Sobre os cartões em débito
        </h3>
        <ul className="text-sm text-blue-700 space-y-1">
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

