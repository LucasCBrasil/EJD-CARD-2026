-- Adiciona roles de coordenação para lojinha e lanchonete.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'coordLojinha';
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'coordLanchonete';
