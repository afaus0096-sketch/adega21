
-- 1) Promote any super_admin to admin of Adega Principal, then remove super_admin role rows
DO $$
DECLARE principal uuid;
BEGIN
  SELECT id INTO principal FROM public.adegas WHERE slug='principal' LIMIT 1;
  IF principal IS NOT NULL THEN
    INSERT INTO public.user_roles(user_id, role, adega_id)
    SELECT DISTINCT ur.user_id, 'admin'::app_role, principal
    FROM public.user_roles ur
    WHERE ur.role='super_admin'
      AND NOT EXISTS (
        SELECT 1 FROM public.user_roles x
        WHERE x.user_id=ur.user_id AND x.role='admin' AND x.adega_id=principal
      );
  END IF;
END$$;

DELETE FROM public.user_roles WHERE role='super_admin';

-- 2) Auto-fill adega_id trigger
CREATE OR REPLACE FUNCTION public.set_adega_id_default()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.adega_id IS NULL THEN
    NEW.adega_id := public.current_adega_id();
  END IF;
  RETURN NEW;
END$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'produtos','categorias','fornecedores','vendas','itens_venda',
    'fluxo_caixa','comandas','itens_comanda','caixas','caixa_logs',
    'movimentacoes_estoque','app_settings'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_set_adega_id ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_set_adega_id BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_adega_id_default()', t);
  END LOOP;
END$$;

-- 3) Simplify has_role (no super_admin shortcut)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id=_user_id
      AND ur.role=_role
      AND (ur.adega_id IS NULL OR ur.adega_id = public.current_adega_id())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false; $$;

-- 4) Deactivate other adegas
UPDATE public.adegas SET ativo=false WHERE slug<>'principal';
