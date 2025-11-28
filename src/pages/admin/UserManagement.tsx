import React, { useState, useEffect } from 'react'
import { usePermissions } from '../../hooks/usePermissions'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../../components/shared'
import { api } from '../../lib/api-client'
import { UserRole } from '../../lib/roles'
import { useToastContext } from '../../contexts/ToastContext'

interface User {
  id: string
  email: string
  name: string | null
  role: UserRole
  created_at?: string
}

// Mapeamento de cores e ícones para cada role
const getRoleBadge = (role: UserRole) => {
  const badges: Record<UserRole, { color: string; text: string; emoji: string }> = {
    admin: { color: 'bg-purple-100 text-purple-700', text: 'Admin', emoji: '👑' },
    lojinha: { color: 'bg-blue-100 text-blue-700', text: 'Lojinha', emoji: '🏪' },
    lanchonete: { color: 'bg-orange-100 text-orange-700', text: 'Lanchonete', emoji: '🍔' } ,
    comunicacao: { color: 'bg-green-100 text-green-700', text: 'Comunicação', emoji: '📢' },
    servico: { color: 'bg-yellow-100 text-yellow-700', text: 'Serviço', emoji: '👨‍🔧' },
    encontrista: { color: 'bg-gray-100 text-gray-700', text: 'Encontrista', emoji: '👤' },
  }
  
  return badges[role] || badges.encontrista
}

