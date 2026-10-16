import React from 'react'
import { InternalCard } from '../../components/shared'
import { usePermissions } from '../../hooks/usePermissions'

const AccountsPage = () => {
  const { canViewAccounts, canAddBalance } = usePermissions()

  const cards = [
    {
      icon: '💰',
      title: 'Adicionar Saldo',
      description: 'Creditar valores diretamente na conta do usuário',
      path: '/accounts/add',
      color: 'from-latao-400 to-latao-500',
      gradient: 'border-latao-300',
      canAccess: canAddBalance
    },
    {
      icon: '🔍',
      title: 'Consultar Saldo',
      description: 'Ver saldo disponível nas contas',
      path: '/accounts/balance',
      color: 'from-anil-600 to-anil-700',
      gradient: 'border-anil-300',
      canAccess: canViewAccounts
    },
    {
      icon: '💸',
      title: 'Débito Manual',
      description: 'Debitar valores diretamente das contas',
      path: '/accounts/debit',
      color: 'from-vagao-500 to-vagao-600',
      gradient: 'border-vagao-300',
      canAccess: canAddBalance
    }
  ]

  const accessibleCards = cards.filter(card => card.canAccess)

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="carimbo text-vagao-600 text-xs mb-3">Gestão de Contas</p>
        <h2 className="text-3xl md:text-4xl font-semibold text-ferro-900 mb-2 font-display uppercase tracking-wide">
          Contas e Saldos
        </h2>
        <p className="text-base md:text-lg text-ferro-700 font-body">
          Consulte e atualize os saldos associados às contas dos usuários
        </p>
        <div className="trilho w-full max-w-xs mx-auto mt-5" />
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

export default AccountsPage
