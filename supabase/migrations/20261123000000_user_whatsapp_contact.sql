ALTER TABLE public.app_users ADD COLUMN IF NOT EXISTS whatsapp text;
INSERT INTO public.feature_flags (key, enabled, description)
VALUES ('require_whatsapp_contact', false, 'Solicitar WhatsApp aos usuários após o login.')
ON CONFLICT (key) DO NOTHING;
