-- A baixa registra um pagamento feito fora do sistema; não envia Pix.
ALTER TABLE public.refund_requests
  ADD COLUMN IF NOT EXISTS manual_settlement_amount numeric(10,2),
  ADD COLUMN IF NOT EXISTS manual_settlement_transaction_id uuid REFERENCES public.transactions(id);

CREATE OR REPLACE FUNCTION public.settle_manual_refund(
  p_request uuid, p_expected_balance numeric, p_admin uuid
) RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  request_row public.refund_requests%ROWTYPE;
  current_balance numeric;
  debit_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE id = p_admin AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  SELECT * INTO request_row FROM public.refund_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF request_row.manual_settlement_amount IS NOT NULL THEN
    RETURN request_row.manual_settlement_amount;
  END IF;
  IF request_row.status <> 'pending' THEN RAISE EXCEPTION 'Solicitação não está pendente'; END IF;
  SELECT balance INTO current_balance FROM public.app_users WHERE id = request_row.user_id FOR UPDATE;
  IF NOT FOUND OR current_balance IS NULL OR current_balance <= 0 OR p_expected_balance IS NULL
    OR current_balance <> p_expected_balance THEN
    RAISE EXCEPTION 'Saldo indisponível ou alterado; atualize a página';
  END IF;
  IF EXISTS (SELECT 1 FROM public.refund_payment_operations WHERE user_id = request_row.user_id
    AND status IN ('prepared', 'processing', 'unknown')) THEN
    RAISE EXCEPTION 'Há uma devolução Pix aguardando confirmação';
  END IF;
  SELECT transaction_id INTO debit_id FROM public.adjust_account_balance(
    request_row.user_id, current_balance, 'debit', 'Baixa de ressarcimento manual ' || request_row.id::text, p_admin::text
  );
  UPDATE public.refund_requests SET status = 'authorized', authorized_at = now(), authorized_by = p_admin,
    manual_settlement_amount = current_balance, manual_settlement_transaction_id = debit_id
  WHERE id = request_row.id;
  RETURN current_balance;
END $$;
REVOKE ALL ON FUNCTION public.settle_manual_refund(uuid,numeric,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_manual_refund(uuid,numeric,uuid) TO service_role;
