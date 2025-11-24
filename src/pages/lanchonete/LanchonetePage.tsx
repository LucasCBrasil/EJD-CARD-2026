import React from 'react'
import { InternalCard } from '../../components/shared'
import { usePermissions } from '../../hooks/usePermissions'

const LanchonetePage = () => {
  const {
    canSellLanchonete,
    canManageProductsLanchonete,
    canViewSalesHistoryLanchonete
  } = usePermissions()

  const cards = [
    {
      icon: '🍽️',
      title: 'Realizar Venda',
      description: 'Processar vendas de lanches e bebidas',
      path: '/lanchonete/select',
      color: 'from-golden-100 to-golden-200',
      gradient: 'border-golden-300',
      canAccess: canSellLanchonete
    },
    {
      icon: '📊',
      title: 'Histórico de Vendas',
      description: 'Consultar vendas realizadas',
      path: '/historico/lanchonete',
      color: 'from-blue-100 to-blue-200',
      gradient: 'border-blue-300',
      canAccess: canViewSalesHistoryLanchonete
    },
    {
      icon: '🥘',
      title: 'Cadastrar Produto',
      description: 'Adicionar novo item ao cardápio',
      path: '/lanchonete/products/create',
      color: 'from-emerald-100 to-emerald-200',
      gradient: 'border-emerald-300',
      canAccess: canManageProductsLanchonete
    },
    {
      icon: '📋',
      title: 'Listar Produtos',
      description: 'Gerenciar cardápio completo',
      path: '/lanchonete/products',
      color: 'from-compass-100 to-compass-200',
      gradient: 'border-compass-300',
      canAccess: canManageProductsLanchonete
    }
  ]

  const accessibleCards = cards.filter(card => card.canAccess)

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl md:text-4xl font-bold text-black mb-3 font-cardinal drop-shadow-[0_2px_10px_rgba(0,0,0,0.3)]">
          🍔 Lanchonete Mágica
        </h2>
        <p className="text-lg text-gray-700 font-farmhand drop-shadow-[0_2px_8px_rgba(0,0,0,0.2)]">
          Vendas, produtos e histórico da lanchonete
        </p>
        {/* Linha decorativa */}
        <div className="flex justify-center items-center mt-4 space-x-2">
          <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-golden-400 to-transparent"></div>
          <span className="text-golden-400 text-xl">✨</span>
          <div className="w-12 h-0.5 bg-gradient-to-r from-transparent via-golden-400 to-transparent"></div>
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

export default LanchonetePage
