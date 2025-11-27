# 📝 Mudanças nas Edge Functions Existentes

## Resumo das Alterações

As seguintes Edge Functions existentes foram **atualizadas** para melhorar a segurança. Elas precisam ser **redeployadas** para aplicar as mudanças.

## Funções Afetadas

1. ✅ `manage-products` - CORS restrito
2. ✅ `make-sale` - CORS restrito
3. ✅ `update-balance` - CORS restrito
4. ✅ `sapatinho-order-` - CORS restrito

## O Que Mudou?

### Antes (INSEGURO):
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // ❌ Permite qualquer origem
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
```

### Depois (SEGURO):
```typescript
import { getCorsHeaders } from '../_shared/cors.ts'

const origin = req.headers.get('origin')
// Usa getCorsHeaders(origin) que valida contra ALLOWED_ORIGINS
headers: { ...getCorsHeaders(origin), 'Content-Type': 'application/json' }
```

## Mudanças Específicas por Função

### 1. `manage-products/index.ts`
- ✅ Importa `getCorsHeaders` de `_shared/cors.ts`
- ✅ Substitui `corsHeaders` fixo por `getCorsHeaders(origin)`
- ✅ Valida origem em todas as respostas

### 2. `make-sale/index.ts`
- ✅ Importa `getCorsHeaders` de `_shared/cors.ts`
- ✅ Substitui `corsHeaders` fixo por `getCorsHeaders(origin)`
- ✅ Valida origem em todas as respostas

### 3. `update-balance/index.ts`
- ✅ Importa `getCorsHeaders` de `_shared/cors.ts`
- ✅ Substitui `corsHeaders` fixo por `getCorsHeaders(origin)`
- ✅ Valida origem em todas as respostas

### 4. `sapatinho-order-/index.ts`
- ✅ Importa `getCorsHeaders` de `_shared/cors.ts`
- ✅ Substitui `corsHeaders` fixo por `getCorsHeaders(origin)`
- ✅ Valida origem em todas as respostas

## Novo Arquivo Criado

### `supabase/functions/_shared/cors.ts`
Este arquivo centraliza a lógica de CORS:
- Lê a variável de ambiente `ALLOWED_ORIGINS`
- Valida se a origem da requisição está autorizada
- Retorna headers CORS apropriados

## O Que Você Precisa Fazer

### 1. Configurar Variável de Ambiente

**IMPORTANTE**: Antes de fazer redeploy, configure `ALLOWED_ORIGINS` no Supabase:

1. Acesse: **Supabase Dashboard** → **Edge Functions** → **Settings**
2. Adicione a variável:
   - Nome: `ALLOWED_ORIGINS`
   - Valor: Seus domínios separados por vírgula
     - Produção: `https://seu-dominio.com,https://www.seu-dominio.com`
     - Desenvolvimento: `http://localhost:5173,http://localhost:3000`
     - Ambos: `https://seu-dominio.com,https://www.seu-dominio.com,http://localhost:5173`

### 2. Redeploy das Funções

```bash
# Redeploy das funções atualizadas
supabase functions deploy manage-products
supabase functions deploy make-sale
supabase functions deploy update-balance
supabase functions deploy sapatinho-order-
```

## Impacto das Mudanças

### ✅ Benefícios
- **Segurança melhorada**: Apenas origens autorizadas podem fazer requisições
- **Proteção contra CSRF**: Requisições de domínios não autorizados são bloqueadas
- **Controle de acesso**: Você controla quais domínios podem usar suas APIs

### ⚠️ Atenção
- **Requisitos**: Requisições precisam incluir o header `Origin`
- **Configuração obrigatória**: `ALLOWED_ORIGINS` DEVE ser configurado antes do deploy
- **Compatibilidade**: Navegadores sempre enviam `Origin`, mas testes com `curl` precisam incluir o header

## Teste Após Deploy

Após redeployar, teste para garantir que tudo funciona:

```bash
# Teste com origem autorizada
curl -X GET https://seu-project.supabase.co/functions/v1/manage-products \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Origin: https://seu-dominio.com"

# Deve retornar 200 OK

# Teste com origem não autorizada
curl -X GET https://seu-project.supabase.co/functions/v1/manage-products \
  -H "Authorization: Bearer SEU_TOKEN" \
  -H "Origin: https://site-malicioso.com"

# Deve retornar erro de CORS
```

## Rollback (Se Necessário)

Se algo der errado, você pode fazer rollback:

1. No Supabase Dashboard, vá em **Edge Functions**
2. Selecione a função
3. Use a opção de "Revert to previous version" (se disponível)
4. Ou faça redeploy da versão anterior do código

## Checklist

Antes de considerar completo:

- [ ] Variável `ALLOWED_ORIGINS` configurada no Supabase Dashboard
- [ ] `manage-products` redeployada
- [ ] `make-sale` redeployada
- [ ] `update-balance` redeployada
- [ ] `sapatinho-order-` redeployada
- [ ] Todas as funções testadas com origem autorizada
- [ ] Verificado que origens não autorizadas são bloqueadas

---

**Última atualização**: 2025-01-XX
**Status**: Pronto para redeploy ✅

