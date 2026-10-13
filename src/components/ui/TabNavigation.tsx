import React, { useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { usePermissions } from '../../hooks/usePermissions'
import { useCardByUserId } from '../../hooks/useCards'
import { useAuth } from '../../contexts/AuthContext'

interface TabNavigationProps {
  activeTab: 'cards' | 'lojinha' | 'lanchonete' | 'historicoLojinha' | 'historicoLanchonete' | 'historicoSapatinho' | 'lojinhaPedidos' | 'admin' | 'mycard' | 'sapatinho-veloz' | 'pedidos-sapatinho-veloz' | 'sapatinho-veloz-products-create' | 'sapatinho-veloz-products'
  onTabChange: (tab: 'cards' | 'lojinha' | 'lanchonete' | 'historicoLojinha' | 'historicoLanchonete' | 'historicoSapatinho' | 'lojinhaPedidos' | 'admin' | 'mycard' | 'sapatinho-veloz' | 'pedidos-sapatinho-veloz' | 'sapatinho-veloz-products-create' | 'sapatinho-veloz-products') => void
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  const router = useRouter()
  const { user } = useAuth()
  const safeNavigate = (path: string) => {
    router.navigate({ to: path as any, search: {} as any })
  }
  const { 
    userRole,
    canViewCards,
    canViewAdmin,
    canSellLojinha,
    canSellLanchonete,
    canSellSapatinho,
    canViewSalesHistoryLojinha,
    canViewSalesHistoryLanchonete,
    canViewSalesHistorySapatinho,
    canViewOpenOrders,
    canPlaceOrderSapatinho
  } = usePermissions()
  
  // Verificar se o usuário tem um cartão associado
  const { data: userCard, isLoading: isLoadingCard, refetch: refetchUserCard } = useCardByUserId(user?.id || '', !!user?.id)
  // Verificar se realmente há um cartão válido (não apenas truthy)
  const hasAssociatedCard = !isLoadingCard && !!userCard && userCard.id && userCard.card_number
  
  // Refetch quando o componente montar ou quando o usuário mudar
  useEffect(() => {
    if (user?.id) {
      refetchUserCard()
    }
  }, [user?.id, refetchUserCard])

  const tabClass = (active: boolean) =>
    `!px-5 !py-2.5 rounded-xl font-display font-medium uppercase tracking-wide text-sm transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
      active
        ? 'bg-latao-400 text-ferro-900 shadow-md'
        : 'bg-transparent text-creme-200 hover:bg-ferro-700 hover:text-creme-50'
    }`

  return (
    <div className="flex justify-center mb-8 w-full">
      <div className="bg-ferro-800 rounded-2xl p-2 shadow-bilhete border-2 border-ferro-900 w-full max-w-full overflow-x-auto">
        <div className="flex gap-2 justify-center items-center min-w-max px-2 mx-auto">
          {/* Meu Cartão - sempre visível */}
          <button
            onClick={() => onTabChange('mycard')}
            className={tabClass(activeTab === 'mycard')}
          >
            💳 Meu Cartão
          </button>
          {(userRole === 'admin' || userRole === 'comunicacao') && (
            <button
              onClick={() => onTabChange('cards')}
            className={tabClass(activeTab === 'cards')}
            >
              💳 Comunicação
            </button>
          )}
          {userRole !== 'encontrista' && canSellLojinha && (
            <button
              onClick={() => onTabChange('lojinha')}
              className={tabClass(activeTab === 'lojinha')}
            >
              🏪 Lojinha
            </button>
          )}
          {canViewSalesHistoryLojinha && (
            <button
              onClick={() => {
                onTabChange('historicoLojinha')
                safeNavigate('/historico/lojinha')}
              }
              className={tabClass(activeTab === 'historicoLojinha')}
            >
              📊 Histórico Lojinha
            </button>
          )}
          {userRole !== 'encontrista' && canSellLanchonete && (
            <button
              onClick={() => onTabChange('lanchonete')}
              className={tabClass(activeTab === 'lanchonete')}
            >
              🍔 Lanchonete
            </button>
          )}
          {canViewSalesHistoryLanchonete && (
            <button
              onClick={() => {
                onTabChange('historicoLanchonete')
                safeNavigate('/historico/lanchonete')}
              }
              className={tabClass(activeTab === 'historicoLanchonete')}
            >
              📊 Histórico Lanchonete
            </button>
          )}
          {canViewSalesHistorySapatinho && (
            <button
              onClick={() => {
                onTabChange('historicoSapatinho')
                safeNavigate('/historico/sapatinho')}
              }
              className={tabClass(activeTab === 'historicoSapatinho')}
            >
              📊 Histórico Sapatinho
            </button>
          )}
          {/* Sapatinho Veloz - visível apenas se tiver cartão associado */}
          {hasAssociatedCard && userRole === 'admin' && (
            <button
              onClick={() => safeNavigate('/sapatinho-veloz')}
              className={tabClass(activeTab === 'sapatinho-veloz')}
            >
              💌 Sapatinho Veloz
            </button>
          )}
          {/* Produtos Sapatinho - Cadastrar e Listar - APENAS admin e lojinha podem gerenciar */}
          {(userRole === 'admin' || userRole === 'lojinha') && (
            <>
              <button
                onClick={() => safeNavigate('/sapatinho-veloz/products/create')}
                className={tabClass(activeTab === 'sapatinho-veloz-products-create')}
              >
                💌 Cadastrar Itens Sapatinho
              </button>
              <button
                onClick={() => safeNavigate('/sapatinho-veloz/products')}
                className={tabClass(activeTab === 'sapatinho-veloz-products')}
              >
                📋 Listar Itens Sapatinho
              </button>
            </>
          )}
          {canViewOpenOrders && (
            <button
              onClick={() => safeNavigate('/pedidos-lojinha')}
              className={tabClass(activeTab === 'lojinhaPedidos')}
            >
              📦 Pedidos Lojinha
            </button>
          )}
          {canViewOpenOrders && hasAssociatedCard && (
            <button
              onClick={() => safeNavigate('/pedidos-sapatinho-veloz')}
              className={tabClass(activeTab === 'pedidos-sapatinho-veloz')}
            >
              📦 Pedidos Sapatinho Veloz
            </button>
          )}
          {canViewAdmin && (
            <button
              onClick={() => onTabChange('admin')}
            className={tabClass(activeTab === 'admin')}
            >
              👥 Admin
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default TabNavigation