const UserManagement: React.FC = () => {
  const { canManageUsers } = usePermissions()
  const { user: currentUser } = useAuth()
  const { showSuccess, showError } = useToastContext()
  const [users, setUsers] = useState<User[]>([])
  const [searchEmail, setSearchEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [newRole, setNewRole] = useState<UserRole>('encontrista')

  // Debounce para busca
  useEffect(() => {
    if (!canManageUsers) return

    const timeoutId = setTimeout(() => {
      if (searchEmail.trim()) {
        searchUsers(searchEmail.trim())
      } else {
        setUsers([])
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchEmail, canManageUsers])

  // ✅ Agora usa Edge Function via api-client (seguro!)
  const searchUsers = async (email: string) => {
    setIsLoading(true)
    try {
      const response = await api.searchUsers(email)

      if (!response.success || !response.data) {
        throw new Error('Erro ao buscar usuários')
      }

      setUsers(response.data as User[])
    } catch (error: any) {
      console.error('Erro ao buscar usuários:', error)
      showError('Erro ao buscar usuários', error?.message || 'Não foi possível buscar usuários')
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }

  // ✅ Agora usa Edge Function via api-client (seguro!)
  const updateUserRole = async (userId: string, role: UserRole) => {
    try {
      // Validar que não está alterando o próprio role
      if (userId === currentUser?.id) {
        showError('Ação não permitida', 'Você não pode alterar seu próprio role. Peça a outro administrador para fazer isso.')
        setEditingUser(null)
        return
      }

      // Validar que a role é válida
      const validRoles: UserRole[] = ['admin', 'lojinha', 'lanchonete', 'comunicacao', 'servico', 'encontrista']
      if (!validRoles.includes(role)) {
        showError('Role inválido', 'O role selecionado não é válido.')
        return
      }

      const response = await api.updateUserRole(userId, role)

      if (!response.success || !response.data) {
        throw new Error('Erro ao atualizar role')
      }

      // Atualizar estado local imediatamente
      setUsers(users.map(user =>
        user.id === userId ? { ...user, role } : user
      ))
      setEditingUser(null)
      showSuccess('Role Alterado', `Role alterado para ${getRoleBadge(role).text} com sucesso!`)
    } catch (error: any) {
      console.error('Erro ao atualizar role:', error)
      showError('Erro ao alterar role', error?.message || 'Não foi possível alterar o role')
    }
  }

  const handleEdit = (user: User) => {
    setEditingUser(user)
    setNewRole(user.role)
  }

  const handleCancel = () => {
    setEditingUser(null)
  }

  if (!canManageUsers) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-red-200 p-8 text-center">
        <div className="text-6xl mb-4">🚫</div>
        <h2 className="text-2xl font-bold text-red-600 mb-4">Acesso Negado</h2>
        <p className="text-gray-600">Você não tem permissão para gerenciar usuários.</p>
      </div>
    )
  }

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-yellow-200 p-4 md:p-8 overflow-x-hidden max-w-full">
      <h2 className="text-xl md:text-2xl font-bold text-black mb-6">👥 Gerenciar Usuários</h2>
      
      {/* Campo de busca */}
      <div className="mb-6">
        <label htmlFor="search-email" className="block text-sm font-semibold text-black mb-2">
          🔍 Buscar por Email
        </label>
        <div className="relative">
          <input
            id="search-email"
            type="email"
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            placeholder="Digite o email do usuário..."
            className="w-full px-4 py-3 pl-10 border-2 border-emerald-200 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors duration-200 bg-white/90"
          />
          <span className="absolute left-3 top-3.5 text-gray-400">📧</span>
          {isLoading && (
            <span className="absolute right-3 top-3.5">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-emerald-500"></div>
            </span>
          )}
        </div>
        {searchEmail && !isLoading && (
          <p className="text-sm text-gray-600 mt-2">
            {users.length === 0 ? 'Nenhum usuário encontrado' : `${users.length} usuário(s) encontrado(s)`}
          </p>
        )}
      </div>

      {/* Lista de usuários */}
      {searchEmail && (
        <div className="overflow-x-hidden">
          {users.length === 0 && !isLoading ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-6xl mb-4">🔍</div>
              <p className="text-lg font-medium">Nenhum usuário encontrado com este email.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => {
                const badge = getRoleBadge(user.role)
                const isCurrentUser = user.id === currentUser?.id
                const isEditing = editingUser?.id === user.id
                
                return (
                  <div
                    key={user.id}
                    className={`bg-gradient-to-r from-white to-gray-50 rounded-xl border-2 p-4 md:p-6 shadow-lg transition-all duration-300 overflow-hidden ${
                      isCurrentUser
                        ? 'border-yellow-400 bg-gradient-to-r from-yellow-50 to-yellow-100'
                        : isEditing
                        ? 'border-emerald-400 shadow-emerald-200'
                        : 'border-gray-200 hover:border-emerald-300 hover:shadow-xl'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start gap-4">
                      {/* Informações do usuário */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start gap-3 md:gap-4">
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-xl md:text-2xl font-bold text-white shadow-lg">
                              {user.name ? user.name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <h3 className="text-base md:text-lg font-bold text-black truncate">
                                {user.name || 'Sem nome'}
                              </h3>
                              {isCurrentUser && (
                                <span className="px-2 py-1 rounded-full text-xs font-bold bg-yellow-400 text-black shadow-sm whitespace-nowrap">
                                  Você
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 mb-2 truncate">{user.email}</p>
                            {user.created_at && (
                              <p className="text-xs text-gray-500">
                                Criado em {new Date(user.created_at).toLocaleDateString('pt-BR')}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Role e Ações */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 lg:flex-shrink-0 lg:w-auto">
                        {/* Role */}
                        <div className="flex-1 sm:flex-initial min-w-0">
                          {isEditing ? (
                            <div className="space-y-3">
                              <label className="block text-xs font-semibold text-gray-700 mb-1">
                                Selecionar Novo Role:
                              </label>
                              <select
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value as UserRole)}
                                className="w-full max-w-full sm:w-56 px-3 py-2 md:px-4 md:py-3 border-2 border-emerald-300 rounded-lg bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors font-medium shadow-sm text-sm md:text-base"
                              >
                                {(['admin', 'lojinha', 'lanchonete', 'comunicacao', 'servico', 'encontrista'] as UserRole[]).map((role) => {
                                  const b = getRoleBadge(role)
                                  return (
                                    <option key={role} value={role}>
                                      {b.emoji} {b.text}
                                    </option>
                                  )
                                })}
                              </select>
                              {newRole !== user.role && (
                                <div className="flex flex-wrap items-center gap-2 text-xs md:text-sm">
                                  <span className="text-gray-600">De:</span>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${badge.color}`}>
                                    {badge.emoji} {badge.text}
                                  </span>
                                  <span className="text-gray-600">→</span>
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${getRoleBadge(newRole).color}`}>
                                    {getRoleBadge(newRole).emoji} {getRoleBadge(newRole).text}
                                  </span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <label className="block text-xs font-semibold text-gray-700 mb-2">
                                Role Atual:
                              </label>
                              <div className={`inline-flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 rounded-lg font-semibold text-xs md:text-sm shadow-md ${badge.color} border-2 border-opacity-30`}>
                                <span className="text-lg md:text-xl">{badge.emoji}</span>
                                <span>{badge.text}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Botões de ação */}
                        <div className="flex gap-2 flex-shrink-0">
                          {isEditing ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => updateUserRole(user.id, newRole)}
                                className="!bg-gradient-to-r !from-emerald-500 !to-emerald-600 hover:!from-emerald-600 hover:!to-emerald-700 !text-white !shadow-lg hover:!shadow-xl !font-bold px-4 md:px-6 py-2 whitespace-nowrap"
                              >
                                💾 Salvar
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleCancel}
                                className="!bg-gray-500 hover:!bg-gray-600 !text-white !shadow-md !font-bold px-4 md:px-6 py-2 whitespace-nowrap !opacity-100"
                              >
                                ✖️ Cancelar
                              </Button>
                            </>
                          ) : (
                            <Button
                              size="sm"
                              onClick={() => handleEdit(user)}
                              className="!bg-gradient-to-r !from-blue-500 !to-blue-600 hover:!from-blue-600 hover:!to-blue-700 !text-white !shadow-lg hover:!shadow-xl !font-bold px-4 md:px-6 py-2 whitespace-nowrap"
                              disabled={isCurrentUser}
                            >
                              {isCurrentUser ? '🔒 Bloqueado' : '✏️ Alterar Role'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {!searchEmail && (
        <div className="text-center py-8 text-gray-500">
          <p>Digite um email no campo de busca para encontrar usuários.</p>
        </div>
      )}
    </div>
  )
}

export default UserManagement
