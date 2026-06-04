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

async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  if (!(data ?? []).some((r: any) => r.role === "admin")) {
    throw new Error("Apenas administradores podem executar essa ação.");
  }
}

export const listFuncionarios = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
    const { data, error } = await supabase
      .from("funcionarios")
      .select("id, nome, username, ativo, created_at")
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
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = `${data.username}@${FUNC_EMAIL_DOMAIN}`;

    const { data: existing } = await supabase
      .from("funcionarios")
      .select("id")
      .eq("username", data.username)
      .maybeSingle();
    if (existing) throw new Error("Já existe um funcionário com esse usuário.");

    const { data: created, error: createErr } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.pin,
        email_confirm: true,
        user_metadata: { nome: data.nome, funcionario: true, username: data.username },
      });
    if (createErr || !created.user) {
      throw new Error(createErr?.message ?? "Falha ao criar usuário");
    }

    const newUserId = created.user.id;

    // O trigger handle_new_user pode ter inserido 'admin' (caso a tabela
    // user_roles estivesse vazia) ou 'caixa'. Forçamos 'caixa'.
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: newUserId, role: "caixa" });
    if (roleErr) throw new Error(roleErr.message);

    const { error: funcErr } = await supabaseAdmin.from("funcionarios").insert({
      id: newUserId,
      nome: data.nome,
      username: data.username,
      ativo: true,
      created_by: userId,
    });
    if (funcErr) throw new Error(funcErr.message);

    return { id: newUserId, username: data.username };
  });

export const resetFuncionarioPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), pin: pinSchema }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    await assertAdmin(supabase, userId);
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
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("funcionarios")
      .update({ ativo: data.ativo })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    // Banir/desbanir no auth para impedir login quando inativo
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
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("funcionarios").delete().eq("id", data.id);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.id);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const FUNCIONARIO_EMAIL_DOMAIN = FUNC_EMAIL_DOMAIN;
