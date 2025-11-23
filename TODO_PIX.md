# 🔮 TODO: Implementação PIX (Para Outro Dev)

## 📝 O QUE FALTA FAZER

A implementação do PIX foi **deixada para outro desenvolvedor**.

### O que precisa ser implementado:

1. **Edge Function: `pix-webhook`**
   - Receber confirmações de pagamento PIX
   - Validar assinatura do webhook (anti-fraude)
   - Adicionar saldo automaticamente ao cartão
   - Localização: `supabase/functions/pix-webhook/`

2. **Tabela no Banco: `pix_payments`**
   - Registrar todos os pagamentos PIX
   - Evitar duplicação de créditos
   - Migration SQL necessária

3. **Frontend: Tela de recarga**
   - Gerar QR Code PIX
   - Mostrar status do pagamento
   - Atualizar saldo automaticamente

---

## 🔒 SEGURANÇA PIX

O webhook PIX **deve usar Edge Function** para ser seguro:

```
Pagamento PIX → API do PIX (servidor deles)
                    ↓
         Webhook para Edge Function (sua nuvem)
                    ↓
         Valida assinatura (anti-fraude)
                    ↓
         Adiciona saldo no banco
```

**Importante:** O usuário **NUNCA** deve poder manipular o saldo via PIX. Tudo deve acontecer servidor → servidor.

---

## ✅ O QUE JÁ ESTÁ PRONTO

- ✅ Edge Function `update-balance` (para adicionar saldo manualmente)
- ✅ Sistema de roles (admin, genios_card, comunicacao podem adicionar saldo)
- ✅ RLS configurado (proteção do banco de dados)

O desenvolvedor só precisa:
1. Integrar com API do PIX escolhida
2. Criar webhook Edge Function
3. Criar tabela pix_payments
4. Criar UI de recarga

---

## 📚 REFERÊNCIAS ÚTEIS

- Documentação Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Validação de Webhook (HMAC): https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/sign
- Edge Functions já implementadas: `supabase/functions/make-sale/`, `update-balance/`, `manage-products/`

---

**Nota:** Quando implementar, seguir o mesmo padrão das Edge Functions existentes!

