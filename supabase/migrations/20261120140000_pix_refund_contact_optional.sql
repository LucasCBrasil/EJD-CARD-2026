-- Devoluções ao pagamento Pix original não usam chave ou contato separados.
ALTER TABLE public.refund_requests ALTER COLUMN pix_key DROP NOT NULL;
ALTER TABLE public.refund_requests ALTER COLUMN whatsapp DROP NOT NULL;
