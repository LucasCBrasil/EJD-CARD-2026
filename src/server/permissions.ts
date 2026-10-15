/**
 * Sistema de Permissões
 * 
 * Define roles e permissões do sistema.
 * Compartilhado entre frontend e backend.
 */

export type UserRole = 
  | 'admin'
  | 'lojinha'
  | 'lanchonete'
  | 'comunicacao'
  | 'servico'
  | 'encontrista'

export type Permission =
  // Contas
  | 'accounts:view_all'
  | 'accounts:view_own'
  | 'accounts:adjust_balance'
  | 'accounts:debit_balance'
  // Produtos
  | 'products:view'
  | 'products:create_lojinha'
  | 'products:create_lanchonete'
  | 'products:update_lojinha'
  | 'products:update_lanchonete'
  | 'products:delete_lojinha'
  | 'products:delete_lanchonete'
  // Vendas
  | 'sales:create_lojinha'
  | 'sales:create_lanchonete'
  | 'sales:view_history_lojinha'
  | 'sales:view_history_lanchonete'
  | 'sales:view_own'
  // Pedidos
  | 'orders:view'
  | 'orders:mark_delivered'
  // Admin
  | 'admin:manage_users'
  | 'admin:view_reports'

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'accounts:view_all', 'accounts:view_own', 'accounts:adjust_balance', 'accounts:debit_balance',
    'products:view', 'products:create_lojinha', 'products:create_lanchonete',
    'products:update_lojinha', 'products:update_lanchonete',
    'products:delete_lojinha', 'products:delete_lanchonete',
    'sales:create_lojinha', 'sales:create_lanchonete',
    'sales:view_history_lojinha', 'sales:view_history_lanchonete',
    'orders:view', 'orders:mark_delivered',
    'admin:manage_users', 'admin:view_reports'
  ],
  
  lojinha: [
    'accounts:view_all', 'accounts:view_own',
    'products:view', 'products:create_lojinha', 'products:update_lojinha', 'products:delete_lojinha',
    'sales:create_lojinha', 'sales:view_history_lojinha',
  ],
  
  lanchonete: [
    'accounts:view_all', 'accounts:view_own',
    'products:view', 'products:create_lanchonete', 'products:update_lanchonete', 'products:delete_lanchonete',
    'sales:create_lanchonete', 'sales:view_history_lanchonete',
  ],
  
  comunicacao: [
    'accounts:view_all', 'accounts:view_own', 'accounts:adjust_balance', 'accounts:debit_balance',
  ],
  
  servico: [
    'accounts:view_own',
    'sales:view_own',
  ],
  
  encontrista: [
    'accounts:view_own',
    'sales:view_own',
  ],
}

export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role] || []
  return permissions.includes(permission)
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p))
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p))
}
