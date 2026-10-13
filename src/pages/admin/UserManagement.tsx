import React, { useState, useEffect, useCallback } from 'react'
import { usePermissions } from '../../hooks/usePermissions'
import { useAuth } from '../../contexts/AuthContext'
import { useToastContext } from '../../contexts/ToastContext'
import { UserRole } from '../../lib/roles'

interface User {
  id: string
  email: string | null
  name: string | null
  role: UserRole
  created_at: string
}

// Mapeamento de cores e ícones para cada role
const roleConfig: Record<UserRole, { color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'; label: string; emoji: string }> = {
  admin: { color: 'secondary', label: 'Admin', emoji: '👑' },
  lojinha: { color: 'info', label: 'Lojinha', emoji: '🏪' },
  lanchonete: { color: 'warning', label: 'Lanchonete', emoji: '🍔' },
  comunicacao: { color: 'success', label: 'Comunicação', emoji: '📢' },
  servico: { color: 'default', label: 'Serviço', emoji: '👨‍🔧' },
  encontrista: { color: 'primary', label: 'Encontrista', emoji: '👤' },
}

const allRoles: UserRole[] = ['admin', 'lojinha', 'lanchonete', 'comunicacao', 'servico', 'encontrista']

// Helper para URL das Edge Functions
function getSupabaseFunctionsUrl(): string {
  const envFunctionsUrl = (import.meta as any).env?.VITE_SUPABASE_FUNCTIONS_URL
  const envSupabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL
  if (envFunctionsUrl) return envFunctionsUrl
  if (envSupabaseUrl) return `${envSupabaseUrl}/functions/v1`
  return '/functions/v1'
}

