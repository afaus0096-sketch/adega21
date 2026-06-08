import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen");

async function assertSuper(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const isSuper = (data ?? []).some((r: any) => r.role === "super_admin");
  if (!isSuper) throw new Error("Acesso restrito ao Super Usuário.");
}

// PUBLIC: lista adegas ativas para o dropdown da tela de login
export const listAdegasPublic = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("adegas")
    .select("id, nome, slug")
    .eq("ativo", true)
    .order("nome");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const listAdegasAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertSuper(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("adegas")
      .select("id, nome, slug, ativo, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createAdega = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ nome: z.string().trim().min(2).max(80), slug: slugSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertSuper(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: dup } = await supabaseAdmin
      .from("adegas")
      .select("id")
      .eq("slug", data.slug)
      .maybeSingle();
    if (dup) throw new Error("Já existe uma adega com esse slug.");
    const { data: row, error } = await supabaseAdmin
      .from("adegas")
      .insert({ nome: data.nome, slug: data.slug, ativo: true, created_by: userId })
      .select("id, nome, slug, ativo")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const toggleAdega = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertSuper(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("adegas")
      .update({ ativo: data.ativo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Cria uma "Account" (ADM dono de uma adega) — login por email/senha.
export const createAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        adega_id: z.string().uuid(),
        nome: z.string().trim().min(2).max(80),
        email: z.string().email(),
        password: z.string().min(6).max(72),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertSuper(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { nome: data.nome, adega_id: data.adega_id },
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "Falha ao criar usuário");

    const newUserId = created.user.id;
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "admin", adega_id: data.adega_id });
    if (rErr) throw new Error(rErr.message);

    await supabaseAdmin
      .from("profiles")
      .update({ adega_id: data.adega_id, nome: data.nome })
      .eq("id", newUserId);

    return { id: newUserId, email: data.email };
  });

export const listAccounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertSuper(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: roles, error } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role, adega_id")
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    if (!roles?.length) return [];
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id, nome, email")
      .in("id", roles.map((r) => r.user_id));
    const { data: adegas } = await supabaseAdmin
      .from("adegas")
      .select("id, nome");
    const adegaMap = new Map((adegas ?? []).map((a) => [a.id, a.nome]));
    const profMap = new Map((profs ?? []).map((p) => [p.id, p]));
    return roles.map((r) => ({
      user_id: r.user_id,
      adega_id: r.adega_id,
      adega_nome: adegaMap.get(r.adega_id ?? "") ?? "—",
      email: profMap.get(r.user_id)?.email ?? "—",
      nome: profMap.get(r.user_id)?.nome ?? "—",
    }));
  });
