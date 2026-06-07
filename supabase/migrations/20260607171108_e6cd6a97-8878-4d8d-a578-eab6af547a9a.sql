
-- 1) Tabela de adegas
CREATE TABLE public.adegas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.adegas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.adegas TO authenticated;
GRANT ALL ON public.adegas TO service_role;
ALTER TABLE public.adegas ENABLE ROW LEVEL SECURITY;

-- 2) adega_id em user_roles
ALTER TABLE public.user_roles ADD COLUMN adega_id uuid REFERENCES public.adegas(id) ON DELETE CASCADE;

-- 3) Cria adega principal e migra
INSERT INTO public.adegas (nome, slug, ativo) VALUES ('Adega Principal', 'principal', true);

INSERT INTO public.user_roles (user_id, role, adega_id)
SELECT user_id, 'super_admin'::app_role, NULL
FROM public.user_roles WHERE role = 'admin'
ON CONFLICT DO NOTHING;

UPDATE public.user_roles
SET adega_id = (SELECT id FROM public.adegas WHERE slug='principal')
WHERE role IN ('admin','caixa');

-- 4) Adiciona adega_id em todas as tabelas tenant
DO $$
DECLARE
  t text;
  principal_id uuid := (SELECT id FROM public.adegas WHERE slug='principal');
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'produtos','categorias','fornecedores','vendas','itens_venda',
    'fluxo_caixa','comandas','itens_comanda','caixas','caixa_logs',
    'movimentacoes_estoque','funcionarios','profiles','app_settings'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN adega_id uuid REFERENCES public.adegas(id) ON DELETE CASCADE', t);
    EXECUTE format('UPDATE public.%I SET adega_id = %L', t, principal_id);
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN adega_id SET NOT NULL', t);
    EXECUTE format('CREATE INDEX %I ON public.%I(adega_id)', t || '_adega_id_idx', t);
  END LOOP;
END $$;

ALTER TABLE public.app_settings DROP CONSTRAINT IF EXISTS app_settings_pkey;
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (adega_id, key);

ALTER TABLE public.funcionarios DROP CONSTRAINT IF EXISTS funcionarios_username_key;
ALTER TABLE public.funcionarios ADD CONSTRAINT funcionarios_username_adega_key UNIQUE (adega_id, username);

-- 5) Helpers
CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_uid AND role='super_admin');
$$;

CREATE OR REPLACE FUNCTION public.current_adega_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT adega_id FROM public.user_roles
  WHERE user_id = auth.uid() AND adega_id IS NOT NULL
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.can_access_adega(_adega uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT public.is_super_admin(auth.uid()) OR _adega = public.current_adega_id();
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT
    EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_user_id AND role='super_admin')
    OR EXISTS(
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id=_user_id
        AND ur.role=_role
        AND (ur.adega_id IS NULL OR ur.adega_id = public.current_adega_id())
    );
$$;

-- Revoga execução pública dessas helpers
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM public;
REVOKE EXECUTE ON FUNCTION public.current_adega_id() FROM public;
REVOKE EXECUTE ON FUNCTION public.can_access_adega(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_adega_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_adega(uuid) TO authenticated;

-- 6) Defaults
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'produtos','categorias','fornecedores','vendas','itens_venda',
    'fluxo_caixa','comandas','itens_comanda','caixas','caixa_logs',
    'movimentacoes_estoque','funcionarios','app_settings'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN adega_id SET DEFAULT public.current_adega_id()', t);
  END LOOP;
END $$;

-- 7) RLS adegas
CREATE POLICY adegas_select_public ON public.adegas
  FOR SELECT TO anon, authenticated USING (ativo = true OR public.is_super_admin(auth.uid()));
