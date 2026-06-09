
CREATE TABLE public.vips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adega_id uuid NOT NULL REFERENCES public.adegas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  telefone text,
  observacoes text,
  credito numeric(12,2) NOT NULL DEFAULT 0,
  limite_fiado numeric(12,2) NOT NULL DEFAULT 0,
  fiado_atual numeric(12,2) NOT NULL DEFAULT 0,
  rosh_credito integer NOT NULL DEFAULT 0,
  rosh_fiado_limite integer NOT NULL DEFAULT 0,
  rosh_fiado_atual integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vips TO authenticated;
GRANT ALL ON public.vips TO service_role;

ALTER TABLE public.vips ENABLE ROW LEVEL SECURITY;

CREATE POLICY vips_select ON public.vips
  FOR SELECT USING (public.can_access_adega(adega_id));

CREATE POLICY vips_admin_all ON public.vips
  FOR ALL
  USING (public.can_access_adega(adega_id) AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.can_access_adega(adega_id) AND public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER vips_set_adega BEFORE INSERT ON public.vips
  FOR EACH ROW EXECUTE FUNCTION public.set_adega_id_default();

CREATE TRIGGER vips_updated_at BEFORE UPDATE ON public.vips
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX vips_adega_idx ON public.vips(adega_id);
