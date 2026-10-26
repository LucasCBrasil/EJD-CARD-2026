/**
 * Sistema de Roles/Permissões
 * Copiado de src/lib/roles.ts para usar nas Edge Functions
 */

export type UserRole = 
  | 'admin'
  | 'lojinha'
  | 'lanchonete'
  | 'comunicacao'
  | 'servico'
  | 'encontrista'

export interface RolePermissions {
  // Contas
  canViewAccounts: boolean
  
  // Saldo
  canAddBalance: boolean
  canViewOwnBalance: boolean
  canViewAllBalances: boolean
  
  // Produtos
  canManageProductsLojinha: boolean
  canManageProductsLanchonete: boolean
  
  // Vendas (realizar vendas)
  canSellLojinha: boolean
  canSellLanchonete: boolean
  
  // Histórico de vendas (ver relatórios)
  canViewSalesHistoryLojinha: boolean
  canViewSalesHistoryLanchonete: boolean
  
  // Pedidos
  canViewOpenOrders: boolean
  canMarkAsDelivered: boolean      // Marcar pedidos como entregue
  canSelfOrderLanchonete: boolean  // Fazer o próprio pedido na Lanchonete
  canManageLanchoneteOrders: boolean  // Fila de pedidos da Lanchonete
  
  // Admin
  canManageUsers: boolean
  canViewAdmin: boolean
  canViewReports: boolean
}

// Definição de permissões por role (IGUAL ao frontend!)
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  // Admin - Acesso total
  admin: {
    canViewAccounts: true,
    canAddBalance: true,
    canViewOwnBalance: true,
    canViewAllBalances: true,
    canManageProductsLojinha: true,
    canManageProductsLanchonete: true,
    canSellLojinha: true,
    canSellLanchonete: true,
    canViewSalesHistoryLojinha: true,
    canViewSalesHistoryLanchonete: true,
    canViewOpenOrders: true,
    canMarkAsDelivered: true,
    canSelfOrderLanchonete: true,
    canManageLanchoneteOrders: true,
    canManageUsers: true,
    canViewAdmin: true,
    canViewReports: true,
  },
  
  // Lojinha
  lojinha: {
    canViewAccounts: true,
    canAddBalance: false,
    canViewOwnBalance: true,
    canViewAllBalances: true,
    canManageProductsLojinha: true,
    canManageProductsLanchonete: false,
    canSellLojinha: true,
    canSellLanchonete: false,
    canViewSalesHistoryLojinha: true,
    canViewSalesHistoryLanchonete: false,
    canViewOpenOrders: true,
    canMarkAsDelivered: true,
    canSelfOrderLanchonete: true,
    canManageLanchoneteOrders: false,
    canManageUsers: false,
    canViewAdmin: false,
    canViewReports: false,
  },
  
  // Lanchonete
  lanchonete: {
    canViewAccounts: true,
    canAddBalance: false,
    canViewOwnBalance: true,
    canViewAllBalances: true,
    canManageProductsLojinha: false,
    canManageProductsLanchonete: true,
    canSellLojinha: false,
    canSellLanchonete: true,
    canViewSalesHistoryLojinha: false,
    canViewSalesHistoryLanchonete: true,
    canViewOpenOrders: false,
    canMarkAsDelivered: false,
    canSelfOrderLanchonete: true,
    canManageLanchoneteOrders: true,
    canManageUsers: false,
    canViewAdmin: false,
    canViewReports: false,
  },
  
  // Comunicação - visualizar contas e ajustar saldo
  comunicacao: {
    canViewAccounts: true,
    canAddBalance: true,
    canViewOwnBalance: true,
    canViewAllBalances: true,
    canManageProductsLojinha: false,
    canManageProductsLanchonete: false,
    canSellLojinha: false,
    canSellLanchonete: false,
    canViewSalesHistoryLojinha: false,
    canViewSalesHistoryLanchonete: false,
    canViewOpenOrders: false,
    canMarkAsDelivered: false,
    canSelfOrderLanchonete: true,
    canManageLanchoneteOrders: false,
    canManageUsers: false,
    canViewAdmin: false,
    canViewReports: false,
  },
  
  // Serviço - ver a própria conta
  servico: {
    canViewAccounts: true,
    canAddBalance: false,
    canViewOwnBalance: true,
    canViewAllBalances: false,
    canManageProductsLojinha: false,
    canManageProductsLanchonete: false,
    canSellLojinha: false,
    canSellLanchonete: false,
    canViewSalesHistoryLojinha: false,
    canViewSalesHistoryLanchonete: false,
    canViewOpenOrders: false,
    canMarkAsDelivered: false,
    canSelfOrderLanchonete: true,
    canManageLanchoneteOrders: false,
    canManageUsers: false,
    canViewAdmin: false,
    canViewReports: false,
  },
  
  // Encontrista - ver o próprio saldo e conta
  encontrista: {
    canViewAccounts: true,
    canAddBalance: false,
    canViewOwnBalance: true,
    canViewAllBalances: false,
    canManageProductsLojinha: false,
    canManageProductsLanchonete: false,
    canSellLojinha: false,
    canSellLanchonete: false,
    canViewSalesHistoryLojinha: false,
    canViewSalesHistoryLanchonete: false,
    canViewOpenOrders: false,
    canMarkAsDelivered: false,
    canSelfOrderLanchonete: true,
    canManageLanchoneteOrders: false,
    canManageUsers: false,
    canViewAdmin: false,
    canViewReports: false,
  },
}

// Função para obter permissões de um role
export const getUserPermissions = (role: UserRole): RolePermissions => {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.encontrista
}

// Função para verificar se um usuário tem uma permissão específica
export const hasPermission = (userRole: UserRole, permission: keyof RolePermissions): boolean => {
  const permissions = getUserPermissions(userRole)
  return permissions[permission]
}

// Função para verificar múltiplas permissões
export const hasAnyPermission = (userRole: UserRole, permissions: (keyof RolePermissions)[]): boolean => {
  return permissions.some(permission => hasPermission(userRole, permission))
}

// Função para verificar se tem todas as permissões
export const hasAllPermissions = (userRole: UserRole, permissions: (keyof RolePermissions)[]): boolean => {
  return permissions.every(permission => hasPermission(userRole, permission))
}
