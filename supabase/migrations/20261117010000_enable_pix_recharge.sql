INSERT INTO public.feature_flags (key, enabled, description)
VALUES ('pix_enabled', TRUE, 'Recarga de saldo via Pix Mercado Pago')
ON CONFLICT (key) DO NOTHING;
