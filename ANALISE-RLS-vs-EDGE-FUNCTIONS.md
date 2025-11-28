# 🔍 Análise: RLS vs Edge Functions

## ✅ Resposta: SIM, pode bloquear tudo!

**Motivo:** Todas as Edge Functions usam `SUPABASE_SERVICE_ROLE_KEY`, que **bypassa completamente o RLS**.

---

## 📊 Situação Atual

### ✅ **Frontend → Edge Functions (OK)**
- **Arquivo:** `src/lib/api-client.ts`
- **Método:** Faz chamadas HTTP para Edge Functions
- **Segurança:** ✅ Não acessa banco diretamente
- **RLS:** ❌ Não afeta (não acessa banco)

### ✅ **Edge Functions → Banco (OK)**
- **Arquivo:** `supabase/functions/_shared/supabase.ts`
- **Método:** Usa `SUPABASE_SERVICE_ROLE_KEY`
- **Segurança:** ✅ Service key bypassa RLS
- **RLS:** ❌ **Não afeta Edge Functions** (usam service key)

### ⚠️ **Frontend bloqueado (OK)**
- **Arquivo:** `src/lib/supabase.ts`
- **Status:** ✅ Queries diretas **bloqueadas** (lança erro)
- **Código:**
  ```typescript
  from: () => {
    throw new Error('⚠️ Chamadas diretas ao Supabase foram desabilitadas por segurança.')
  }
  ```

---

## 🔍 Casos Especiais Encontrados

### 1. **Storage (Upload de Imagens)**
**Arquivo:** `src/services/productService.ts` (linha 125-163)

**Status:** ⚠️ Usa Storage diretamente, mas:
- Storage tem **políticas próprias** (não RLS de tabelas)
- Comentário no código: "TODO: Criar Edge Function 'upload-product-image'"

**Recomendação:** Migrar para Edge Function para consistência.

---

### 2. **Webhook PIX**
**Arquivo:** `src/api/webhooks/pix.ts`

**Status:** ⚠️ **Precisa ser migrado para Edge Function**

**Problema:** 
- Código tem comentário: "⚠️ NOTA: Webhooks geralmente rodam no SERVIDOR"
- Atualmente tenta usar `supabase.from()` que está bloqueado
- Não vai funcionar no estado atual

**Recomendação:** 
- ✅ Criar Edge Function `pix-webhook`
- ✅ Migrar lógica para lá
- ✅ Usar service key na Edge Function

---

### 3. **tRPC Router (Backend)**
**Arquivo:** `src/server/routers/sales.ts`

**Status:** ⚠️ **Problema potencial**

**Problema:**
- Usa `ctx.supabase` que vem de `src/lib/supabase.ts`
- Esse arquivo bloqueia `.from()` → **vai quebrar!**
- Parece não estar sendo usado (não encontrei chamadas no frontend)

**Recomendação:**
- Se não está sendo usado: ✅ Remover
- Se está sendo usado: Migrar para usar service key ou Edge Functions

---

## 🎯 Conclusão e Recomendações

### ✅ **Pode bloquear tudo no RLS?**

**SIM!** Porque:

1. ✅ **Edge Functions usam service key** → Bypassam RLS
2. ✅ **Frontend não acessa banco diretamente** → Bloqueado
3. ✅ **Tudo passa por Edge Functions** → Seguro

### 📝 **O que fazer:**

#### 1. **Bloquear tudo no RLS** (Recomendado)
```sql
-- Remover todas as políticas permissivas
-- Deixar apenas políticas que bloqueiam tudo para 'public'
-- Edge Functions continuarão funcionando (service key)

-- Exemplo para cada tabela:
DROP POLICY IF EXISTS "Users can manage X" ON table_name;
-- ... remover todas as políticas permissivas
```

#### 2. **Criar políticas mínimas** (Opcional)
Se quiser manter alguma proteção extra:
```sql
-- Apenas bloquear acesso direto (Edge Functions continuam funcionando)
CREATE POLICY "block_public_access" ON table_name
  FOR ALL
  TO public
  USING (false);  -- Bloqueia tudo para 'public'
```

#### 3. **Migrar casos especiais**
- ✅ Webhook PIX → Edge Function
- ✅ Upload de imagens → Edge Function (opcional, Storage já tem políticas)
- ⚠️ Verificar se tRPC está sendo usado

---

## 🔒 Estratégia Recomendada

### **Opção 1: Bloquear tudo (Mais Seguro)**
```sql
-- Para cada tabela crítica:
CREATE POLICY "block_all_public" ON cards FOR ALL TO public USING (false);
CREATE POLICY "block_all_public" ON transactions FOR ALL TO public USING (false);
CREATE POLICY "block_all_public" ON sales FOR ALL TO public USING (false);
-- ... etc
```

**Vantagens:**
- ✅ Máxima segurança
- ✅ Edge Functions continuam funcionando (service key)
- ✅ Nenhum acesso direto possível

**Desvantagens:**
- ⚠️ Se alguém tentar acessar diretamente, vai falhar (mas isso é bom!)

---

### **Opção 2: Manter políticas mínimas (Mais Flexível)**
Manter políticas básicas mas restritivas:
- SELECT apenas para dados próprios
- INSERT/UPDATE/DELETE bloqueados para 'public'

**Vantagens:**
- ✅ Alguma proteção se alguém tentar acesso direto
- ✅ Edge Functions continuam funcionando

**Desvantagens:**
- ⚠️ Mais complexo de manter
- ⚠️ Políticas podem ter bugs

---

## ✅ **Recomendação Final**

**BLOQUEAR TUDO** porque:

1. ✅ Arquitetura já está correta (Edge Functions)
2. ✅ Frontend já está bloqueado
3. ✅ Edge Functions usam service key (bypass RLS)
4. ✅ Mais simples e seguro
5. ✅ Menos superfície de ataque

**Próximos passos:**
1. Migrar webhook PIX para Edge Function
2. Verificar se tRPC está sendo usado
3. Criar migration para bloquear tudo no RLS
4. Testar que Edge Functions continuam funcionando

---

## 📋 Checklist de Migração

- [ ] Migrar webhook PIX para Edge Function
- [ ] Verificar uso do tRPC router
- [ ] Criar migration para bloquear RLS
- [ ] Testar Edge Functions após bloqueio
- [ ] Documentar que RLS está bloqueado (Edge Functions usam service key)
- [ ] (Opcional) Migrar upload de imagens para Edge Function

