#!/bin/bash

# Script para testar Edge Functions localmente
# Uso: ./scripts/test-functions.sh [TOKEN]

# Cores
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuração
BASE_URL="${SUPABASE_FUNCTIONS_URL:-http://localhost:54321/functions/v1}"
TOKEN="${1:-${SUPABASE_TOKEN}}"

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Erro: Token JWT não fornecido${NC}"
  echo ""
  echo "Uso:"
  echo "  ./scripts/test-functions.sh SEU_TOKEN_JWT"
  echo ""
  echo "Ou configure a variável:"
  echo "  export SUPABASE_TOKEN=seu_token_aqui"
  echo "  ./scripts/test-functions.sh"
  echo ""
  exit 1
fi

echo -e "${BLUE}🧪 Testando Edge Functions em ${BASE_URL}${NC}\n"

# Função auxiliar para fazer requisições
test_function() {
  local name=$1
  local method=$2
  local path=$3
  local body=$4
  local description=$5

  echo -e "${YELLOW}Teste: ${name}${NC}"
  echo "  ${description}"
  
  if [ -n "$body" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL/$path" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Origin: http://localhost:5173" \
      -H "Content-Type: application/json" \
      -d "$body")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL/$path" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Origin: http://localhost:5173" \
      -H "Content-Type: application/json")
  fi

  http_code=$(echo "$response" | tail -n1)
  response_body=$(echo "$response" | sed '$d')

  if [ "$http_code" == "200" ] || [ "$http_code" == "201" ]; then
    echo -e "  ${GREEN}✅ Sucesso ($http_code)${NC}"
    if command -v jq &> /dev/null; then
      echo "$response_body" | jq '.' 2>/dev/null || echo "  $response_body"
    else
      echo "  $response_body"
    fi
  elif [ "$http_code" == "401" ]; then
    echo -e "  ${RED}❌ Não autenticado (401)${NC}"
    echo "  Token inválido ou expirado"
  elif [ "$http_code" == "403" ]; then
    echo -e "  ${RED}❌ Sem permissão (403)${NC}"
    echo "  Usuário não tem permissão para esta ação"
  else
    echo -e "  ${RED}❌ Erro ($http_code)${NC}"
    echo "  $response_body"
  fi
  echo ""
}

# Verificar se Supabase está rodando
if ! curl -s "$BASE_URL" > /dev/null 2>&1; then
  echo -e "${RED}❌ Erro: Não foi possível conectar em ${BASE_URL}${NC}"
  echo ""
  echo "Certifique-se de que o Supabase está rodando:"
  echo "  supabase start"
  echo "  supabase functions serve"
  echo ""
  exit 1
fi

echo -e "${GREEN}✅ Conectado ao Supabase local${NC}\n"

# Teste 1: get-user-profile
test_function \
  "get-user-profile" \
  "GET" \
  "get-user-profile" \
  "" \
  "Deve retornar perfil do usuário autenticado"

# Teste 2: list-products (sem categoria)
test_function \
  "list-products (todas)" \
  "GET" \
  "list-products" \
  "" \
  "Deve retornar todos os produtos"

# Teste 3: list-products (com categoria)
test_function \
  "list-products (lojinha)" \
  "GET" \
  "list-products?category=lojinha" \
  "" \
  "Deve retornar produtos da lojinha"

# Teste 4: list-cards
test_function \
  "list-cards" \
  "GET" \
  "list-cards" \
  "" \
  "Deve retornar cartões (filtrados por usuário)"

# Teste 5: manage-users (GET - apenas admin)
test_function \
  "manage-users (buscar)" \
  "GET" \
  "manage-users?email=test" \
  "" \
  "Deve buscar usuários por email (apenas admin)"

# Teste 6: OPTIONS (CORS)
echo -e "${YELLOW}Teste: CORS (OPTIONS)${NC}"
cors_response=$(curl -s -w "\n%{http_code}" -X "OPTIONS" "$BASE_URL/list-products" \
  -H "Origin: http://localhost:5173")
cors_code=$(echo "$cors_response" | tail -n1)
if [ "$cors_code" == "200" ]; then
  echo -e "  ${GREEN}✅ CORS configurado corretamente (200)${NC}"
else
  echo -e "  ${RED}❌ CORS com problema ($cors_code)${NC}"
fi
echo ""

echo -e "${GREEN}✅ Testes concluídos!${NC}"
echo ""
echo "Notas:"
echo "- Testes com 401/403 podem ser esperados dependendo do usuário"
echo "- Funções que precisam de dados específicos podem falhar"
echo "- Verifique os logs do 'supabase functions serve' para mais detalhes"

