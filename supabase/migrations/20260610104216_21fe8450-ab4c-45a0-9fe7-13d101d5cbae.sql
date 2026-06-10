
-- adegas: restrict public read to authenticated only
DROP POLICY IF EXISTS adegas_select_public ON public.adegas;
CREATE POLICY adegas_select_public ON public.adegas
  FOR SELECT TO authenticated
  USING (ativo = true OR public.is_super_admin(auth.uid()));

-- vips: scope to authenticated role explicitly
DROP POLICY IF EXISTS vips_select ON public.vips;
DROP POLICY IF EXISTS vips_admin_all ON public.vips;

CREATE POLICY vips_select ON public.vips
  FOR SELECT TO authenticated
  USING (public.can_access_adega(adega_id));

CREATE POLICY vips_admin_all ON public.vips
  FOR ALL TO authenticated
  USING (public.can_access_adega(adega_id) AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.can_access_adega(adega_id) AND public.has_role(auth.uid(), 'admin'::app_role));

-- Drop anon SELECT grant on adegas if present (server fn uses service role)
REVOKE SELECT ON public.adegas FROM anon;
