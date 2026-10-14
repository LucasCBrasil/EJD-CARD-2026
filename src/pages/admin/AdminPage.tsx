import React from 'react'
import { Link } from '@tanstack/react-router'
import { useAuth } from '../../contexts/AuthContext'
import { usePermissions } from '../../hooks/usePermissions'
import UserManagement from './UserManagement'
import FeatureFlagsManagement from './FeatureFlagsManagement'

const AdminPage: React.FC = () => {
  const { user } = useAuth()
  const { canManageUsers } = usePermissions()

  if (!canManageUsers) {
    return (
      <div className="painel border-2 !border-vagao-600/40 p-6 sm:p-8 text-center">
        <div className="text-5xl mb-4">🚫</div>
        <h2 className="text-2xl font-display font-semibold uppercase text-vagao-600 mb-3">Acesso Negado</h2>
        <p className="text-ferro-700">Você não tem permissão para acessar esta área.</p>
      </div>
    )
  }

  return (
    <div className="painel text-ferro-900 p-4 sm:p-8">
      <div className="mb-6">
        <span className="font-display text-[11px] tracking-[0.3em] text-ferro-500 uppercase">Casa de máquinas</span>
        <h2 className="text-2xl sm:text-3xl font-display font-semibold uppercase text-ferro-900 leading-tight">
          Painel Administrativo
        </h2>
        <p className="text-sm text-ferro-500 mt-1">
          Logado como: <span className="font-semibold text-ferro-800 break-all">{user?.name || user?.email}</span>
        </p>
        <div className="trilho w-full mt-4" />
      </div>

      {/* Atalhos rápidos */}
      <div className="mb-8">
        <h3 className="text-lg font-display font-semibold uppercase tracking-wide text-ferro-800 mb-4">Atalhos Rápidos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            to="/admin-debitos"
            className="group flex items-stretch rounded-xl overflow-hidden bg-creme-50 border-2 border-ferro-800/80 shadow-sm hover:shadow-bilhete hover:-translate-y-0.5 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center justify-center w-16 shrink-0 bg-vagao-600 text-3xl">💳</div>
            <div className="picote-vertical flex-1 px-4 py-3">
              <div className="font-display font-semibold uppercase tracking-wide text-ferro-900">Cartões em Débito</div>
              <div className="text-sm text-ferro-500">Ver cartões com saldo negativo</div>
            </div>
          </Link>

          <Link
            to="/acompanhar"
            className="group flex items-stretch rounded-xl overflow-hidden bg-creme-50 border-2 border-ferro-800/80 shadow-sm hover:shadow-bilhete hover:-translate-y-0.5 active:scale-[0.98] transition-all"
          >
            <div className="flex items-center justify-center w-16 shrink-0 bg-anil-700 text-3xl">📡</div>
            <div className="picote-vertical flex-1 px-4 py-3">
              <div className="font-display font-semibold uppercase tracking-wide text-ferro-900">Acompanhar</div>
              <div className="text-sm text-ferro-500">Pulso do sistema em tempo real</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Feature Flags */}
      <FeatureFlagsManagement />

      {/* Gerenciamento de Usuários */}
      <UserManagement />
    </div>
  )
}

export default AdminPage
