import React from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Card } from '../shared'
import { usePermissions } from '../../hooks/usePermissions'

const QuickAccessCards: React.FC = () => {
  const navigate = useNavigate()
  const routerState = useRouterState()
  const { 
    userRole,
    canViewCards,
    canViewAdmin,
    canSellLojinha,
    canSellLanchonete,
    canViewSalesHistoryLojinha,
    canViewSalesHistoryLanchonete,
    canViewSalesHistorySapatinho,
    canViewOpenOrders
  } = usePermissions()

  const currentPath = routerState.location.pathname

  // Não mostrar cards na página de login
  if (currentPath === '/login') {
    return null
  }

  const cards = []

  // Card: Meu Cartão (sempre visível)
  cards.push({
    title: '💳 Meu Cartão',
    description: 'Ver seu cartão e saldo',
    path: '/mycard',
    color: 'from-purple-50 to-purple-100 border-purple-200',
    buttonColor: 'bg-purple-500 hover:bg-purple-600'
  })

  // Card: Comunicação (apenas admin e comunicacao)
  if (userRole === 'admin' || userRole === 'comunicacao') {
    cards.push({
      title: '💳 Comunicação',
      description: 'Gerenciar cartões',
      path: '/cards',
      color: 'from-ferro-50 to-ferro-100 border-ferro-200',
      buttonColor: 'bg-ferro-500 hover:bg-ferro-600'
    })
  }

  // Card: Lojinha (se tiver permissão)
  if (canSellLojinha && userRole !== 'encontrista') {
    cards.push({
      title: '🏪 Lojinha',
      description: 'Realizar vendas',
      path: '/lojinha',
      color: 'from-green-50 to-green-100 border-green-200',
      buttonColor: 'bg-green-500 hover:bg-green-600'
    })
  }

  // Card: Lanchonete (se tiver permissão)
  if (canSellLanchonete && userRole !== 'encontrista') {
    cards.push({
      title: '🍔 Lanchonete',
      description: 'Realizar vendas',
      path: '/lanchonete',
      color: 'from-orange-50 to-orange-100 border-orange-200',
      buttonColor: 'bg-orange-500 hover:bg-orange-600'
    })
  }

  // Card: Histórico Lojinha (se tiver permissão)
  if (canViewSalesHistoryLojinha) {
    cards.push({
      title: '📊 Histórico Lojinha',
      description: 'Ver histórico de vendas',
      path: '/historico/lojinha',
      color: 'from-blue-50 to-blue-100 border-blue-200',
      buttonColor: 'bg-blue-500 hover:bg-blue-600'
    })
  }

  // Card: Histórico Lanchonete (se tiver permissão)
  if (canViewSalesHistoryLanchonete) {
    cards.push({
      title: '📊 Histórico Lanchonete',
      description: 'Ver histórico de vendas',
      path: '/historico/lanchonete',
      color: 'from-cyan-50 to-cyan-100 border-cyan-200',
      buttonColor: 'bg-cyan-500 hover:bg-cyan-600'
    })
  }

  // Card: Histórico Sapatinho (se tiver permissão)
  if (canViewSalesHistorySapatinho) {
    cards.push({
      title: '📊 Histórico Sapatinho',
      description: 'Ver histórico de vendas',
      path: '/historico/sapatinho',
      color: 'from-yellow-50 to-yellow-100 border-yellow-200',
      buttonColor: 'bg-yellow-500 hover:bg-yellow-600'
    })
  }

  // Card: Pedidos Lojinha (se tiver permissão)
  if (canViewOpenOrders) {
    cards.push({
      title: '📦 Pedidos Lojinha',
      description: 'Ver pedidos abertos',
      path: '/pedidos-lojinha',
      color: 'from-indigo-50 to-indigo-100 border-indigo-200',
      buttonColor: 'bg-indigo-500 hover:bg-indigo-600'
    })
  }

  // Card: Admin (se tiver permissão)
  if (canViewAdmin) {
    cards.push({
      title: '👥 Admin',
      description: 'Painel administrativo',
      path: '/admin',
      color: 'from-yellow-50 to-yellow-100 border-yellow-200',
      buttonColor: 'bg-yellow-500 hover:bg-yellow-600'
    })
  }

  if (cards.length === 0) {
    return null
  }

  return (
    <div className="mb-8">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {cards.map((card, index) => {
          const isActive = currentPath === card.path || currentPath.startsWith(card.path + '/')
          return (
            <Card
              key={index}
              className={`bg-gradient-to-br ${card.color} hover:shadow-lg transition-all duration-300 cursor-pointer ${
                isActive ? 'ring-2 ring-yellow-400 shadow-lg' : ''
              }`}
              onClick={() => navigate({ to: card.path as any })}
            >
              <div className="text-center p-4">
                <div className="text-3xl mb-2">{card.title.split(' ')[0]}</div>
                <h3 className="text-sm font-semibold text-black mb-1 font-display">
                  {card.title.substring(card.title.indexOf(' ') + 1)}
                </h3>
                <p className="text-xs text-gray-600 font-body">
                  {card.description}
                </p>
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

export default QuickAccessCards

