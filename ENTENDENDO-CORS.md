# 🌐 Entendendo CORS - Explicação Simples

## O Que é CORS?

**CORS** = **Cross-Origin Resource Sharing** (Compartilhamento de Recursos entre Origens Diferentes)

É um mecanismo de **segurança** dos navegadores que controla quais sites podem fazer requisições para sua API.

## Por Que Existe?

Imagine este cenário:

```
🌐 Você está navegando em: https://site-malicioso.com
🤖 Esse site tenta fazer requisição para: https://seu-site.com/api/dados
```

Sem CORS, qualquer site poderia:
- Fazer requisições para sua API
- Roubar dados dos seus usuários
- Fazer ações em nome dos seus usuários (se eles estiverem logados)

## Como Funciona?

### Exemplo Prático

**Cenário 1: Requisição Normal (Mesmo Domínio)**
```
Frontend: https://meusite.com
API:      https://meusite.com/api/dados
✅ Funciona! (mesma origem)
```

**Cenário 2: Requisição Cross-Origin (Domínios Diferentes)**
```
Frontend: https://meusite.com
API:      https://api.meusite.com/dados
⚠️ Navegador bloqueia! (origens diferentes)
```

**Cenário 3: Com CORS Configurado**
```
Frontend: https://meusite.com
API:      https://api.meusite.com/dados
Headers:  Access-Control-Allow-Origin: https://meusite.com
✅ Funciona! (CORS permite)
```

## O Problema que Você Tinha

### ❌ ANTES (Inseguro):

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',  // ⚠️ PERIGOSO!
}
```

**O que isso significa?**
- `*` = Qualquer site pode fazer requisições para sua API
- Qualquer pessoa pode criar um site e chamar suas APIs
- Qualquer pessoa pode roubar dados dos seus usuários

**Exemplo do Problema:**
```
1. Atacante cria: https://site-roubo.com
2. Site faz requisição para: https://seu-api.com/functions/v1/list-cards
3. Seu servidor responde: ✅ (porque CORS permite *)
4. Atacante rouba dados! 😱
```

### ✅ AGORA (Seguro):

```typescript
const getAllowedOrigins = () => {
  const allowed = Deno.env.get('ALLOWED_ORIGINS') || 'http://localhost:5173'
  return allowed.split(',').map(o => o.trim())
}

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigins = getAllowedOrigins()
  const allowOrigin = origin && allowedOrigins.includes(origin) 
    ? origin  // ✅ Se está na lista, permite
    : allowedOrigins[0]  // ❌ Se não está, nega
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
  }
}
```

**O que isso significa?**
- Apenas domínios na lista `ALLOWED_ORIGINS` podem fazer requisições
- Se alguém tentar de outro domínio, o navegador bloqueia
- Seus dados estão protegidos! 🛡️

**Exemplo Seguro:**
```
1. Seu site faz requisição: https://seu-site.com → sua API
   ✅ Permite! (está na lista ALLOWED_ORIGINS)

2. Atacante tenta: https://site-roubo.com → sua API
   ❌ Navegador bloqueia! (não está na lista)

3. Seus dados estão seguros! 🔒
```

## Headers CORS Importantes

### `Access-Control-Allow-Origin`
**O que faz:** Define quais domínios podem fazer requisições

**Valores:**
- `*` = Qualquer domínio (⚠️ inseguro)
- `https://meusite.com` = Apenas esse domínio (✅ seguro)
- `https://meusite.com, https://www.meusite.com` = Múltiplos domínios

### `Access-Control-Allow-Methods`
**O que faz:** Define quais métodos HTTP são permitidos
- Exemplo: `GET, POST, PUT, DELETE`

### `Access-Control-Allow-Headers`
**O que faz:** Define quais headers podem ser enviados
- Exemplo: `authorization, content-type`

## Como o Navegador Verifica CORS?

