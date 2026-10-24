# Testes do Sistema

Este diretório contém scripts de teste para validar as funcionalidades do sistema.

## 🚀 Como Executar

### Testes Básicos (Lógica de Negócio)

Execute os testes que validam a lógica de negócio sem precisar de conexão com banco de dados:

```bash
npm run test
```

ou diretamente:

```bash
tsx tests/test-sistema.ts
```

## 📋 Testes Incluídos

A suíte completa contém **61 testes** organizados em categorias:

### 📦 Testes de Estoque (10 testes)
- Validação de estoque insuficiente, suficiente e exato
- Estoque zero, null e undefined
- Diminuição de estoque
- Prevenção de estoque negativo
- Múltiplos produtos

### 💰 Testes de Saldo (7 testes)
- Validação de saldo insuficiente, suficiente e exato
- Saldo zero e muito pequeno
- Cálculos com decimais
- Débito de saldo

### 🧮 Testes de Cálculos (5 testes)
- Cálculo de total simples e múltiplos itens
- Cálculos com decimais
- Cálculos com muitos itens
- Quantidade zero

### 🎫 Testes de Cupons e Descontos (5 testes)
- Desconto percentual (10%, 50%, 100%)
- Descontos com decimais
- Limitação de desconto maior que total

### 💵 Testes de Validação de Preço (5 testes)
- Preço correto, diferente e com tolerância
- Preço zero e negativo

### 📦 Testes de Produtos (3 testes)
- Produto ativo e inativo
- Produto sem controle de estoque

### 🔢 Testes de Quantidade (4 testes)
- Quantidade zero, negativa e positiva
- Quantidade muito grande

### 🔖 Testes de Códigos de Pedido (4 testes)
- Geração de código sequencial
- Formato de código (5 dígitos)
- Códigos grandes

### 📊 Testes de Status (4 testes)
- Status completed, delivered e pending
- Sincronização de status

### ✅ Testes de Validação de Dados (4 testes)
- Lista vazia e com itens
- ProductId vazio e válido

### 🔍 Testes de Edge Cases (6 testes)
- Venda com um item e muitos itens
- Quantidades e preços diferentes
- Formatação monetária

### 🏷️ Testes de Categorias (4 testes)
- Validação das categorias suportadas (lojinha, lanchonete)
- Rejeição de categorias inválidas ou legadas

## 📊 Resultado Esperado

Quando todos os testes passam, você verá:

```
═══════════════════════════════════════════════════════
🧪 Executando Testes Completos do Sistema
═══════════════════════════════════════════════════════

[... 61 testes executados ...]

═══════════════════════════════════════════════════════
📊 Resumo dos Testes
═══════════════════════════════════════════════════════
Total de Testes: 61
✅ Passou: 61 (100.0%)
❌ Falhou: 0

🎉 Todos os 61 testes passaram!
```

## 🔧 Adicionando Novos Testes

Para adicionar novos testes, edite o arquivo `test-sistema.ts` e adicione um novo método na classe `TestRunner`:

```typescript
async testNovoTeste() {
  // Sua lógica de teste aqui
  // Lance um erro se o teste falhar
  // Retorne normalmente se passar
}

// Depois adicione no método runAllTests():
await this.test('Nome do Teste', () => this.testNovoTeste())
```

## 📝 Notas

- Os testes atuais são **testes unitários** que validam apenas a lógica de negócio
- Eles **não requerem** conexão com banco de dados
- Eles **não fazem** chamadas HTTP ou requisições reais
- Para testes de integração com banco de dados, seria necessário configurar um ambiente de teste separado

## 🐛 Troubleshooting

Se os testes falharem:

1. Verifique se todas as dependências estão instaladas: `npm install`
2. Verifique se o `tsx` está instalado: `npm list tsx`
3. Se necessário, instale o tsx: `npm install --save-dev tsx`
4. Verifique os erros específicos no output dos testes
