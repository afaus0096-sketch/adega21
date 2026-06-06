import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  return (data ?? []).some((r: any) => r.role === "admin");
}

async function getNomeUsuario(supabase: any, userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", userId)
    .maybeSingle();
  return data?.nome ?? "—";
}

function hojeISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ===== STATUS =====
export const getCaixaStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data: aberto } = await supabase
      .from("caixas")
      .select("*")
      .eq("status", "aberto")
      .maybeSingle();

    const hoje = hojeISO();
    let pendente: any = null;
    if (aberto && aberto.data_dia < hoje) pendente = aberto;

    const caixaDeHoje =
      aberto && aberto.data_dia === hoje ? aberto : null;

    return { aberto, pendente, caixaDeHoje, hoje };
  });

export const listCaixas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("caixas")
      .select("*")
      .order("opened_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ===== ABRIR =====
export const abrirCaixa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        pin: z.string().min(1).max(64),
        brokenPassword: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 1. Valida PIN/senha do usuário logado (usando publishable key)
    const { data: userInfo } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (!userInfo.user?.email) throw new Error("Usuário inválido.");

    const { createClient } = await import("@supabase/supabase-js");
    const verify = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { error: pinErr } = await verify.auth.signInWithPassword({
      email: userInfo.user.email,
      password: data.pin,
    });
    if (pinErr) throw new Error("Senha/PIN incorreto.");

    // 2. Verifica se há caixa aberto
    const { data: aberto } = await supabase
      .from("caixas")
      .select("*")
      .eq("status", "aberto")
      .maybeSingle();

    const hoje = hojeISO();
    const nome = await getNomeUsuario(supabase, userId);
    let brokenUsado = false;

    if (aberto) {
      if (aberto.data_dia === hoje) {
        throw new Error("Já existe um caixa aberto para hoje.");
      }
      // Caixa de dia anterior pendente — exige senha de quebra
      if (!data.brokenPassword) {
        throw new Error(
          `PENDENTE:O caixa do dia ${aberto.data_dia} não foi finalizado. É necessário a senha "Broken Caixa" para forçar o fechamento.`,
        );
      }
      const okBroken = await validarBrokenPasswordInterno(
        data.brokenPassword,
      );
      if (!okBroken) throw new Error("Senha Broken Caixa incorreta.");

      // Fecha automaticamente o pendente
      const totais = await calcularTotaisDoCaixa(supabaseAdmin, aberto);
      await supabaseAdmin
        .from("caixas")
        .update({
          status: "fechado",
          closed_by: userId,
          closed_by_nome: nome,
          closed_at: new Date().toISOString(),
          total_vendas: totais.total,
          qtd_vendas: totais.qtd,
          broken_used: true,
          observacao: `Fechado via senha Broken por ${nome}`,
        })
        .eq("id", aberto.id);

      await supabaseAdmin.from("caixa_logs").insert({
        caixa_id: aberto.id,
        acao: "quebra_fechar",
        user_id: userId,
        user_nome: nome,
        detalhe: `Fechamento forçado do caixa de ${aberto.data_dia}`,
      });
      brokenUsado = true;
    }

    // 3. Insere novo caixa
    const { data: novo, error: insErr } = await supabaseAdmin
      .from("caixas")
      .insert({
        data_dia: hoje,
        opened_by: userId,
        opened_by_nome: nome,
        status: "aberto",
        broken_used: brokenUsado,
      })
      .select()
      .single();
    if (insErr) throw new Error(insErr.message);

    await supabaseAdmin.from("caixa_logs").insert({
      caixa_id: novo.id,
      acao: brokenUsado ? "abrir_com_quebra" : "abrir",
      user_id: userId,
      user_nome: nome,
      detalhe: brokenUsado
        ? "Caixa aberto após fechar pendente via Broken"
        : "Abertura normal",
    });

    return { id: novo.id, brokenUsado };
  });

// ===== FECHAR =====
export const fecharCaixa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), observacao: z.string().optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data: cx } = await supabase
      .from("caixas")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (!cx) throw new Error("Caixa não encontrado.");
    if (cx.status === "fechado") throw new Error("Esse caixa já está fechado.");

    const nome = await getNomeUsuario(supabase, userId);
    const totais = await calcularTotaisDoCaixa(supabaseAdmin, cx);

    await supabaseAdmin
      .from("caixas")
      .update({
        status: "fechado",
        closed_by: userId,
        closed_by_nome: nome,
        closed_at: new Date().toISOString(),
        total_vendas: totais.total,
        qtd_vendas: totais.qtd,
        observacao: data.observacao ?? null,
      })
      .eq("id", cx.id);

    await supabaseAdmin.from("caixa_logs").insert({
      caixa_id: cx.id,
      acao: "fechar",
      user_id: userId,
      user_nome: nome,
      detalhe: `Fechamento normal. Total: R$ ${totais.total.toFixed(2)}`,
    });

    return { ok: true, ...totais };
  });

async function calcularTotaisDoCaixa(supabaseAdmin: any, cx: any) {
  const { data } = await supabaseAdmin
    .from("vendas")
    .select("total")
    .gte("created_at", cx.opened_at)
    .lte("created_at", new Date().toISOString());
  const total = (data ?? []).reduce(
    (a: number, v: any) => a + Number(v.total),
    0,
  );
  return { total, qtd: (data ?? []).length };
}

// ===== BROKEN PASSWORD =====
const BROKEN_KEY = "broken_caixa_password_hash";

async function validarBrokenPasswordInterno(pwd: string): Promise<boolean> {
  const { supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", BROKEN_KEY)
    .maybeSingle();
  if (!data?.value) return false;
  const { data: result, error } = await (supabaseAdmin.rpc as any)(
    "crypt_check",
    { pwd, hash: data.value },
  );
  if (error) return false;
  return !!result;
}

export const hasBrokenPassword = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("key")
      .eq("key", BROKEN_KEY)
      .maybeSingle();
    return { exists: !!data };
  });

export const setBrokenPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ newPassword: z.string().min(4).max(64) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    if (!(await isAdmin(supabase, userId))) {
      throw new Error("Apenas administradores podem alterar a senha Broken.");
    }
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    // Gera hash via crypt() pgcrypto
    const { data: row, error } = await supabaseAdmin.rpc("crypt_hash", {
      pwd: data.newPassword,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("app_settings")
      .upsert({
        key: BROKEN_KEY,
        value: row as string,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      });
    return { ok: true };
  });
