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
  const { data: userCard, refetch: refetchUserCard } = useCardByUserId(user?.id || '', !!user?.id)
  const hasAssociatedCard = !!userCard
  
  // Refetch quando o componente montar ou quando o usuário mudar
  useEffect(() => {
    if (user?.id) {
      refetchUserCard()
    }
  }, [user?.id, refetchUserCard])

  return (
    <div className="flex justify-center mb-8 w-full">
      <div className="bg-white/95 backdrop-blur-sm rounded-xl p-2 shadow-lg border-2 border-yellow-300 w-full max-w-full overflow-x-auto">
        <div className="flex gap-2 justify-center items-center min-w-max px-2 mx-auto">
          {/* Meu Cartão - sempre visível */}
          <button
            onClick={() => onTabChange('mycard')}
            className={`px-6 py-3 rounded-lg font-bold text-base transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
              activeTab === 'mycard'
                ? 'bg-emerald-300 text-white shadow-lg'
                : 'text-gray-900 hover:bg-purple-100 bg-white border-2 border-gray-300'
            }`}
          >
            💳 Meu Cartão
          </button>
          {(userRole === 'admin' || userRole === 'comunicacao') && (
            <button
              onClick={() => onTabChange('cards')}
            className={`px-6 py-3 rounded-lg font-bold text-base transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
              activeTab === 'cards'
                ? 'bg-emerald-300 text-white shadow-lg'
                : 'text-gray-900 hover:bg-emerald-100 bg-white border-2 border-gray-300'
            }`}
            >
              💳 Comunicação
            </button>
          )}
          {userRole !== 'encontrista' && canSellLojinha && (
            <button
              onClick={() => onTabChange('lojinha')}
              className={`px-6 py-3 rounded-lg font-bold text-base transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'lojinha'
                  ? 'bg-emerald-300 text-white shadow-lg'
                  : 'text-gray-900 hover:bg-emerald-100 bg-white border-2 border-gray-300'
              }`}
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
              className={`px-6 py-3 rounded-lg font-bold text-base transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'historicoLojinha'
                  ? 'bg-emerald-300 text-white shadow-lg'
                  : 'text-gray-900 hover:bg-emerald-100 bg-white border-2 border-gray-300'
            }`}            >
              📊 Histórico Lojinha
            </button>
          )}
          {userRole !== 'encontrista' && canSellLanchonete && (
            <button
              onClick={() => onTabChange('lanchonete')}
              className={`px-6 py-3 rounded-lg font-bold text-base transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'lanchonete'
                  ? 'bg-emerald-300 text-white shadow-lg'
                  : 'text-gray-900 hover:bg-emerald-100 bg-white border-2 border-gray-300'
              }`}
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
              className={`px-6 py-3 rounded-lg font-bold text-base transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'historicoLanchonete'
                  ? 'bg-emerald-300 text-white shadow-lg'
                  : 'text-gray-900 hover:bg-emerald-100 bg-white border-2 border-gray-300'
            }`}            >
              📊 Histórico Lanchonete
            </button>
          )}
          {canViewSalesHistorySapatinho && (
            <button
              onClick={() => {
                onTabChange('historicoSapatinho')
                safeNavigate('/historico/sapatinho')}
              }
              className={`px-6 py-3 rounded-lg font-bold text-base transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'historicoSapatinho'
                  ? 'bg-emerald-300 text-white shadow-lg'
                  : 'text-gray-900 hover:bg-emerald-100 bg-white border-2 border-gray-300'
            }`}            >
              📊 Histórico Sapatinho
            </button>
          )}
          {/* Sapatinho Veloz - visível apenas se tiver cartão associado */}
          {hasAssociatedCard && (
            <button
              onClick={() => safeNavigate('/sapatinho-veloz')}
              className={`px-6 py-3 rounded-lg font-bold text-base transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'sapatinho-veloz'
                  ? 'bg-emerald-300 text-white shadow-lg'
                  : 'text-gray-900 hover:bg-emerald-100 bg-white border-2 border-gray-300'
              }`}
            >
              👠 Sapatinho velOz
            </button>
          )}
          {/* Produtos Sapatinho - Cadastrar e Listar - APENAS admin e lojinha podem gerenciar */}
          {(userRole === 'admin' || userRole === 'lojinha') && (
            <>
              <button
                onClick={() => safeNavigate('/sapatinho-veloz/products/create')}
                className={`px-6 py-3 rounded-lg font-bold text-base transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'sapatinho-veloz-products-create'
                    ? 'bg-emerald-300 text-white shadow-lg'
                    : 'text-gray-900 hover:bg-emerald-100 bg-white border-2 border-gray-300'
                }`}
              >
                👠 Cadastrar Itens Sapatinho
              </button>
              <button
                onClick={() => safeNavigate('/sapatinho-veloz/products')}
                className={`px-6 py-3 rounded-lg font-bold text-base transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                  activeTab === 'sapatinho-veloz-products'
                    ? 'bg-emerald-300 text-white shadow-lg'
                    : 'text-gray-900 hover:bg-emerald-100 bg-white border-2 border-gray-300'
                }`}
              >
                📋 Listar Itens Sapatinho
              </button>
            </>
          )}
          {canViewOpenOrders && (
            <button
              onClick={() => safeNavigate('/pedidos-lojinha')}
              className={`px-6 py-3 rounded-lg font-bold text-base transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
                activeTab === 'lojinhaPedidos'
                  ? 'bg-emerald-300 text-white shadow-lg'
                  : 'text-gray-900 hover:bg-emerald-100 bg-white border-2 border-gray-300'
            }`}            >
              📦 Pedidos Lojinha
            </button>
          )}
          {canViewOpenOrders && hasAssociatedCard && (
            <button
              onClick={() => safeNavigate('/pedidos-sapatinho-veloz')}
              className={`px-6 py-3 rounded-lg font-bold text-base transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
              activeTab === 'pedidos-sapatinho-veloz'
                ? 'bg-emerald-300 text-white shadow-lg'
                : 'text-gray-900 hover:bg-emerald-100 bg-white border-2 border-gray-300'
            }`}            >
              📦 Pedidos Sapatinho velOz
            </button>
          )}
          {canViewAdmin && (
            <button
              onClick={() => onTabChange('admin')}
            className={`px-6 py-3 rounded-lg font-bold text-base transition-all duration-200 whitespace-nowrap flex-shrink-0 ${
              activeTab === 'admin'
                ? 'bg-emerald-300 text-white shadow-lg'
                : 'text-gray-900 hover:bg-emerald-100 bg-white border-2 border-gray-300'
            }`}
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