CREATE POLICY adegas_super_all ON public.adegas
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- 8) RLS reescritas
-- categorias
DROP POLICY IF EXISTS cat_admin_all ON public.categorias;
DROP POLICY IF EXISTS cat_select ON public.categorias;
CREATE POLICY cat_select ON public.categorias FOR SELECT TO authenticated USING (public.can_access_adega(adega_id));
CREATE POLICY cat_admin_all ON public.categorias FOR ALL TO authenticated
  USING (public.can_access_adega(adega_id) AND has_role(auth.uid(),'admin'))
  WITH CHECK (public.can_access_adega(adega_id) AND has_role(auth.uid(),'admin'));

-- produtos
DROP POLICY IF EXISTS prod_admin_all ON public.produtos;
DROP POLICY IF EXISTS prod_select ON public.produtos;
CREATE POLICY prod_select ON public.produtos FOR SELECT TO authenticated USING (public.can_access_adega(adega_id));
CREATE POLICY prod_admin_all ON public.produtos FOR ALL TO authenticated
  USING (public.can_access_adega(adega_id) AND has_role(auth.uid(),'admin'))
  WITH CHECK (public.can_access_adega(adega_id) AND has_role(auth.uid(),'admin'));

-- fornecedores
DROP POLICY IF EXISTS forn_admin_all ON public.fornecedores;
DROP POLICY IF EXISTS forn_select ON public.fornecedores;
CREATE POLICY forn_select ON public.fornecedores FOR SELECT TO authenticated USING (public.can_access_adega(adega_id));
CREATE POLICY forn_admin_all ON public.fornecedores FOR ALL TO authenticated
  USING (public.can_access_adega(adega_id) AND has_role(auth.uid(),'admin'))
  WITH CHECK (public.can_access_adega(adega_id) AND has_role(auth.uid(),'admin'));

-- vendas
DROP POLICY IF EXISTS venda_insert ON public.vendas;
DROP POLICY IF EXISTS venda_select ON public.vendas;
CREATE POLICY venda_select ON public.vendas FOR SELECT TO authenticated USING (public.can_access_adega(adega_id));
CREATE POLICY venda_insert ON public.vendas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_access_adega(adega_id));

-- itens_venda
DROP POLICY IF EXISTS iv_insert ON public.itens_venda;
DROP POLICY IF EXISTS iv_select ON public.itens_venda;
CREATE POLICY iv_select ON public.itens_venda FOR SELECT TO authenticated USING (public.can_access_adega(adega_id));
CREATE POLICY iv_insert ON public.itens_venda FOR INSERT TO authenticated WITH CHECK (public.can_access_adega(adega_id));

-- fluxo_caixa
DROP POLICY IF EXISTS fx_select ON public.fluxo_caixa;
DROP POLICY IF EXISTS fx_insert ON public.fluxo_caixa;
DROP POLICY IF EXISTS fx_admin_delete ON public.fluxo_caixa;
CREATE POLICY fx_select ON public.fluxo_caixa FOR SELECT TO authenticated USING (public.can_access_adega(adega_id));
CREATE POLICY fx_insert ON public.fluxo_caixa FOR INSERT TO authenticated WITH CHECK (public.can_access_adega(adega_id));
CREATE POLICY fx_admin_delete ON public.fluxo_caixa FOR DELETE TO authenticated
  USING (public.can_access_adega(adega_id) AND has_role(auth.uid(),'admin'));

-- comandas
DROP POLICY IF EXISTS comandas_select ON public.comandas;
DROP POLICY IF EXISTS comandas_insert ON public.comandas;
DROP POLICY IF EXISTS comandas_update ON public.comandas;
DROP POLICY IF EXISTS comandas_delete_admin ON public.comandas;
CREATE POLICY comandas_select ON public.comandas FOR SELECT TO authenticated USING (public.can_access_adega(adega_id));
CREATE POLICY comandas_insert ON public.comandas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_access_adega(adega_id));
CREATE POLICY comandas_update ON public.comandas FOR UPDATE TO authenticated
  USING (public.can_access_adega(adega_id)) WITH CHECK (public.can_access_adega(adega_id));
CREATE POLICY comandas_delete_admin ON public.comandas FOR DELETE TO authenticated
  USING (public.can_access_adega(adega_id) AND has_role(auth.uid(),'admin'));

