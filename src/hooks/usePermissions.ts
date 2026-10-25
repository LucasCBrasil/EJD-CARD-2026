import { useAuth } from '../contexts/AuthContext'
import { getUserPermissions, hasPermission, hasAnyPermission, hasAllPermissions, UserRole, RolePermissions } from '../lib/roles'

export const usePermissions = () => {
  const { user } = useAuth()
  
  const userRole: UserRole = (user?.role as UserRole) || 'encontrista'
  const permissions = getUserPermissions(userRole)

  return {
    // Informações do usuário
    userRole,
    permissions,
    isAdmin: userRole === 'admin',
    isEncontrista: userRole === 'encontrista',
    
    // Verificações de permissão
    hasPermission: (permission: keyof RolePermissions) => hasPermission(userRole, permission),
    hasAnyPermission: (permissions: (keyof RolePermissions)[]) => hasAnyPermission(userRole, permissions),
    hasAllPermissions: (permissions: (keyof RolePermissions)[]) => hasAllPermissions(userRole, permissions),
    
    // Verificações específicas comuns
    canViewAccounts: hasPermission(userRole, 'canViewAccounts'),
    
    // Saldo
    canAddBalance: hasPermission(userRole, 'canAddBalance'),
    canViewOwnBalance: hasPermission(userRole, 'canViewOwnBalance'),
    canViewAllBalances: hasPermission(userRole, 'canViewAllBalances'),
    
    // Produtos
    canManageProductsLojinha: hasPermission(userRole, 'canManageProductsLojinha'),
    canManageProductsLanchonete: hasPermission(userRole, 'canManageProductsLanchonete'),
    
    // Vendas
    canSellLojinha: hasPermission(userRole, 'canSellLojinha'),
    canSellLanchonete: hasPermission(userRole, 'canSellLanchonete'),
    
    // Histórico
    canViewSalesHistoryLojinha: hasPermission(userRole, 'canViewSalesHistoryLojinha'),
    canViewSalesHistoryLanchonete: hasPermission(userRole, 'canViewSalesHistoryLanchonete'),
    
    // Entregas
    canViewOpenOrders: hasPermission(userRole, 'canViewOpenOrders'),
    canMarkAsDelivered: hasPermission(userRole, 'canMarkAsDelivered'),

    // Autoatendimento da Lanchonete
    canSelfOrderLanchonete: hasPermission(userRole, 'canSelfOrderLanchonete'),
    canManageLanchoneteOrders: hasPermission(userRole, 'canManageLanchoneteOrders'),
    
    // Admin
    canViewAdmin: hasPermission(userRole, 'canViewAdmin'),
    canManageUsers: hasPermission(userRole, 'canManageUsers'),
    canViewReports: hasPermission(userRole, 'canViewReports'),
  }
}
