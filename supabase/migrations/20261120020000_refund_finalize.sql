-- Apenas o servidor pode registrar o resultado validado do provedor.
CREATE OR REPLACE FUNCTION public.finalize_pix_refund(
  p_operation uuid, p_status text, p_provider_refund_id text, p_admin uuid
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE op public.refund_payment_operations%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.app_users WHERE id=p_admin AND role='admin') THEN RAISE EXCEPTION 'Acesso negado'; END IF;
  IF p_status IS NULL OR p_status NOT IN ('approved','rejected','cancelled','processing') OR p_provider_refund_id IS NULL OR p_provider_refund_id !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Resultado inválido'; END IF;
  SELECT * INTO op FROM public.refund_payment_operations WHERE id=p_operation FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operação não encontrada'; END IF;
  IF op.status IN ('approved','rejected','cancelled') THEN
    IF op.status=p_status AND op.provider_refund_id=p_provider_refund_id THEN RETURN op.status; END IF;
    RAISE EXCEPTION 'Operação já finalizada';
  END IF;
  IF op.provider_refund_id IS NOT NULL AND op.provider_refund_id <> p_provider_refund_id THEN RAISE EXCEPTION 'Identificador do provedor divergente'; END IF;
  IF p_status IN ('rejected','cancelled') THEN
    PERFORM * FROM public.adjust_account_balance(op.user_id,op.amount,'credit','Liberação de reserva de reembolso Pix ' || op.id::text,p_admin::text);
  END IF;
  UPDATE public.refund_payment_operations SET status=p_status,provider_refund_id=p_provider_refund_id,updated_at=now() WHERE id=op.id;
  IF p_status='approved' THEN
    UPDATE public.refund_requests SET status='authorized',authorized_at=now(),authorized_by=p_admin WHERE id=op.refund_request_id AND status='pending';
  END IF;
  RETURN p_status;
END $$;
REVOKE ALL ON FUNCTION public.finalize_pix_refund(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_pix_refund(uuid,text,text,uuid) TO service_role;
