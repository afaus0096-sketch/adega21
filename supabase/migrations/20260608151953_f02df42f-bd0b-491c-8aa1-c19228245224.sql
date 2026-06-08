
-- Fix user_roles: users can only see their own roles
DROP POLICY IF EXISTS roles_select_auth ON public.user_roles;
CREATE POLICY roles_select_own ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Revoke EXECUTE on sensitive SECURITY DEFINER functions from anon/authenticated.
-- These are only meant to be called by service_role via server functions.
REVOKE EXECUTE ON FUNCTION public.crypt_hash(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crypt_check(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_adega_id_default() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.registrar_fluxo_venda() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.aplicar_venda() FROM PUBLIC, anon, authenticated;
