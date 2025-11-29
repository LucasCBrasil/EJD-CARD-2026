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
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-red-200 p-8 text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h2 className="text-2xl font-bold text-red-600 mb-4">Acesso Negado</h2>
        <p className="text-gray-600">Você não tem permissão para acessar esta área.</p>
      </div>
    )
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-8">
      <h2 className="text-2xl font-bold text-black mb-6">⚙️ Painel Administrativo</h2>
      
      <div className="mb-6">
        <p className="text-sm text-gray-600 mb-4">
          Logado como: <span className="font-semibold">{user?.name || user?.email}</span>
        </p>
      </div>

      {/* Atalhos rápidos */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">📋 Atalhos Rápidos</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            to="/admin-debitos"
            className="flex items-center gap-3 p-4 bg-red-50 hover:bg-red-100 border-2 border-red-200 rounded-xl transition-all hover:scale-105 hover:shadow-lg"
          >
            <div className="text-3xl">💳</div>
            <div>
              <div className="font-bold text-red-700">Cartões em Débito</div>
              <div className="text-sm text-red-600">Ver cartões com saldo negativo</div>
            </div>
          </Link>
          
          <Link
            to="/acompanhar"
            className="flex items-center gap-3 p-4 bg-cyan-50 hover:bg-cyan-100 border-2 border-cyan-200 rounded-xl transition-all hover:scale-105 hover:shadow-lg"
          >
            <div className="text-3xl">📡</div>
            <div>
              <div className="font-bold text-cyan-700">Acompanhar</div>
              <div className="text-sm text-cyan-600">Pulso do sistema em tempo real</div>
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
