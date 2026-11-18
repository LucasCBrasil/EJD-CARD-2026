CREATE OR REPLACE FUNCTION public.confirm_account_pix_payment(
  p_external_id TEXT,
  p_webhook_data JSONB
)
RETURNS TABLE(updated BOOLEAN, user_id UUID, amount NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  payment_record public.pix_payments%ROWTYPE;
BEGIN
  SELECT *
  INTO payment_record
  FROM public.pix_payments
  WHERE external_id = p_external_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::UUID, NULL::NUMERIC;
    RETURN;
  END IF;

  IF payment_record.status <> 'pending' THEN
    RETURN QUERY SELECT FALSE, payment_record.user_id, payment_record.amount;
    RETURN;
  END IF;

  IF payment_record.user_id IS NULL THEN
    RAISE EXCEPTION 'PIX payment has no associated account' USING ERRCODE = '23502';
  END IF;

  UPDATE public.pix_payments
  SET status = 'confirmed',
      webhook_data = p_webhook_data,
      confirmed_at = COALESCE(confirmed_at, NOW()),
      updated_at = NOW()
  WHERE id = payment_record.id;

  PERFORM *
  FROM public.adjust_account_balance(
    payment_record.user_id,
    payment_record.amount,
    'credit',
    CASE WHEN payment_record.webhook_data->>'provider' = 'mercadopago' THEN 'Recarga via Pix (Mercado Pago)' ELSE 'Abastecimento via PIX (Asaas)' END,
    CASE WHEN payment_record.webhook_data->>'provider' = 'mercadopago' THEN 'mercadopago_webhook' ELSE 'asaas_webhook' END
  );

  RETURN QUERY SELECT TRUE, payment_record.user_id, payment_record.amount;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_account_pix_payment(TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_account_pix_payment(TEXT, JSONB)
  TO service_role;
