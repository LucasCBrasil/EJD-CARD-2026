import React, { useState, useEffect, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  TextField,
  InputAdornment,
  Chip,
  CircularProgress,
  Alert,
  Pagination,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Skeleton,
  SelectChangeEvent,
} from '@mui/material'
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
      <Alert severity="error" sx={{ mt: 2 }}>
        Você não tem permissão para gerenciar usuários.
      </Alert>
    )
  }

  return (
    <div className="border-t border-gray-200 pt-6 mt-6">
      <Typography variant="h6" sx={{ mb: 2, fontWeight: 'bold', color: '#1f2937' }}>
        👥 Gerenciar Usuários
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {total} usuários cadastrados no sistema
      </Typography>

      {/* Filtros */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Buscar por nome ou email..."
          value={searchQuery}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
          sx={{ minWidth: 250, flex: 1 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">🔍</InputAdornment>
            ),
          }}
        />
        
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Filtrar Role</InputLabel>
          <Select
            value={roleFilter}
            label="Filtrar Role"
            onChange={(e: SelectChangeEvent<string>) => {
              setRoleFilter(e.target.value)
              setPage(1)
            }}
          >
            <MenuItem value="">Todos</MenuItem>
            {allRoles.map(role => (
              <MenuItem key={role} value={role}>
                {roleConfig[role].emoji} {roleConfig[role].label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Tabela */}
      <TableContainer component={Paper} sx={{ mb: 2, boxShadow: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f3f4f6' }}>
              <TableCell sx={{ fontWeight: 'bold' }}>Nome</TableCell>
              <TableCell sx={{ fontWeight: 'bold' }}>Email</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 180 }}>Role</TableCell>
              <TableCell sx={{ fontWeight: 'bold', width: 120 }}>Cadastro</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              // Skeleton loading
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton variant="text" /></TableCell>
                  <TableCell><Skeleton variant="text" /></TableCell>
                  <TableCell><Skeleton variant="rounded" width={120} height={32} /></TableCell>
                  <TableCell><Skeleton variant="text" width={80} /></TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    Nenhum usuário encontrado
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => {
                const isCurrentUser = user.id === currentUser?.id
                const isUpdating = updatingUserId === user.id
                
                return (
                  <TableRow 
                    key={user.id}
                    sx={{ 
                      '&:hover': { backgroundColor: '#f9fafb' },
                      opacity: isCurrentUser ? 0.7 : 1,
                    }}
                  >
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{user.name || '—'}</span>
                        {isCurrentUser && (
                          <Chip label="Você" size="small" color="primary" variant="outlined" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ color: '#6b7280', fontSize: '0.875rem' }}>
                      {user.email || '—'}
                    </TableCell>
                    <TableCell>
                      {isUpdating ? (
                        <CircularProgress size={24} />
                      ) : isCurrentUser ? (
                        <Chip
                          label={`${roleConfig[user.role].emoji} ${roleConfig[user.role].label}`}
                          color={roleConfig[user.role].color}
                          size="small"
                        />
                      ) : (
                        <Select
                          size="small"
                          value={user.role}
                          onChange={(e: SelectChangeEvent<string>) => updateUserRole(user.id, e.target.value as UserRole)}
                          sx={{ 
                            minWidth: 140,
                            '& .MuiSelect-select': { 
                              py: 0.5,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 0.5,
                            }
                          }}
                        >
                          {allRoles.map(role => (
                            <MenuItem key={role} value={role}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <span>{roleConfig[role].emoji}</span>
                                <span>{roleConfig[role].label}</span>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                      )}
                    </TableCell>
                    <TableCell sx={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                      {new Date(user.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Paginação */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
          <Pagination 
            count={totalPages} 
            page={page} 
            onChange={(_: React.ChangeEvent<unknown>, newPage: number) => setPage(newPage)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}
    </div>
  )
}

export default UserManagement
