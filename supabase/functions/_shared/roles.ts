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
  // Cartões
  canViewCards: boolean
  canCreateCards: boolean
  canEditCards: boolean
  canDeleteCards: boolean
  
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
  canSellSapatinho: boolean  // Vender produtos do sapatinho
  
  // Histórico de vendas (ver relatórios)
  canViewSalesHistoryLojinha: boolean
  canViewSalesHistoryLanchonete: boolean
  canViewSalesHistorySapatinho: boolean
  
  // Pedidos Sapatinho
  canPlaceOrderSapatinho: boolean  // FAZER pedido no sapatinho (como cliente)
  canViewOpenOrders: boolean       // Ver pedidos abertos (lojinha + sapatinho)
  canMarkAsDelivered: boolean      // Marcar pedidos como entregue
  
  // Admin
  canManageUsers: boolean
  canViewAdmin: boolean
  canViewReports: boolean
}

// Definição de permissões por role (IGUAL ao frontend!)
export const ROLE_PERMISSIONS: Record<UserRole, RolePermissions> = {
  // Admin - Acesso total
  admin: {
    canViewCards: true,
    canCreateCards: true,
    canEditCards: true,
    canDeleteCards: true,
    canAddBalance: true,
    canViewOwnBalance: true,
    canViewAllBalances: true,
    canManageProductsLojinha: true,
    canManageProductsLanchonete: true,
    canSellLojinha: true,
    canSellLanchonete: true,
    canSellSapatinho: true,              // ✅ Pode vender
    canViewSalesHistoryLojinha: true,
    canViewSalesHistoryLanchonete: true,
    canViewSalesHistorySapatinho: true,  // ✅ Vê histórico
    canPlaceOrderSapatinho: true,        // ✅ Pode fazer pedidos
    canViewOpenOrders: true,             // ✅ Vê pedidos
    canMarkAsDelivered: true,
    canManageUsers: true,
    canViewAdmin: true,
    canViewReports: true,
  },
  
  // Lojinha - Acesso total à lojinha + sapatinho
  lojinha: {
    canViewCards: true,
    canCreateCards: false,
    canEditCards: false,
    canDeleteCards: false,
    canAddBalance: false,
    canViewOwnBalance: true,
    canViewAllBalances: false,
    canManageProductsLojinha: true,
    canManageProductsLanchonete: false,
    canSellLojinha: true,
    canSellLanchonete: false,
    canSellSapatinho: true,              // ✅ Pode vender
    canViewSalesHistoryLojinha: true,
    canViewSalesHistoryLanchonete: false,
    canViewSalesHistorySapatinho: true,  // ✅ Vê histórico
    canPlaceOrderSapatinho: true,        // ✅ Pode fazer pedidos
    canViewOpenOrders: true,              // ✅ Vê pedidos (lojinha + sapatinho)
    canMarkAsDelivered: true,             // ✅ Marca entregue
    canManageUsers: false,
    canViewAdmin: false,
    canViewReports: false,
  },
  
  // Lanchonete - Acesso total à lanchonete + pode vender sapatinho
  lanchonete: {
    canViewCards: true,
    canCreateCards: false,
    canEditCards: false,
    canDeleteCards: false,
    canAddBalance: false,
    canViewOwnBalance: true,
    canViewAllBalances: false,
    canManageProductsLojinha: false,
    canManageProductsLanchonete: true,
    canSellLojinha: false,
    canSellLanchonete: true,
    canSellSapatinho: true,              // ✅ Pode vender
    canViewSalesHistoryLojinha: false,
    canViewSalesHistoryLanchonete: true,
    canViewSalesHistorySapatinho: false, // ❌ NÃO vê histórico
    canPlaceOrderSapatinho: true,        // ✅ Pode fazer pedidos
    canViewOpenOrders: false,             // ❌ NÃO vê pedidos
    canMarkAsDelivered: false,
    canManageUsers: false,
    canViewAdmin: false,
    canViewReports: false,
  },
  
  // Comunicação - CRUD de cartões + saldo + pode vender sapatinho
  comunicacao: {
    canViewCards: true,
    canCreateCards: true,
    canEditCards: true,
    canDeleteCards: false,
    canAddBalance: true,
    canViewOwnBalance: true,
    canViewAllBalances: true,
    canManageProductsLojinha: false,
    canManageProductsLanchonete: false,
    canSellLojinha: false,
    canSellLanchonete: false,
    canSellSapatinho: true,              // ✅ Pode vender
    canViewSalesHistoryLojinha: false,
    canViewSalesHistoryLanchonete: false,
    canViewSalesHistorySapatinho: false, // ❌ NÃO vê histórico
    canPlaceOrderSapatinho: true,        // ✅ Pode fazer pedidos
    canViewOpenOrders: false,             // ❌ NÃO vê pedidos
    canMarkAsDelivered: false,
    canManageUsers: false,
    canViewAdmin: false,
    canViewReports: false,
  },
  
  // Serviço - Ver próprio cartão + pode fazer pedidos no Sapatinho
  servico: {
    canViewCards: true,
    canCreateCards: false,
    canEditCards: false,
    canDeleteCards: false,
    canAddBalance: false,
    canViewOwnBalance: true,
    canViewAllBalances: false,
    canManageProductsLojinha: false,
    canManageProductsLanchonete: false,
    canSellLojinha: false,
    canSellLanchonete: false,
    canSellSapatinho: false,             // ❌ NÃO vende
    canViewSalesHistoryLojinha: false,
    canViewSalesHistoryLanchonete: false,
    canViewSalesHistorySapatinho: false,
    canPlaceOrderSapatinho: true,        // ✅ PODE fazer pedidos
    canViewOpenOrders: false,
    canMarkAsDelivered: false,
    canManageUsers: false,
    canViewAdmin: false,
    canViewReports: false,
  },
  
  // Encontrista - Ver próprio saldo e cartão (NÃO usa sapatinho)
  encontrista: {
    canViewCards: true,
    canCreateCards: false,
    canEditCards: false,
    canDeleteCards: false,
    canAddBalance: false,
    canViewOwnBalance: true,
    canViewAllBalances: false,
    canManageProductsLojinha: false,
    canManageProductsLanchonete: false,
    canSellLojinha: false,
    canSellLanchonete: false,
    canSellSapatinho: false,             // ❌ NÃO pode vender
    canViewSalesHistoryLojinha: false,
    canViewSalesHistoryLanchonete: false,
    canViewSalesHistorySapatinho: false,
    canPlaceOrderSapatinho: false,       // ❌ NÃO faz pedidos
    canViewOpenOrders: false,
    canMarkAsDelivered: false,
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
