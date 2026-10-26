import React from 'react'
import { useRouter } from '@tanstack/react-router'
import { usePermissions } from '../../hooks/usePermissions'

interface TabNavigationProps {
  activeTab: 'account' | 'accounts' | 'lojinha' | 'lanchonete' | 'historicoLojinha' | 'historicoLanchonete' | 'lojinhaPedidos' | 'admin' | 'mycard'
  onTabChange: (tab: 'account' | 'accounts' | 'lojinha' | 'lanchonete' | 'historicoLojinha' | 'historicoLanchonete' | 'lojinhaPedidos' | 'admin' | 'mycard') => void
}

const TabNavigation: React.FC<TabNavigationProps> = ({ activeTab, onTabChange }) => {
  const router = useRouter()
  const safeNavigate = (path: string) => {
    router.navigate({ to: path as any, search: {} as any })
  }
  const { 
    userRole,
    canViewAdmin,
    canSellLojinha,
    canSellLanchonete,
    canViewSalesHistoryLojinha,
    canViewSalesHistoryLanchonete,
    canViewOpenOrders,
  } = usePermissions()
  
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
          {/* Minha Conta - sempre visível */}
          <button
            onClick={() => onTabChange('account')}
            className={tabClass(activeTab === 'account')}
          >
            👤 Minha Conta
          </button>
          {(userRole === 'admin' || userRole === 'comunicacao') && (
            <button
              onClick={() => onTabChange('accounts')}
            className={tabClass(activeTab === 'accounts')}
            >
              💰 Contas e Saldos
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
          (
            <button
              onClick={() => onTabChange('lanchonete')}
              className={tabClass(activeTab === 'lanchonete')}
            >
              🍔 Lanchonete
            </button>
          )
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
          {canViewOpenOrders && (
            <button
              onClick={() => safeNavigate('/pedidos-lojinha')}
              className={tabClass(activeTab === 'lojinhaPedidos')}
            >
              📦 Pedidos Lojinha
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