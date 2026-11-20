-- Permite uma nova tentativa após uma reserva comprovadamente cancelada ou rejeitada,
-- mantendo o histórico e impedindo duas operações ativas para o mesmo Pix.
ALTER TABLE public.refund_payment_operations DROP CONSTRAINT IF EXISTS refund_payment_operations_refund_request_id_payment_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS refund_active_payment_per_request
  ON public.refund_payment_operations(refund_request_id,payment_id)
  WHERE status IN ('prepared','processing','unknown','approved');
