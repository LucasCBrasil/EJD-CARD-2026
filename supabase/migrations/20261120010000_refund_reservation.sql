-- Operações preparadas pelo servidor: a reserva e o lançamento no extrato
-- ocorrem na mesma transação, sob bloqueio da conta e do pagamento original.
CREATE OR REPLACE FUNCTION public.reserve_pix_refund(
  p_request uuid, p_payment uuid, p_amount numeric, p_expected_balance numeric,
  p_expected_transaction_count bigint, p_admin uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  r public.refund_requests%ROWTYPE;
  pay public.pix_payments%ROWTYPE;
  current_balance numeric;
  previous_amount numeric;
  txn_count bigint;
  operation_id uuid;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE id = p_admin AND role = 'admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 OR p_amount <> round(p_amount, 2) THEN
    RAISE EXCEPTION 'Valor inválido';
  END IF;
  SELECT * INTO r FROM public.refund_requests WHERE id = p_request FOR UPDATE;
  IF NOT FOUND OR r.status <> 'pending' THEN RAISE EXCEPTION 'Solicitação indisponível'; END IF;
  SELECT balance INTO current_balance FROM public.app_users WHERE id = r.user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta não encontrada'; END IF;
  SELECT id INTO operation_id FROM public.refund_payment_operations
    WHERE refund_request_id = p_request AND payment_id = p_payment AND amount = p_amount
      AND status IN ('prepared','processing','unknown','approved');
  IF FOUND THEN RETURN operation_id; END IF;
  IF current_balance <> p_expected_balance OR current_balance < p_amount THEN
    RAISE EXCEPTION 'Saldo alterado; recalcule a operação';
  END IF;
  SELECT count(*) INTO txn_count FROM public.transactions WHERE user_id = r.user_id;
  IF txn_count <> p_expected_transaction_count THEN RAISE EXCEPTION 'Histórico alterado; recalcule a operação'; END IF;
  SELECT * INTO pay FROM public.pix_payments WHERE id = p_payment FOR UPDATE;
  IF NOT FOUND OR pay.user_id IS DISTINCT FROM r.user_id OR pay.status <> 'confirmed'
     OR pay.webhook_data->>'provider' IS DISTINCT FROM 'mercadopago'
     OR pay.external_id IS NULL OR pay.external_id !~ '^[0-9]+$' THEN
    RAISE EXCEPTION 'Pagamento original não elegível';
  END IF;
  SELECT coalesce(sum(amount), 0) INTO previous_amount FROM public.refund_payment_operations
    WHERE payment_id = p_payment AND status IN ('prepared', 'processing', 'unknown', 'approved');
  IF previous_amount + p_amount > pay.amount THEN RAISE EXCEPTION 'Valor excede pagamento original'; END IF;
  INSERT INTO public.refund_payment_operations(refund_request_id, payment_id, user_id, amount)
    VALUES(p_request, p_payment, r.user_id, p_amount) RETURNING id INTO operation_id;
  PERFORM * FROM public.adjust_account_balance(r.user_id, p_amount, 'debit',
    'Reserva para ressarcimento Pix ' || operation_id::text, p_admin::text);
  RETURN operation_id;
END $$;
REVOKE ALL ON FUNCTION public.reserve_pix_refund(uuid, uuid, numeric, numeric, bigint, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_pix_refund(uuid, uuid, numeric, numeric, bigint, uuid) TO service_role;