```
1. 🌐 Navegador envia requisição com header: Origin: https://meusite.com

2. 🔍 Servidor verifica se https://meusite.com está na lista permitida

3a. ✅ Se SIM:
    - Servidor retorna: Access-Control-Allow-Origin: https://meusite.com
    - Navegador permite a requisição

3b. ❌ Se NÃO:
    - Servidor retorna: Access-Control-Allow-Origin: outro-dominio
    - Navegador BLOQUEIA a requisição
    - Você vê erro no console: "CORS policy blocked"
```

## Preflight Requests (OPTIONS)

Antes de fazer requisições "complexas" (POST, PUT, DELETE), o navegador envia uma requisição **OPTIONS** para verificar se pode fazer:

```
1. Navegador envia: OPTIONS /api/dados
2. Servidor responde: ✅ Sim, você pode fazer POST
3. Navegador envia: POST /api/dados
4. Servidor processa normalmente
```

Por isso você vê no código:
```typescript
if (req.method === 'OPTIONS') {
  return new Response('ok', { headers: getCorsHeaders(origin) })
}
```

## Por Que Você Precisa Configurar ALLOWED_ORIGINS?

### Cenário Real:

**Desenvolvimento:**
- Frontend roda em: `http://localhost:5173`
- Precisa chamar API em: `https://seu-projeto.supabase.co`

**Produção:**
- Frontend roda em: `https://seu-site.com`
- Precisa chamar API em: `https://seu-projeto.supabase.co`

**Solução:**
```bash
# Variável de ambiente ALLOWED_ORIGINS
ALLOWED_ORIGINS=https://seu-site.com,http://localhost:5173
```

Assim você permite:
- ✅ Seu site de produção
- ✅ Seu ambiente de desenvolvimento local
- ❌ Qualquer outro site malicioso

## Resumo Visual

```
┌─────────────────────────────────────────┐
│   ANTES (Inseguro)                      │
├─────────────────────────────────────────┤
│  CORS: *                                │
│                                         │
│  🌐 site1.com     →  ✅ API funciona   │
│  🌐 site2.com     →  ✅ API funciona   │
│  🌐 hacker.com    →  ✅ API funciona   │  ⚠️ PERIGO!
│  🌐 qualquer.com  →  ✅ API funciona   │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│   AGORA (Seguro)                        │
├─────────────────────────────────────────┤
│  CORS: seu-site.com, localhost          │
│                                         │
│  🌐 seu-site.com  →  ✅ API funciona   │
│  🌐 localhost     →  ✅ API funciona   │
│  🌐 hacker.com    →  ❌ BLOQUEADO      │  ✅ SEGURO!
│  🌐 qualquer.com  →  ❌ BLOQUEADO      │
└─────────────────────────────────────────┘
```

## Comparação com a Vida Real

**CORS é como um porteiro de prédio:**

### ❌ ANTES (CORS: *)
```
Porteiro: "Qualquer pessoa pode entrar!"
- Você: ✅ Entra
- Seu amigo: ✅ Entra
- Ladrão: ✅ Entra também! 😱
```

### ✅ AGORA (CORS restrito)
```
Porteiro: "Apenas moradores e visitantes autorizados!"
Lista: - Você
       - Seu amigo
       
- Você: ✅ Entra (está na lista)
- Seu amigo: ✅ Entra (está na lista)
- Ladrão: ❌ BLOQUEADO! (não está na lista) 🛡️
```

## Resumo Final

1. **CORS é segurança** - Protege sua API de acessos não autorizados
2. **`*` é perigoso** - Permite qualquer site acessar
3. **Lista específica é seguro** - Apenas sites autorizados podem acessar
4. **ALLOWED_ORIGINS** - É onde você define quem pode acessar
5. **Navegador verifica** - Bloqueia automaticamente tentativas não autorizadas

## Próximos Passos

Agora que você entende CORS:

1. ✅ Configure `ALLOWED_ORIGINS` no Supabase Dashboard
2. ✅ Faça redeploy das funções
3. ✅ Teste com seu domínio (deve funcionar)
4. ✅ Teste com outro domínio (deve ser bloqueado)

---

**Resumo em uma frase:** 
CORS é como um porteiro que só deixa entrar pessoas que estão na lista de convidados, protegendo sua API de sites maliciosos.

