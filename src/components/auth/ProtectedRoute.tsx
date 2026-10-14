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
  fallbackPath = '/accounts',
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
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="painel p-8 text-center max-w-md w-full text-ferro-900">
            <div className="text-6xl mb-4">🚧</div>
            <h2 className="text-2xl font-display font-semibold uppercase tracking-wide text-vagao-600 mb-4">Acesso Negado</h2>
            <p className="text-ferro-700 mb-6">
              Você não tem permissão para acessar esta área.
            </p>
            <button 
              onClick={() => window.history.back()}
              className="bg-ferro-800 hover:bg-ferro-700 text-creme-200 font-display uppercase tracking-wide px-6 py-2 rounded-xl"
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
          <div className="min-h-screen flex items-center justify-center px-4">
            <div className="painel p-8 text-center max-w-md w-full text-ferro-900">
              <div className="text-6xl mb-4">🎫</div>
              <h2 className="text-2xl font-display font-semibold uppercase tracking-wide text-vagao-600 mb-4">Acesso Restrito</h2>
              <p className="text-ferro-700 mb-6">
                Esta área é restrita para {requiredRole}s.
              </p>
              <button 
                onClick={() => window.history.back()}
                className="bg-ferro-800 hover:bg-ferro-700 text-creme-200 font-display uppercase tracking-wide px-6 py-2 rounded-xl"
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
