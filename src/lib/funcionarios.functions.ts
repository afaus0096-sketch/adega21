import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const FUNC_EMAIL_DOMAIN = "funcionarios.adega.local";
const usernameSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9_.-]+$/, "Use apenas letras minúsculas, números, _ . -");
const pinSchema = z.string().regex(/^\d{6}$/, "PIN deve ter 6 dígitos");
const cargoSchema = z.enum(["dono", "gerente", "caixa"]);

export function funcionarioEmail(slug: string, username: string) {
  return slug === "principal"
    ? `${username}@${FUNC_EMAIL_DOMAIN}`
    : `${slug}.${username}@${FUNC_EMAIL_DOMAIN}`;
}

async function getAdminContext(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role, adega_id")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const adminRow = (data ?? []).find((r: any) => r.role === "admin");
  if (!adminRow) {
    throw new Error("Apenas administradores podem executar essa ação.");
  }
  const { data: a } = await supabase
    .from("adegas")
    .select("slug")
    .eq("id", adminRow.adega_id)
    .maybeSingle();
  return { adegaId: adminRow.adega_id as string, slug: a?.slug as string };
}

export const listFuncionarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await getAdminContext(supabase, userId);
    const { data, error } = await supabase
      .from("funcionarios")
      .select("id, nome, username, ativo, permissoes, cargo, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        nome: z.string().trim().min(2).max(80),
        username: usernameSchema,
        pin: pinSchema,
        cargo: cargoSchema,
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { adegaId, slug } = await getAdminContext(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = funcionarioEmail(slug, data.username);

    const { data: existing } = await supabase
      .from("funcionarios")
      .select("id")
      .eq("username", data.username)
      .eq("adega_id", adegaId)
      .maybeSingle();
    if (existing) throw new Error("Já existe um funcionário com esse usuário nessa adega.");

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.pin,
        email_confirm: true,
        user_metadata: { nome: data.nome, funcionario: true, username: data.username, adega_id: adegaId },
      });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Falha ao criar usuário");
    }

    const newUserId = created.user.id;

    // Dono e Gerente recebem role admin; Caixa recebe role caixa
    const dbRole = data.cargo === "caixa" ? "caixa" : "admin";
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: dbRole, adega_id: adegaId });
    if (roleErr) throw new Error(roleErr.message);

    await supabaseAdmin
      .from("profiles")
      .update({ adega_id: adegaId })
      .eq("id", newUserId);

    const { error: funcErr } = await supabaseAdmin.from("funcionarios").insert({
      id: newUserId,
      nome: data.nome,
      username: data.username,
      ativo: true,
      created_by: userId,
      adega_id: adegaId,
      cargo: data.cargo,
    });
    if (funcErr) throw new Error(funcErr.message);

    return { id: newUserId, username: data.username, cargo: data.cargo };
  });

export const resetFuncionarioPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), pin: pinSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await getAdminContext(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      password: data.pin,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setFuncionarioAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await getAdminContext(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("funcionarios")
      .update({ ativo: data.ativo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    const { error: bErr } = await supabaseAdmin.auth.admin.updateUserById(data.id, {
      ban_duration: data.ativo ? "none" : "876000h",
    });
    if (bErr) throw new Error(bErr.message);
    return { ok: true };
  });

export const deleteFuncionario = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await getAdminContext(supabase, userId);
    if (data.id === userId) throw new Error("Você não pode remover a si mesmo.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Remove funcionario primeiro (sem FK pra auth.users)
    await supabaseAdmin.from("funcionarios").delete().eq("id", data.id);
    // user_roles e profiles têm ON DELETE CASCADE em auth.users — basta deletar o usuário
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) {
      // fallback: limpa manualmente e ignora erro de auth (usuário pode ter referências)
      await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
      await supabaseAdmin.from("profiles").delete().eq("id", data.id);
      // soft-delete: bane o usuário pra impedir login
      await supabaseAdmin.auth.admin.updateUserById(data.id, { ban_duration: "876000h" });
    }
    return { ok: true };
  });

export const FUNCIONARIO_EMAIL_DOMAIN = FUNC_EMAIL_DOMAIN;

export const setFuncionarioPermissoes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        id: z.string().uuid(),
        permissoes: z.array(z.string().min(1).max(40)).max(20),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await getAdminContext(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("funcionarios")
      .update({ permissoes: data.permissoes })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
