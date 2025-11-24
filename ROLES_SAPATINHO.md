# 🏃‍♂️ SAPATINHO MÁGICO - PERMISSÕES POR ROLE

## 📜 REGRAS GERAIS

### 1. Vender no Sapatinho
**Todos podem VENDER**, EXCETO:
- ❌ `encontrista` (NÃO vende)
- ❌ `servico` (NÃO vende, só faz pedidos)

### 2. Fazer Pedidos no Sapatinho
**Todos podem FAZER PEDIDOS**, EXCETO:
- ❌ `encontrista` (NÃO usa sapatinho de forma alguma)

### 3. Histórico e Pedidos
**Só a equipe LOJINHA** vê histórico e pedidos do Sapatinho:
- **admin** - Vê tudo
- **lojinha** - Vê tudo do sapatinho (histórico + pedidos + entregas)

**Lanchonete NÃO vê:**
- Pode vender no sapatinho
- Mas NÃO vê histórico nem pedidos

---

## 📊 TABELA DE PERMISSÕES

| Role | Vender | Fazer Pedidos | Ver Histórico | Ver Pedidos | Marcar Entregue |
|------|--------|---------------|---------------|-------------|-----------------|
| admin | ✅ | ✅ | ✅ | ✅ | ✅ |
| lojinha | ✅ | ✅ | ✅ | ✅ | ✅ |
| lanchonete | ✅ | ✅ | ❌ | ❌ | ❌ |
| comunicacao | ✅ | ✅ | ❌ | ❌ | ❌ |
| **servico** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **encontrista** | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 🎯 CASOS DE USO

### Cenário 1: Admin
```
✅ Pode: Fazer venda no Sapatinho Mágico
✅ Pode: Fazer pedidos no Sapatinho
✅ Pode: Ver histórico completo
✅ Pode: Ver todos os pedidos
✅ Pode: Marcar como entregue
```

### Cenário 2: Equipe da Comunicação
```
✅ Pode: Fazer venda no Sapatinho Mágico
✅ Pode: Fazer pedidos no Sapatinho
❌ Não pode: Ver histórico
❌ Não pode: Ver pedidos
```

### Cenário 3: Equipe da Lojinha (TUDO EM UM!)
```
✅ Pode: Fazer venda no Sapatinho Mágico
✅ Pode: Fazer pedidos no Sapatinho
✅ Pode: Ver histórico completo
✅ Pode: Ver todos os pedidos
✅ Pode: Marcar como entregue
✅ Inclui: Coordenadores, vendedores e entregadores
```

### Cenário 4: Equipe da Lanchonete
```
✅ Pode: Fazer venda no Sapatinho Mágico
✅ Pode: Fazer pedidos no Sapatinho
❌ Não pode: Ver histórico
❌ Não pode: Ver pedidos
```

### Cenário 5: Serviço (NOVO!)
```
❌ Não pode: Vender no Sapatinho
✅ Pode: Fazer pedidos no Sapatinho (como cliente)
❌ Não pode: Ver histórico geral
❌ Não pode: Ver pedidos de outros
✅ Pode: Ver próprio histórico
```

### Cenário 6: Encontrista
```
❌ Não pode: Vender no Sapatinho
❌ Não pode: Fazer pedidos no Sapatinho
❌ Não pode: Ver histórico
❌ Não usa o Sapatinho de forma alguma
✅ Pode: Ver próprio histórico de compras (outros locais)
```

---

## 🔐 IMPLEMENTAÇÃO TÉCNICA

### Permissões no Código

```typescript
// src/lib/roles.ts
export interface RolePermissions {
  canSellSapatinho: boolean          // Vender produtos do sapatinho
  canPlaceOrderSapatinho: boolean    // FAZER pedido no sapatinho (como cliente)
  canViewSalesHistorySapatinho: boolean
  canViewOpenOrders: boolean
  canMarkAsDelivered: boolean
}

// Exemplos:
lojinha: {
  canSellSapatinho: true,              // ✅ Pode vender
  canPlaceOrderSapatinho: true,        // ✅ Pode fazer pedidos
  canViewSalesHistorySapatinho: true,  // ✅ Vê histórico
  canViewOpenOrders: true,              // ✅ Vê pedidos
  canMarkAsDelivered: true,             // ✅ Marca entregue
}

lanchonete: {
  canSellSapatinho: true,              // ✅ Pode vender
  canPlaceOrderSapatinho: true,        // ✅ Pode fazer pedidos
  canViewSalesHistorySapatinho: false, // ❌ NÃO vê histórico
  canViewOpenOrders: false,             // ❌ NÃO vê pedidos
  canMarkAsDelivered: false,
}

servico: {
  canSellSapatinho: false,             // ❌ NÃO vende
  canPlaceOrderSapatinho: true,        // ✅ Pode fazer pedidos
  canViewSalesHistorySapatinho: false,
  canViewOpenOrders: false,
  canMarkAsDelivered: false,
}

encontrista: {
  canSellSapatinho: false,             // ❌ NÃO vende
  canPlaceOrderSapatinho: false,       // ❌ NÃO faz pedidos
  canViewSalesHistorySapatinho: false,
  canViewOpenOrders: false,
  canMarkAsDelivered: false,
}
```

---

## 📝 NOTAS IMPORTANTES

1. **Encontrista NÃO usa o Sapatinho** de forma alguma 🚫
2. **Servico** é um novo role para pessoas que precisam fazer pedidos no Sapatinho (como clientes)
3. Apenas **admin** e **lojinha** veem histórico e pedidos completos
4. **Lanchonete** pode vender e fazer pedidos, mas NÃO vê histórico nem pedidos
5. **Comunicacao** pode vender e fazer pedidos, mas NÃO vê histórico nem pedidos
6. **Lojinha** faz tudo: vende, faz pedidos, vê histórico, gerencia pedidos e marca entregas

---

## 🚀 FLUXO DE TRABALHO

### Para Vendas (Vendedor)
1. `admin`, `lojinha`, `lanchonete`, `comunicacao` podem fazer vendas
2. Usuário escolhe produtos
3. Sistema debita do cartão do comprador
4. Registro salvo no histórico

### Para Pedidos (Cliente)
1. `admin`, `lojinha`, `lanchonete`, `comunicacao`, `servico` podem fazer pedidos
2. Cliente escolhe produtos
3. Pedido criado e fica pendente
4. Apenas `admin` e `lojinha` veem os pedidos
5. Apenas `admin` e `lojinha` podem marcar como entregue

### Exceção: Encontrista
- NÃO faz vendas
- NÃO faz pedidos
- Apenas vê próprio histórico de compras (de outros locais)
