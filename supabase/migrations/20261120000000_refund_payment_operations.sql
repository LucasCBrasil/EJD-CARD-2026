-- Persiste cada tentativa por pagamento original. Nenhuma linha criada por esta
-- migração envia dinheiro ou altera saldos.
CREATE TABLE IF NOT EXISTS public.refund_payment_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  refund_request_id uuid NOT NULL REFERENCES public.refund_requests(id),
  payment_id uuid NOT NULL REFERENCES public.pix_payments(id),
  user_id uuid NOT NULL REFERENCES public.app_users(id),
  amount numeric(10,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'prepared' CHECK (status IN ('prepared', 'processing', 'approved', 'rejected', 'cancelled', 'unknown')),
  provider_refund_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (refund_request_id, payment_id)
);
ALTER TABLE public.refund_payment_operations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.refund_payment_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.refund_payment_operations TO service_role;
