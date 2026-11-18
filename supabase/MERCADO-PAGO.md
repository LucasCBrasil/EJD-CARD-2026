# Ativar recargas Pix pelo Mercado Pago

A interface local usa as variáveis VITE_SUPABASE_* de `.env.local`. O Access Token do Mercado Pago pertence somente ao servidor.

1. No painel do Supabase do projeto `adpkpzuhvrbfftlxabjd`, configure os secrets `MERCADO_PAGO_ACCESS_TOKEN` e `MERCADO_PAGO_WEBHOOK_SECRET`. O segundo é a assinatura secreta da configuração de Webhooks da aplicação no Mercado Pago. Não use prefixo VITE_ nesses secrets. Caso `ALLOWED_ORIGINS` já esteja configurado, acrescente `http://localhost:5173` e `http://127.0.0.1:5173`, preservando as origens de produção, para permitir o acesso local.
2. Aplique `supabase/migrations/20261117000000_mercadopago_pix_confirmation.sql` ao banco existente. Ela pressupõe as tabelas e a função `adjust_account_balance` de `supabase-setup.sql`. Em banco novo, use o setup completo.
3. Publique as funções:

```powershell
supabase functions deploy mercadopago-pix --project-ref adpkpzuhvrbfftlxabjd
supabase functions deploy mercadopago-webhook --no-verify-jwt --project-ref adpkpzuhvrbfftlxabjd
supabase functions deploy get-pix-status --project-ref adpkpzuhvrbfftlxabjd
supabase functions deploy list-accounts --project-ref adpkpzuhvrbfftlxabjd
supabase functions deploy my-account-history --project-ref adpkpzuhvrbfftlxabjd
```

4. Configure o evento de pagamentos (Payments) no Mercado Pago para `https://adpkpzuhvrbfftlxabjd.supabase.co/functions/v1/mercadopago-webhook`. A função verifica a assinatura HMAC e consulta o pagamento na API do Mercado Pago antes de creditar. O status autenticado também reconcilia pagamentos enquanto a página estiver aberta.
5. Se existir a feature flag `pix_enabled`, habilite-a no painel administrativo. Uma flag explicitamente desativada bloqueia a criação de recargas no servidor.

Valide com credenciais e contas de teste do Mercado Pago antes de ativar produção: gerar Pix, atualizar a página e recuperar o QR Code, pagar, confirmar saldo/histórico e reenviar a mesma notificação. A operação SQL bloqueia a recarga e a conta e credita uma única vez. Pagamentos recusados/cancelados não geram crédito. Estornos posteriores à aprovação precisam de conciliação operacional; não há débito automático de estorno neste fluxo.

A recarga mínima é R$ 1,00. A taxa de serviço é de 1% sobre a recarga, arredondada ao centavo e acrescentada ao Pix. Por exemplo: R$ 100,00 de crédito + R$ 1,00 de taxa = R$ 101,00 a pagar. O servidor calcula a taxa e confere o valor total pago; somente o valor da recarga é creditado. Recargas já geradas preservam o valor original cobrado. Republique `mercadopago-pix`, `get-pix-status` e `mercadopago-webhook` após alterações na regra de taxa.

Referências oficiais: [Pix](https://www.mercadopago.com.br/developers/pt/docs/checkout-api-payments/integration-configuration/integrate-pix) e [Webhooks](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/additional-settings/optional-notifications).
