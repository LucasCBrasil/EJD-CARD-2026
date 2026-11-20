CREATE TABLE public.refund_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.app_users(id),
  pix_key text NOT NULL CHECK (length(trim(pix_key)) BETWEEN 1 AND 200),
  whatsapp text NOT NULL CHECK (length(trim(whatsapp)) BETWEEN 8 AND 40),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'authorized')),
  created_at timestamptz NOT NULL DEFAULT now(),
  authorized_at timestamptz,
  authorized_by uuid REFERENCES public.app_users(id)
);
CREATE UNIQUE INDEX refund_one_pending_per_user ON public.refund_requests(user_id) WHERE status = 'pending';
ALTER TABLE public.refund_requests ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.refund_requests TO service_role;
INSERT INTO public.feature_flags (key, enabled, description) VALUES ('refunds_enabled', false, 'Mostrar opção de solicitação de ressarcimento');
