
-- Status enum
DO $$ BEGIN
  CREATE TYPE public.comanda_status AS ENUM ('aberta','fechada','cancelada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.comandas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_nome text NOT NULL,
  cliente_telefone text,
  observacao text,
  status public.comanda_status NOT NULL DEFAULT 'aberta',
  total numeric NOT NULL DEFAULT 0,
  forma_pagamento text,
  user_id uuid NOT NULL,
  venda_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.comandas TO authenticated;
GRANT ALL ON public.comandas TO service_role;

ALTER TABLE public.comandas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comandas_select" ON public.comandas FOR SELECT TO authenticated USING (true);
CREATE POLICY "comandas_insert" ON public.comandas FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comandas_update" ON public.comandas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "comandas_delete_admin" ON public.comandas FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_comandas_updated_at
  BEFORE UPDATE ON public.comandas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.itens_comanda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comanda_id uuid NOT NULL REFERENCES public.comandas(id) ON DELETE CASCADE,
  produto_id uuid NOT NULL,
  produto_nome text NOT NULL,
  quantidade numeric NOT NULL,
  preco_unitario numeric NOT NULL,
  subtotal numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.itens_comanda TO authenticated;
GRANT ALL ON public.itens_comanda TO service_role;

ALTER TABLE public.itens_comanda ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ic_select" ON public.itens_comanda FOR SELECT TO authenticated USING (true);
CREATE POLICY "ic_insert" ON public.itens_comanda FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "ic_update" ON public.itens_comanda FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "ic_delete" ON public.itens_comanda FOR DELETE TO authenticated USING (true);

CREATE INDEX idx_comandas_status ON public.comandas(status);
CREATE INDEX idx_itens_comanda_comanda_id ON public.itens_comanda(comanda_id);
