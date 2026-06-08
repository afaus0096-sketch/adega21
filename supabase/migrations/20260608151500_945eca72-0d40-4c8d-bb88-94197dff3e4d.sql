
ALTER TABLE public.funcionarios
  ADD COLUMN IF NOT EXISTS cargo text NOT NULL DEFAULT 'caixa'
  CHECK (cargo IN ('dono','gerente','caixa'));
