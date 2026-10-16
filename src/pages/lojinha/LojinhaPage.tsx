import React from 'react'
import { InternalCard } from '../../components/shared'
import { usePermissions } from '../../hooks/usePermissions'

const LojinhaPage = () => {
  const {
    canSellLojinha,
    canManageProductsLojinha,
    canViewSalesHistoryLojinha,
    canViewOpenOrders
  } = usePermissions()

  const cards = [
    {
      icon: '🛒',
      title: 'Realizar Venda',
      description: 'Processar vendas de produtos da lojinha',
      path: '/lojinha/select',
      color: 'from-vagao-500 to-vagao-700',
      gradient: 'border-vagao-300',
      canAccess: canSellLojinha
    },
    {
      icon: '📊',
      title: 'Histórico de Vendas',
      description: 'Consultar vendas realizadas',
      path: '/historico/lojinha',
      color: 'from-anil-600 to-anil-800',
      gradient: 'border-anil-300',
      canAccess: canViewSalesHistoryLojinha
    },
    {
      icon: '📦',
      title: 'Cadastrar Produto',
      description: 'Adicionar novo produto ao estoque',
      path: '/lojinha/products/create',
      color: 'from-ferro-700 to-ferro-900',
      gradient: 'border-ferro-300',
      canAccess: canManageProductsLojinha
    },
    {
      icon: '📋',
      title: 'Listar Produtos',
      description: 'Gerenciar produtos cadastrados',
      path: '/lojinha/products',
      color: 'from-latao-400 to-latao-600',
      gradient: 'border-latao-300',
      canAccess: canManageProductsLojinha
    },
    {
      icon: '📥',
      title: 'Pedidos Abertos',
      description: 'Ver pedidos pendentes de entrega',
      path: '/pedidos-lojinha',
      color: 'from-fumaca-500 to-fumaca-700',
      gradient: 'border-fumaca-300',
      canAccess: canViewOpenOrders
    }
  ]

  const accessibleCards = cards.filter(card => card.canAccess)

  return (
    <div className="space-y-6">
      <div className="text-center mb-8 flex flex-col items-center">
        <span className="carimbo text-vagao-600 text-xs">🎫 Estação</span>
        <h2 className="mt-3 text-3xl md:text-4xl font-display font-semibold uppercase tracking-wide text-ferro-900">
          Lojinha
        </h2>
        <p className="text-base md:text-lg text-ferro-700 mt-1">
          Vendas, produtos, histórico e pedidos da lojinha
        </p>
        <div className="trilho w-full max-w-xs mt-4" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {accessibleCards.map((card, index) => (
          <InternalCard
            key={card.path}
            icon={card.icon}
            title={card.title}
            description={card.description}
            path={card.path}
            color={card.color}
            gradient={card.gradient}
            index={index}
          />
        ))}
      </div>
    </div>
  )
}

export default LojinhaPage