-- itens_comanda
DROP POLICY IF EXISTS ic_select ON public.itens_comanda;
DROP POLICY IF EXISTS ic_insert ON public.itens_comanda;
DROP POLICY IF EXISTS ic_update ON public.itens_comanda;
DROP POLICY IF EXISTS ic_delete ON public.itens_comanda;
CREATE POLICY ic_select ON public.itens_comanda FOR SELECT TO authenticated USING (public.can_access_adega(adega_id));
CREATE POLICY ic_insert ON public.itens_comanda FOR INSERT TO authenticated WITH CHECK (public.can_access_adega(adega_id));
CREATE POLICY ic_update ON public.itens_comanda FOR UPDATE TO authenticated
  USING (public.can_access_adega(adega_id)) WITH CHECK (public.can_access_adega(adega_id));
CREATE POLICY ic_delete ON public.itens_comanda FOR DELETE TO authenticated USING (public.can_access_adega(adega_id));

-- caixas
DROP POLICY IF EXISTS caixas_select ON public.caixas;
DROP POLICY IF EXISTS caixas_insert ON public.caixas;
DROP POLICY IF EXISTS caixas_update ON public.caixas;
CREATE POLICY caixas_select ON public.caixas FOR SELECT TO authenticated USING (public.can_access_adega(adega_id));
CREATE POLICY caixas_insert ON public.caixas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = opened_by AND public.can_access_adega(adega_id));
CREATE POLICY caixas_update ON public.caixas FOR UPDATE TO authenticated
  USING (public.can_access_adega(adega_id)) WITH CHECK (public.can_access_adega(adega_id));

-- caixa_logs
DROP POLICY IF EXISTS caixa_logs_select_admin ON public.caixa_logs;
DROP POLICY IF EXISTS caixa_logs_insert ON public.caixa_logs;
CREATE POLICY caixa_logs_insert ON public.caixa_logs FOR INSERT TO authenticated WITH CHECK (public.can_access_adega(adega_id));
CREATE POLICY caixa_logs_select_admin ON public.caixa_logs FOR SELECT TO authenticated
  USING (public.can_access_adega(adega_id) AND has_role(auth.uid(),'admin'));

-- movimentacoes_estoque
DROP POLICY IF EXISTS mov_select ON public.movimentacoes_estoque;
DROP POLICY IF EXISTS mov_insert ON public.movimentacoes_estoque;
CREATE POLICY mov_select ON public.movimentacoes_estoque FOR SELECT TO authenticated USING (public.can_access_adega(adega_id));
CREATE POLICY mov_insert ON public.movimentacoes_estoque FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_access_adega(adega_id));

-- funcionarios
DROP POLICY IF EXISTS func_admin_all ON public.funcionarios;
DROP POLICY IF EXISTS func_select_self ON public.funcionarios;
CREATE POLICY func_select_self ON public.funcionarios FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY func_admin_all ON public.funcionarios FOR ALL TO authenticated
  USING (public.can_access_adega(adega_id) AND has_role(auth.uid(),'admin'))
  WITH CHECK (public.can_access_adega(adega_id) AND has_role(auth.uid(),'admin'));

-- profiles
DROP POLICY IF EXISTS profiles_select_auth ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_select_auth ON public.profiles FOR SELECT TO authenticated
  USING (public.can_access_adega(adega_id) OR auth.uid() = id);
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- app_settings
DROP POLICY IF EXISTS app_settings_admin_all ON public.app_settings;
CREATE POLICY app_settings_admin_all ON public.app_settings FOR ALL TO authenticated
  USING (public.can_access_adega(adega_id) AND has_role(auth.uid(),'admin'))
  WITH CHECK (public.can_access_adega(adega_id) AND has_role(auth.uid(),'admin'));

-- 9) Trigger handle_new_user: não atribui role automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles(id, nome, email, adega_id)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email,'@',1)),
    new.email,
    NULLIF(new.raw_user_meta_data->>'adega_id','')::uuid
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END $$;
