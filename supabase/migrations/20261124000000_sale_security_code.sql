CREATE TABLE public.sale_security_authorizations (
  seller_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  failed_attempts integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  authorized_until timestamptz,
  PRIMARY KEY (seller_id, customer_id)
);
ALTER TABLE public.sale_security_authorizations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sale_security_authorizations FROM anon, authenticated;
GRANT ALL ON public.sale_security_authorizations TO service_role;

CREATE OR REPLACE FUNCTION public.verify_sale_security_code(p_seller uuid, p_customer uuid, p_code text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE entry public.sale_security_authorizations%ROWTYPE; phone text;
BEGIN
  INSERT INTO public.sale_security_authorizations (seller_id, customer_id)
    VALUES (p_seller, p_customer) ON CONFLICT DO NOTHING;
  SELECT * INTO entry FROM public.sale_security_authorizations
    WHERE seller_id = p_seller AND customer_id = p_customer FOR UPDATE;
  IF entry.locked_until > now() THEN RETURN 'locked'; END IF;
  SELECT regexp_replace(coalesce(whatsapp, ''), '[^0-9]', '', 'g') INTO phone
    FROM public.app_users WHERE id = p_customer;
  IF phone IS NULL OR length(phone) < 10 THEN RETURN 'missing'; END IF;
  IF p_code !~ '^[0-9]{4}$' OR right(phone, 4) <> p_code THEN
    UPDATE public.sale_security_authorizations SET
      failed_attempts = CASE WHEN locked_until IS NOT NULL AND locked_until <= now() THEN 1 ELSE failed_attempts + 1 END,
      locked_until = CASE WHEN (CASE WHEN locked_until IS NOT NULL AND locked_until <= now() THEN 1 ELSE failed_attempts + 1 END) >= 5 THEN now() + interval '15 minutes' ELSE NULL END,
      authorized_until = NULL
      WHERE seller_id = p_seller AND customer_id = p_customer;
    RETURN 'invalid';
  END IF;
  UPDATE public.sale_security_authorizations SET failed_attempts = 0, locked_until = NULL,
    authorized_until = now() + interval '30 minutes'
    WHERE seller_id = p_seller AND customer_id = p_customer;
  RETURN 'ok';
END $$;
REVOKE ALL ON FUNCTION public.verify_sale_security_code(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_sale_security_code(uuid, uuid, text) TO service_role;