const UserManagement: React.FC = () => {
  const { canManageUsers } = usePermissions()
  const { user: currentUser, getAccessToken } = useAuth()
  const { showSuccess, showError } = useToastContext()
  
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    const accessToken = await getAccessToken()
    if (!accessToken) return

    setIsLoading(true)
    setError(null)

    try {
      const functionsBase = getSupabaseFunctionsUrl()
      const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      }
      if (anonKey) headers['apikey'] = anonKey

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })
      if (searchQuery) params.append('search', searchQuery)
      if (roleFilter) params.append('role', roleFilter)

      const res = await fetch(`${functionsBase}/list-users?${params}`, { headers })
      const json = await res.json()

      if (json.success) {
        setUsers(json.data || [])
        setTotalPages(json.pagination?.totalPages || 1)
        setTotal(json.pagination?.total || 0)
      } else {
        setError(json.error || 'Erro ao carregar usuários')
      }
    } catch (err: any) {
      setError(err?.message || 'Erro de conexão')
    } finally {
      setIsLoading(false)
    }
  }, [getAccessToken, page, searchQuery, roleFilter])

  useEffect(() => {
    if (canManageUsers) {
      fetchUsers()
    }
  }, [fetchUsers, canManageUsers])

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1) // Reset page on search
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

  const updateUserRole = async (userId: string, newRole: UserRole) => {
    if (userId === currentUser?.id) {
      showError('Ação não permitida', 'Você não pode alterar seu próprio role')
      return
    }

    const accessToken = await getAccessToken()
    if (!accessToken) {
      showError('Sessão expirada', 'Faça login novamente')
      return
    }

    setUpdatingUserId(userId)

    try {
      const functionsBase = getSupabaseFunctionsUrl()
      const anonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      }
      if (anonKey) headers['apikey'] = anonKey

      const res = await fetch(`${functionsBase}/manage-users`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ userId, role: newRole }),
      })

      const json = await res.json()

      if (json.success) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
        showSuccess('Role atualizado', `Role alterado para ${roleConfig[newRole].label}`)
      } else {
        showError('Erro', json.error || 'Erro ao atualizar role')
      }
    } catch (err: any) {
      showError('Erro', err?.message || 'Erro de conexão')
    } finally {
      setUpdatingUserId(null)
    }
  }

  if (!canManageUsers) {
    return (
      <div role="alert" className="mt-4 rounded-xl border border-vagao-200 bg-vagao-50 px-4 py-3 text-sm text-vagao-700">
        Você não tem permissão para gerenciar usuários.
      </div>
    )
  }

  return (
    <section className="border-t-2 border-dashed border-ferro-200 pt-6 mt-6">
      <h3 className="text-lg font-display font-semibold uppercase tracking-wide text-ferro-800 mb-1">
        Gerenciar Usuários
      </h3>
      
      <p className="text-sm text-ferro-500 mb-4">
        {total} usuários cadastrados no sistema
      </p>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 min-w-0">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ferro-400">🔍</span>
          <input
            type="search"
            placeholder="Buscar por nome ou email..."
            aria-label="Buscar por nome ou email"
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
            className="w-full !pl-10 !py-2.5"
          />
        </div>
        
        <select
          aria-label="Filtrar por role"
          value={roleFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
            setRoleFilter(e.target.value)
            setPage(1)
          }}
          className="sm:w-52 !py-2.5 text-ferro-900"
        >
          <option value="">Todos os roles</option>
          {allRoles.map(role => (
            <option key={role} value={role}>
              {roleConfig[role].emoji} {roleConfig[role].label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="mb-3 rounded-xl border border-vagao-200 bg-vagao-50 px-4 py-3 text-sm text-vagao-700">
          {error}
        </div>
      )}

      {/* Tabela */}
      <div className="mb-3 rounded-xl border border-ferro-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="bg-ferro-800 text-creme-200 font-display uppercase tracking-wider text-xs">
                <th className="px-3 py-2.5 text-left font-semibold">Nome</th>
                <th className="px-3 py-2.5 text-left font-semibold">Email</th>
                <th className="px-3 py-2.5 text-left font-semibold w-[180px]">Role</th>
                <th className="px-3 py-2.5 text-left font-semibold w-[110px]">Cadastro</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ferro-200">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className={i % 2 === 0 ? 'bg-creme-50' : 'bg-creme-100'}>
                    <td className="px-3 py-3"><div className="h-4 w-28 rounded bg-creme-300 animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-40 rounded bg-creme-300 animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-8 w-32 rounded-lg bg-creme-300 animate-pulse" /></td>
                    <td className="px-3 py-3"><div className="h-4 w-20 rounded bg-creme-300 animate-pulse" /></td>
                  </tr>
                ))
              ) : users.length === 0 ? (
                <tr className="bg-creme-50">
                  <td colSpan={4} className="px-3 py-8 text-center text-ferro-500">
                    Nenhum usuário encontrado
                  </td>
                </tr>
              ) : (
                users.map((user, index) => {
                  const isCurrentUser = user.id === currentUser?.id
                  const isUpdating = updatingUserId === user.id
                  
                  return (
                    <tr
                      key={user.id}
                      className={`${index % 2 === 0 ? 'bg-creme-50' : 'bg-creme-100'} hover:bg-creme-200 transition-colors ${isCurrentUser ? 'opacity-80' : ''}`}
                    >
                      <td className="px-3 py-2.5 text-ferro-900">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{user.name || '—'}</span>
                          {isCurrentUser && (
                            <span className="carimbo text-[10px] !rotate-0 text-anil-700">Você</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-ferro-500 break-all">
                        {user.email || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        {isUpdating ? (
                          <div className="w-6 h-6 border-[3px] border-ferro-200 border-t-ferro-700 rounded-full animate-spin" />
                        ) : isCurrentUser ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-ferro-800 text-creme-200 px-3 py-1 text-xs font-display uppercase tracking-wide">
                            {roleConfig[user.role].emoji} {roleConfig[user.role].label}
                          </span>
                        ) : (
                          <select
                            aria-label={`Role de ${user.name || user.email || 'usuário'}`}
                            value={user.role}
                            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateUserRole(user.id, e.target.value as UserRole)}
                            className="w-full min-w-[140px] !px-2 !py-1.5 !rounded-lg text-ferro-900"
                          >
                            {allRoles.map(role => (
                              <option key={role} value={role}>
                                {roleConfig[role].emoji} {roleConfig[role].label}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-ferro-400 whitespace-nowrap">
                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-3">
          <button
            type="button"
            data-btn-type="pagination"
            onClick={() => setPage(page - 1)}
            disabled={page <= 1}
            className="!px-3 !py-1.5 rounded-lg text-sm font-display uppercase tracking-wide disabled:opacity-40"
          >
            ‹ Anterior
          </button>
          <span className="font-ticket text-sm text-ferro-700 px-2">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            data-btn-type="pagination"
            onClick={() => setPage(page + 1)}
            disabled={page >= totalPages}
            className="!px-3 !py-1.5 rounded-lg text-sm font-display uppercase tracking-wide disabled:opacity-40"
          >
            Próxima ›
          </button>
        </div>
      )}
    </section>
  )
}

export default UserManagement
