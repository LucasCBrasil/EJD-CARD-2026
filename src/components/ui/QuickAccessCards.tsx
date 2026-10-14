import React from 'react'
import { useNavigate, useRouterState } from '@tanstack/react-router'
import { Card } from '../shared'
import { usePermissions } from '../../hooks/usePermissions'

const QuickAccessCards: React.FC = () => {
  const navigate = useNavigate()
  const routerState = useRouterState()
  const { 
    userRole,
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

  // Conta pessoal (sempre visível)
  cards.push({
    title: '👤 Minha Conta',
    description: 'Ver seu saldo e histórico',
    path: '/account',
    color: 'bg-anil-700',
    buttonColor: 'bg-anil-700 hover:bg-anil-800'
  })

  // Gestão de contas (apenas admin e comunicação)
  if (userRole === 'admin' || userRole === 'comunicacao') {
    cards.push({
      title: '💰 Contas e Saldos',
      description: 'Gerenciar saldos de usuários',
      path: '/accounts',
      color: 'bg-ferro-800',
      buttonColor: 'bg-ferro-800 hover:bg-ferro-700'
    })
  }

  // Card: Lojinha (se tiver permissão)
  if (canSellLojinha && userRole !== 'encontrista') {
    cards.push({
      title: '🏪 Lojinha',
      description: 'Realizar vendas',
      path: '/lojinha',
      color: 'bg-vagao-600',
      buttonColor: 'bg-vagao-600 hover:bg-vagao-700'
    })
  }

  // Card: Lanchonete (se tiver permissão)
  if (canSellLanchonete && userRole !== 'encontrista') {
    cards.push({
      title: '🍔 Lanchonete',
      description: 'Realizar vendas',
      path: '/lanchonete',
      color: 'bg-latao-500',
      buttonColor: 'bg-latao-500 hover:bg-latao-600'
    })
  }

  // Card: Histórico Lojinha (se tiver permissão)
  if (canViewSalesHistoryLojinha) {
    cards.push({
      title: '📊 Histórico Lojinha',
      description: 'Ver histórico de vendas',
      path: '/historico/lojinha',
      color: 'bg-vagao-500',
      buttonColor: 'bg-vagao-500 hover:bg-vagao-600'
    })
  }

  // Card: Histórico Lanchonete (se tiver permissão)
  if (canViewSalesHistoryLanchonete) {
    cards.push({
      title: '📊 Histórico Lanchonete',
      description: 'Ver histórico de vendas',
      path: '/historico/lanchonete',
      color: 'bg-latao-600',
      buttonColor: 'bg-latao-600 hover:bg-latao-700'
    })
  }

  // Card: Histórico Sapatinho (se tiver permissão)
  if (canViewSalesHistorySapatinho) {
    cards.push({
      title: '💌 Histórico Sapatinho',
      description: 'Ver histórico de vendas',
      path: '/historico/sapatinho',
      color: 'bg-ferro-500',
      buttonColor: 'bg-ferro-500 hover:bg-ferro-600'
    })
  }

  // Card: Pedidos Lojinha (se tiver permissão)
  if (canViewOpenOrders) {
    cards.push({
      title: '📦 Pedidos Lojinha',
      description: 'Ver pedidos abertos',
      path: '/pedidos-lojinha',
      color: 'bg-vagao-700',
      buttonColor: 'bg-vagao-700 hover:bg-vagao-800'
    })
  }

  // Card: Admin (se tiver permissão)
  if (canViewAdmin) {
    cards.push({
      title: '👥 Admin',
      description: 'Painel administrativo',
      path: '/admin',
      color: 'bg-fumaca-600',
      buttonColor: 'bg-fumaca-600 hover:bg-fumaca-700'
    })
  }

  if (cards.length === 0) {
    return null
  }

  return (
    <div className="mb-8">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
        {cards.map((card, index) => {
          const isActive = currentPath === card.path || currentPath.startsWith(card.path + '/')
          return (
            <Card
              key={index}
              className={`!p-0 overflow-hidden hover:-translate-y-0.5 hover:shadow-bilhete-hover transition-all duration-300 cursor-pointer ${
                isActive ? 'ring-2 ring-latao-400 shadow-bilhete' : ''
              }`}
              onClick={() => navigate({ to: card.path as any })}
            >
              <div className={`h-1.5 ${card.color}`} />
              <div className="text-center p-3 sm:p-4">
                <div className="text-3xl mb-2">{card.title.split(' ')[0]}</div>
                <h3 className="text-sm font-semibold text-ferro-900 uppercase tracking-wide mb-1 font-display">
                  {card.title.substring(card.title.indexOf(' ') + 1)}
                </h3>
                <p className="text-xs text-ferro-600 font-body">
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
