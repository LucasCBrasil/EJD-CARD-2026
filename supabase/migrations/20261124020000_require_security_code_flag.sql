INSERT INTO public.feature_flags (key, enabled, description)
VALUES ('require_security_code', true, 'Exigir código de segurança para operações de crédito e débito.')
ON CONFLICT (key) DO NOTHING;
