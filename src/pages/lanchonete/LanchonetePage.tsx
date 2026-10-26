import React from 'react'
import { InternalCard } from '../../components/shared'
import { usePermissions } from '../../hooks/usePermissions'
import { useSelfOrderEnabled } from '../../hooks/useLanchoneteOrders'

const LanchonetePage = () => {
  const {
    canSellLanchonete,
    canManageProductsLanchonete,
    canViewSalesHistoryLanchonete,
    canSelfOrderLanchonete,
    canManageLanchoneteOrders
  } = usePermissions()
  const { data: selfOrderEnabled = false } = useSelfOrderEnabled()

  const cards = [
    {
      icon: '🍔',
      title: 'Fazer Pedido',
      description: 'Peça seu lanche e pague com seu saldo',
      path: '/lanchonete/pedir',
      color: 'from-latao-400 to-latao-600',
      gradient: 'border-latao-300',
      canAccess: canSelfOrderLanchonete && selfOrderEnabled
    },
    {
      icon: '🎫',
      title: 'Meus Pedidos',
      description: 'Acompanhe o status dos seus pedidos',
      path: '/lanchonete/meus-pedidos',
      color: 'from-anil-600 to-anil-800',
      gradient: 'border-anil-300',
      canAccess: canSelfOrderLanchonete
    },
    {
      icon: '📥',
      title: 'Fila de Pedidos',
      description: 'Pedidos feitos pelo app para preparar e entregar',
      path: '/lanchonete/fila',
      color: 'from-vagao-500 to-vagao-700',
      gradient: 'border-vagao-300',
      canAccess: canManageLanchoneteOrders
    },
    {
      icon: '🍽️',
      title: 'Venda no Balcão',
      description: 'Registrar venda debitando a conta do cliente',
      path: '/lanchonete/select',
      color: 'from-latao-400 to-latao-600',
      gradient: 'border-latao-300',
      canAccess: canSellLanchonete
    },
    {
      icon: '📊',
      title: 'Histórico de Vendas',
      description: 'Consultar vendas realizadas',
      path: '/historico/lanchonete',
      color: 'from-anil-600 to-anil-800',
      gradient: 'border-anil-300',
      canAccess: canViewSalesHistoryLanchonete
    },
    {
      icon: '🥘',
      title: 'Cadastrar Produto',
      description: 'Adicionar novo item ao cardápio',
      path: '/lanchonete/products/create',
      color: 'from-ferro-700 to-ferro-900',
      gradient: 'border-ferro-300',
      canAccess: canManageProductsLanchonete
    },
    {
      icon: '📋',
      title: 'Listar Produtos',
      description: 'Gerenciar cardápio completo',
      path: '/lanchonete/products',
      color: 'from-vagao-500 to-vagao-700',
      gradient: 'border-vagao-300',
      canAccess: canManageProductsLanchonete
    }
  ]

  const accessibleCards = cards.filter(card => card.canAccess)

  return (
    <div className="space-y-6">
      <div className="text-center mb-8 flex flex-col items-center">
        <span className="carimbo text-latao-600 text-xs">☕ Vagão-restaurante</span>
        <h2 className="mt-3 text-3xl md:text-4xl font-display font-semibold uppercase tracking-wide text-ferro-900">
          Lanchonete
        </h2>
        <p className="text-base md:text-lg text-ferro-700 mt-1">
          Vendas, produtos e histórico da lanchonete
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

export default LanchonetePage
