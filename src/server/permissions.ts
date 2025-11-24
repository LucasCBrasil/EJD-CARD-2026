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
  // Cartões
  | 'cards:view_all'
  | 'cards:view_own'
  | 'cards:create'
  | 'cards:update'
  | 'cards:delete'
  | 'cards:add_balance'
  | 'cards:debit_balance'
  // Produtos
  | 'products:view'
  | 'products:create_lojinha'
  | 'products:create_lanchonete'
  | 'products:create_sapatinho'
  | 'products:update_lojinha'
  | 'products:update_lanchonete'
  | 'products:update_sapatinho'
  | 'products:delete_lojinha'
  | 'products:delete_lanchonete'
  | 'products:delete_sapatinho'
  // Vendas
  | 'sales:create_lojinha'
  | 'sales:create_lanchonete'
  | 'sales:create_sapatinho'
  | 'sales:view_history_lojinha'
  | 'sales:view_history_lanchonete'
  | 'sales:view_history_sapatinho'
  | 'sales:view_own'
  // Pedidos
  | 'orders:view'
  | 'orders:mark_delivered'
  | 'orders:place_sapatinho'  // Fazer pedidos no Sapatinho
  // Admin
  | 'admin:manage_users'
  | 'admin:view_reports'

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  admin: [
    'cards:view_all', 'cards:create', 'cards:update', 'cards:delete',
    'cards:add_balance', 'cards:debit_balance',
    'products:view', 'products:create_lojinha', 'products:create_lanchonete', 'products:create_sapatinho',
    'products:update_lojinha', 'products:update_lanchonete', 'products:update_sapatinho',
    'products:delete_lojinha', 'products:delete_lanchonete', 'products:delete_sapatinho',
    'sales:create_lojinha', 'sales:create_lanchonete', 'sales:create_sapatinho',
    'sales:view_history_lojinha', 'sales:view_history_lanchonete', 'sales:view_history_sapatinho',
    'orders:view', 'orders:mark_delivered', 'orders:place_sapatinho',
    'admin:manage_users', 'admin:view_reports'
  ],
  
  lojinha: [
    'cards:view_all',
    'products:view', 'products:create_lojinha', 'products:update_lojinha', 'products:delete_lojinha',
    'sales:create_lojinha', 'sales:view_history_lojinha',
    'orders:place_sapatinho',
  ],
  
  lanchonete: [
    'cards:view_all',
    'products:view', 'products:create_lanchonete', 'products:update_lanchonete', 'products:delete_lanchonete',
    'sales:create_lanchonete', 'sales:view_history_lanchonete',
    'orders:place_sapatinho',
  ],
  
  comunicacao: [
    'cards:view_all', 'cards:create', 'cards:update', 'cards:add_balance',
    'orders:place_sapatinho',
  ],
  
  servico: [
    'cards:view_own',
    'sales:view_own',
    'orders:place_sapatinho',  // ✅ Pode fazer pedidos no sapatinho
  ],
  
  encontrista: [
    'cards:view_own',
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

