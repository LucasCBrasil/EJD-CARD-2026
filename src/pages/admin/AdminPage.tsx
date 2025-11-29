import React from 'react'
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

      {/* Feature Flags */}
      <FeatureFlagsManagement />

      {/* Gerenciamento de Usuários */}
      <UserManagement />
    </div>
  )
}

export default AdminPage
