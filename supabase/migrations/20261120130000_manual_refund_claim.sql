-- A reserva não expira: outra pessoa só pode assumir depois que o responsável
-- confirmar expressamente que não fez o pagamento e liberar a solicitação.
ALTER TABLE public.refund_requests
  ADD COLUMN IF NOT EXISTS manual_claimed_by uuid REFERENCES public.app_users(id),
  ADD COLUMN IF NOT EXISTS manual_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS manual_claimed_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS manual_claimed_pix_key text;

CREATE OR REPLACE FUNCTION public.claim_manual_refund(p_request uuid, p_admin uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.refund_requests%ROWTYPE; current_balance numeric; customer_name text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE id=p_admin AND role='admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT * INTO r FROM public.refund_requests WHERE id=p_request FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN RAISE EXCEPTION 'Solicitação indisponível'; END IF;
  IF r.manual_claimed_by IS NOT NULL AND r.manual_claimed_by <> p_admin THEN RAISE EXCEPTION 'Solicitação já está reservada por outro administrador'; END IF;
  SELECT balance, name INTO current_balance, customer_name FROM public.app_users WHERE id=r.user_id FOR UPDATE;
  IF NOT FOUND OR current_balance IS NULL OR (r.manual_claimed_by IS NULL AND current_balance <= 0) THEN RAISE EXCEPTION 'Saldo indisponível'; END IF;
  IF EXISTS (SELECT 1 FROM public.refund_payment_operations WHERE user_id=r.user_id AND status IN ('prepared','processing','unknown')) THEN
    RAISE EXCEPTION 'Há uma devolução Pix aguardando confirmação';
  END IF;
  IF r.manual_claimed_by IS NULL THEN
    UPDATE public.refund_requests SET manual_claimed_by=p_admin, manual_claimed_at=now(), manual_claimed_amount=current_balance, manual_claimed_pix_key=pix_key
      WHERE id=p_request RETURNING * INTO r;
  END IF;
  RETURN jsonb_build_object('name', customer_name, 'amount', r.manual_claimed_amount, 'pix_key', r.manual_claimed_pix_key, 'whatsapp', r.whatsapp, 'balance_changed', current_balance <> r.manual_claimed_amount);
END $$;

CREATE OR REPLACE FUNCTION public.release_manual_refund(p_request uuid, p_admin uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.refund_requests%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE id=p_admin AND role='admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT * INTO r FROM public.refund_requests WHERE id=p_request FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' OR r.manual_claimed_by IS DISTINCT FROM p_admin THEN RAISE EXCEPTION 'Reserva indisponível'; END IF;
  UPDATE public.refund_requests SET manual_claimed_by=NULL, manual_claimed_at=NULL, manual_claimed_amount=NULL, manual_claimed_pix_key=NULL WHERE id=p_request;
END $$;

CREATE OR REPLACE FUNCTION public.settle_manual_refund(p_request uuid, p_expected_balance numeric, p_admin uuid)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.refund_requests%ROWTYPE; current_balance numeric; debit_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE id=p_admin AND role='admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  SELECT * INTO r FROM public.refund_requests WHERE id=p_request FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF r.manual_settlement_amount IS NOT NULL THEN RETURN r.manual_settlement_amount; END IF;
  IF r.status <> 'pending' OR r.manual_claimed_by IS DISTINCT FROM p_admin OR r.manual_claimed_amount IS NULL THEN RAISE EXCEPTION 'Reserva indisponível'; END IF;
  SELECT balance INTO current_balance FROM public.app_users WHERE id=r.user_id FOR UPDATE;
  IF NOT FOUND OR current_balance IS NULL OR current_balance < r.manual_claimed_amount OR p_expected_balance IS DISTINCT FROM r.manual_claimed_amount THEN
    RAISE EXCEPTION 'Saldo insuficiente ou dados alterados; mantenha a reserva e procure a administração';
  END IF;
  IF EXISTS (SELECT 1 FROM public.refund_payment_operations WHERE user_id=r.user_id AND status IN ('prepared','processing','unknown')) THEN RAISE EXCEPTION 'Há uma devolução Pix aguardando confirmação'; END IF;
  SELECT transaction_id INTO debit_id FROM public.adjust_account_balance(r.user_id,r.manual_claimed_amount,'debit','Baixa de ressarcimento manual ' || r.id::text,p_admin::text);
  UPDATE public.refund_requests SET status='authorized', authorized_at=now(), authorized_by=p_admin, manual_settlement_amount=r.manual_claimed_amount,
    manual_settlement_transaction_id=debit_id, manual_claimed_by=NULL, manual_claimed_at=NULL, manual_claimed_amount=NULL, manual_claimed_pix_key=NULL WHERE id=r.id;
  RETURN r.manual_claimed_amount;
END $$;

CREATE OR REPLACE FUNCTION public.prevent_pix_during_manual_claim()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimant uuid;
BEGIN
  SELECT manual_claimed_by INTO claimant FROM public.refund_requests WHERE id=NEW.refund_request_id FOR UPDATE;
  IF claimant IS NOT NULL THEN RAISE EXCEPTION 'Solicitação reservada para ressarcimento manual'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS block_pix_during_manual_claim ON public.refund_payment_operations;
CREATE TRIGGER block_pix_during_manual_claim BEFORE INSERT ON public.refund_payment_operations FOR EACH ROW EXECUTE FUNCTION public.prevent_pix_during_manual_claim();
REVOKE ALL ON FUNCTION public.claim_manual_refund(uuid,uuid), public.release_manual_refund(uuid,uuid), public.settle_manual_refund(uuid,numeric,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_manual_refund(uuid,uuid), public.release_manual_refund(uuid,uuid), public.settle_manual_refund(uuid,numeric,uuid) TO service_role;
REVOKE ALL ON FUNCTION public.prevent_pix_during_manual_claim() FROM PUBLIC,anon,authenticated;
