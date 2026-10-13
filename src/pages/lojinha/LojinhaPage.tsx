import React from 'react'
import { InternalCard } from '../../components/shared'
import { usePermissions } from '../../hooks/usePermissions'

const LojinhaPage = () => {
  const {
    userRole,
    canSellLojinha,
    canManageProductsLojinha,
    canViewSalesHistoryLojinha,
    canViewOpenOrders,
    canSellSapatinho
  } = usePermissions()

  const cards = [
    {
      icon: '🛒',
      title: 'Realizar Venda',
      description: 'Processar vendas de produtos da lojinha',
      path: '/lojinha/select',
      color: 'from-green-100 to-green-200',
      gradient: 'border-green-300',
      canAccess: canSellLojinha
    },
    {
      icon: '📊',
      title: 'Histórico de Vendas',
      description: 'Consultar vendas realizadas',
      path: '/historico/lojinha',
      color: 'from-blue-100 to-blue-200',
      gradient: 'border-blue-300',
      canAccess: canViewSalesHistoryLojinha
    },
    {
      icon: '📦',
      title: 'Cadastrar Produto',
      description: 'Adicionar novo produto ao estoque',
      path: '/lojinha/products/create',
      color: 'from-ferro-100 to-ferro-200',
      gradient: 'border-ferro-300',
      canAccess: canManageProductsLojinha
    },
    {
      icon: '📋',
      title: 'Listar Produtos',
      description: 'Gerenciar produtos cadastrados',
      path: '/lojinha/products',
      color: 'from-latao-100 to-latao-200',
      gradient: 'border-latao-300',
      canAccess: canManageProductsLojinha
    },
    {
      icon: '📥',
      title: 'Pedidos Abertos',
      description: 'Ver pedidos pendentes de entrega',
      path: '/pedidos-lojinha',
      color: 'from-anil-100 to-anil-200',
      gradient: 'border-anil-300',
      canAccess: canViewOpenOrders
    },
    {
      icon: '👠',
      title: 'Cadastrar Item Sapatinho velOz',
      description: 'Adicionar novo item do sapatinho veloz',
      path: '/sapatinho-veloz/products/create',
      color: 'from-vagao-100 to-vagao-200',
      gradient: 'border-vagao-300',
      canAccess: userRole === 'admin' || userRole === 'lojinha'
    },
    {
      icon: '📋',
      title: 'Listar Itens Sapatinho velOz',
      description: 'Gerenciar itens do sapatinho veloz',
      path: '/sapatinho-veloz/products',
      color: 'from-vagao-100 to-vagao-200',
      gradient: 'border-vagao-300',
      canAccess: userRole === 'admin' || userRole === 'lojinha'
    }
  ]

  const accessibleCards = cards.filter(card => card.canAccess)

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-black mb-3 font-display drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
          🏪 Lojinha Mágica
        </h2>
        <p className="text-lg text-gray-700 font-body drop-shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
          Vendas, produtos, histórico e pedidos da lojinha
        </p>
        {/* Linha decorativa */}
        <div className="flex justify-center items-center mt-4 space-x-2">
          <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent"></div>
          <span className="text-green-400 text-xl">✨</span>
          <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent"></div>
        </div>
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
