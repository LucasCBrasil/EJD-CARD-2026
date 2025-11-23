# 📋 RESUMO DE ROLES E PERMISSÕES

## ✅ ROLES FINAIS (6 ROLES)

### 1. **admin** - Administrador
**Acesso:** TUDO no sistema
- ✅ Ver todos os cartões
- ✅ Criar/editar cartões
- ✅ **ADICIONAR SALDO** (crédito/débito)
- ✅ **GERENCIAR PRODUTOS** (lojinha + lanchonete)
- ✅ **REALIZAR VENDAS** (lojinha + lanchonete + sapatinho)
- ✅ **VER HISTÓRICO** de todas as categorias
- ✅ **FAZER PEDIDOS** no Sapatinho Mágico ⭐
- ✅ **VER PEDIDOS** (lojinha + sapatinho)
- ✅ **MARCAR COMO ENTREGUE**
- ✅ Gerenciar usuários
- ✅ Ver relatórios

**Inclui:** Acesso total (superusuário)

---

### 2. **lojinha** - Equipe Lojinha (TUDO EM UM!)
**Acesso:** Tudo relacionado à lojinha + sapatinho
- ✅ Ver todos os cartões
- ✅ **GERENCIAR PRODUTOS** da lojinha (criar/editar/deletar)
- ✅ **REALIZAR VENDAS** na lojinha
- ✅ **REALIZAR VENDAS** no Sapatinho Mágico ⭐
- ✅ **VER HISTÓRICO** de vendas da lojinha
- ✅ **VER HISTÓRICO** de vendas do Sapatinho ⭐
- ✅ **FAZER PEDIDOS** no Sapatinho Mágico ⭐
- ✅ **VER PEDIDOS** (lojinha + sapatinho) ⭐
- ✅ **MARCAR COMO ENTREGUE** ⭐
- ❌ Não pode adicionar saldo
- ❌ Não pode gerenciar lanchonete
- ❌ Não pode criar/editar cartões

**Inclui:** Coordenadores + Vendedores + Entregadores da lojinha (tudo unificado!)

---

### 3. **lanchonete** - Equipe Lanchonete
**Acesso:** Tudo relacionado à lanchonete + pode vender sapatinho
- ✅ Ver todos os cartões
- ✅ **GERENCIAR PRODUTOS** da lanchonete (criar/editar/deletar)
- ✅ **REALIZAR VENDAS** na lanchonete
- ✅ **REALIZAR VENDAS** no Sapatinho Mágico ⭐
- ✅ **FAZER PEDIDOS** no Sapatinho Mágico ⭐
- ✅ **VER HISTÓRICO** de vendas da lanchonete
- ❌ NÃO vê histórico do Sapatinho
- ❌ NÃO vê pedidos do Sapatinho
- ❌ Não pode adicionar saldo
- ❌ Não pode gerenciar lojinha
- ❌ Não pode criar/editar cartões

**Inclui:** Coordenadores + Vendedores da lanchonete (unificados)

---

### 4. **comunicacao** - Comunicação
**Acesso:** Gestão de cartões + saldo + pode vender sapatinho
- ✅ Ver todos os cartões
- ✅ **CRIAR CARTÕES** (novos encontristas)
- ✅ **EDITAR CARTÕES** (dados cadastrais)
- ✅ **ADICIONAR SALDO** (crédito/débito)
- ✅ Ver todos os saldos
- ✅ **REALIZAR VENDAS** no Sapatinho Mágico ⭐
- ✅ **FAZER PEDIDOS** no Sapatinho Mágico ⭐
- ❌ NÃO deletamos cartões (nunca!)
- ❌ NÃO vê histórico do Sapatinho
- ❌ NÃO vê pedidos
- ❌ Não pode gerenciar produtos
- ❌ Não pode vender em lojinha/lanchonete

---

### 5. **servico** - Serviço 🆕
**Acesso:** Cartão próprio + pode fazer pedidos no Sapatinho
- ✅ Ver próprio cartão
- ✅ Ver próprio saldo
- ✅ Ver próprio histórico de compras
- ✅ **FAZER PEDIDOS** no Sapatinho Mágico ⭐ (como cliente)
- ❌ NÃO pode vender
- ❌ NÃO vê outros cartões
- ❌ NÃO pode adicionar saldo
- ❌ NÃO vê pedidos de outros

**Inclui:** Pessoas do serviço que precisam fazer pedidos no Sapatinho

---

