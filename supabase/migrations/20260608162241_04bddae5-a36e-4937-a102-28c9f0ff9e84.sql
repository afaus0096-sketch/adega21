
-- 1) Restaura is_super_admin para consultar user_roles
CREATE OR REPLACE FUNCTION public.is_super_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _uid AND role = 'super_admin'
  );
$$;

-- 2) Promove afaus0096@gmail.com a super_admin (remove papéis antigos)
DELETE FROM public.user_roles
WHERE user_id = (SELECT id FROM auth.users WHERE email='afaus0096@gmail.com');

INSERT INTO public.user_roles(user_id, role, adega_id)
SELECT u.id, 'super_admin'::app_role, NULL
FROM auth.users u WHERE u.email='afaus0096@gmail.com';

-- 3) Grants em adegas para autenticados (leitura via RLS) — RLS já filtra ativo/super
GRANT SELECT ON public.adegas TO authenticated;
GRANT ALL ON public.adegas TO service_role;
