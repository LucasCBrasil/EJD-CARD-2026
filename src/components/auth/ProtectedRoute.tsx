import React, { useEffect } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { usePermissions } from '../../hooks/usePermissions'
import { RolePermissions } from '../../lib/roles'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredPermission?: keyof RolePermissions
  requiredRole?: 'admin' | 'manager' | 'user'
  fallbackPath?: string
  showAccessDenied?: boolean
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredRole,
  fallbackPath = '/cards',
  showAccessDenied = false
}) => {
  const navigate = useNavigate()
  const { hasPermission, userRole } = usePermissions()

  const isAdminRole = userRole === 'admin'
  const isManagerRole = ['lojinha', 'lanchonete'].includes(userRole) || isAdminRole
  const isStandardUser = true // Todos os usuários autenticados são válidos

  const safeNavigate = (path: string) => {
    navigate({ to: path as any, replace: true, search: {} as any })
  }

  // Verificar se tem a permissão específica
  useEffect(() => {
    if (requiredPermission && !hasPermission(requiredPermission)) {
      if (!showAccessDenied) {
        safeNavigate(fallbackPath)
      }
    }
  }, [requiredPermission, hasPermission, showAccessDenied, navigate, fallbackPath])

  // Verificar se tem o role específico
  useEffect(() => {
    if (requiredRole) {
      const hasRequiredRole =
        (requiredRole === 'admin' && isAdminRole) ||
        (requiredRole === 'manager' && (isManagerRole || isAdminRole)) ||
        (requiredRole === 'user' && isStandardUser)

      if (!hasRequiredRole && !showAccessDenied) {
        safeNavigate(fallbackPath)
      }
    }
  }, [requiredRole, isAdminRole, isManagerRole, isStandardUser, showAccessDenied, navigate, fallbackPath])

  // Verificar se tem a permissão específica
  if (requiredPermission && !hasPermission(requiredPermission)) {
    if (showAccessDenied) {
      return (
        <div className="min-h-screen flex items-center justify-center" style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #fef3c7 25%, #faf5ff 50%, #f0f9ff 75%, #fdf2f8 100%)',
        }}>
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-red-200 p-8 text-center max-w-md">
            <div className="text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold text-red-600 mb-4">Acesso Negado</h2>
            <p className="text-gray-600 mb-6">
              Você não tem permissão para acessar esta área.
            </p>
            <button 
              onClick={() => window.history.back()}
              className="bg-red-500 hover:bg-red-600 text-black px-6 py-2 rounded-lg"
            >
              Voltar
            </button>
          </div>
        </div>
      )
    }
    return null
  }

  // Verificar se tem o role específico
  if (requiredRole) {
    const hasRequiredRole = 
      (requiredRole === 'admin' && isAdminRole) ||
      (requiredRole === 'manager' && (isManagerRole || isAdminRole)) ||
      (requiredRole === 'user' && isStandardUser)

    if (!hasRequiredRole) {
      if (showAccessDenied) {
        return (
          <div className="min-h-screen flex items-center justify-center" style={{
            background: 'linear-gradient(135deg, #f0fdf4 0%, #fef3c7 25%, #faf5ff 50%, #f0f9ff 75%, #fdf2f8 100%)',
          }}>
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-2xl border border-red-200 p-8 text-center max-w-md">
              <div className="text-6xl mb-4">👑</div>
              <h2 className="text-2xl font-bold text-red-600 mb-4">Acesso Restrito</h2>
              <p className="text-gray-600 mb-6">
                Esta área é restrita para {requiredRole}s.
              </p>
              <button 
                onClick={() => window.history.back()}
                className="bg-red-500 hover:bg-red-600 text-black px-6 py-2 rounded-lg"
              >
                Voltar
              </button>
            </div>
          </div>
        )
      }
      return null
    }
  }

  return <>{children}</>
}