### 6. **encontrista** - Encontrista (usuário padrão)
**Acesso:** Ver próprio cartão e histórico
- ✅ Ver próprio cartão
- ✅ Ver próprio saldo
- ✅ Ver próprio histórico de compras
- ❌ **NÃO usa Sapatinho** (nem vender, nem fazer pedidos) 🚫
- ❌ NÃO pode vender
- ❌ NÃO vê outros cartões
- ❌ NÃO pode adicionar saldo

---

## 📊 TABELA COMPLETA DE PERMISSÕES

| Permissão | admin | **lojinha** | **lanchonete** | comunicacao | **servico** | encontrista |
|-----------|-------|-------------|----------------|-------------|-------------|-------------|
| Ver todos cartões | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Criar cartões | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Editar cartões | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Ver todos saldos | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Adicionar saldo** | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Produtos lojinha** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Produtos lanchonete** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Vender lojinha** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Vender lanchonete** | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Vender Sapatinho ⭐** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Fazer pedidos Sapatinho ⭐** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Histórico lojinha** | ✅ | ✅ | ❌ | ❌ | ❌ | Próprio |
| **Histórico lanchonete** | ✅ | ❌ | ✅ | ❌ | ❌ | Próprio |
| **Histórico Sapatinho** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Pedidos** (lojinha+sapatinho) | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Entregas** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 🔄 MUDANÇAS (SIMPLIFICAÇÃO FINAL)

### ❌ REMOVIDOS:
- `genios_card` → Era igual a admin
- `coord_lojinha` + `vendedor_lojinha` + `entregador_lojinha` → **Unificados em `lojinha`**
- `coord_lanchonete` + `vendedor_lanchonete` → Unificados em `lanchonete`
- `guest` → Era o mesmo que `encontrista`

### ✅ ADICIONADO:
- `servico` → Novo role para pessoas do serviço que podem fazer pedidos no Sapatinho

### ✅ BENEFÍCIOS:
- ✅ Apenas **6 roles** no total (bem simples!)
- ✅ Mais simples de entender e gerenciar
- ✅ **Lojinha** faz TUDO (vender + gerenciar + entregar)
- ✅ **Lanchonete** faz TUDO da lanchonete
- ✅ Não precisa diferenciar coordenador, vendedor ou entregador
- ✅ **Servico** tem acesso ao Sapatinho como cliente

---

## 🎯 CASOS DE USO

### Cenário 1: Vender na Lojinha
- **Quem pode?** `admin`, `lojinha`
- **Permissão:** `canSellLojinha: true`

### Cenário 2: Adicionar Saldo
- **Quem pode?** `admin`, `comunicacao`
- **Permissão:** `canAddBalance: true`

### Cenário 3: Ver Todos os Cartões
- **Quem pode?** `admin`, `lojinha`, `lanchonete`, `comunicacao`
- **Permissão:** `canViewCards: true`

### Cenário 4: Gerenciar Produtos da Lojinha
- **Quem pode?** `admin`, `lojinha`
- **Permissão:** `canManageProductsLojinha: true`

### Cenário 5: Fazer Pedidos no Sapatinho Mágico
- **Quem pode?** `admin`, `lojinha`, `lanchonete`, `comunicacao`, `servico`
- **Permissão:** `canPlaceOrderSapatinho: true`
- **NÃO pode:** `encontrista` 🚫

---

## 🔐 IMPLEMENTAÇÃO TÉCNICA

### Arquivos Principais
1. **`src/lib/roles.ts`** - Definição de roles e permissões (frontend)
2. **`src/server/permissions.ts`** - Definição de permissões (backend Express)
3. **`supabase/functions/_shared/roles.ts`** - Definição de roles (Edge Functions)
4. **`supabase/migrations/20251121_enable_rls.sql`** - Row Level Security (RLS)

### Edge Functions (Segurança)
- `make-sale` - Validação de vendas
- `update-balance` - Validação de saldo
- `manage-products` - Validação de produtos

### Como Usar
```typescript
import { hasPermission, getUserPermissions } from '@/lib/roles'

// Verificar uma permissão
if (hasPermission(userRole, 'canSellLojinha')) {
  // Pode vender na lojinha
}

// Obter todas as permissões
const permissions = getUserPermissions(userRole)
```

---

## 📝 NOTAS IMPORTANTES

1. **Nunca deletamos cartões!** ❌
2. **Comunicação** pode fazer CRUD de cartões (exceto deletar)
3. **Sapatinho Mágico:**
   - Todos podem **vender**, exceto `encontrista` e `servico`
   - Todos podem **fazer pedidos**, exceto `encontrista`
   - Apenas `admin` e `lojinha` veem histórico e pedidos
4. **Lojinha** = coordenadores + vendedores + entregadores (tudo em um!)
5. **Servico** = novo role para fazer pedidos no Sapatinho como cliente
