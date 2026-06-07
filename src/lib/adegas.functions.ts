import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const slugSchema = z
  .string()
  .min(2)
  .max(40)
  .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífen");

async function assertSuperAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "super_admin")
    .maybeSingle();
  if (!data) throw new Error("Apenas o Super Admin pode executar essa ação.");
}

// ===== Público: lista adegas ativas para o login =====
export const listAdegasAtivas = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("adegas")
      .select("id, nome, slug")
      .eq("ativo", true)
      .order("nome");
    if (error) throw new Error(error.message);
    return data ?? [];
  },
);

// ===== Lista todas (super_admin) =====
export const listAdegasAll = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;
    await assertSuperAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("adegas")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ===== Criar adega + primeiro ADM =====
export const createAdega = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        nome: z.string().trim().min(2).max(80),
        slug: slugSchema,
        adminEmail: z.string().email(),
        adminPassword: z.string().min(6).max(72),
        adminNome: z.string().trim().min(2).max(80),
        copiarProdutosDe: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertSuperAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Cria a adega
    const { data: adega, error: adErr } = await supabaseAdmin
      .from("adegas")
      .insert({
        nome: data.nome,
        slug: data.slug,
        ativo: true,
        created_by: userId,
      })
      .select()
      .single();
    if (adErr) throw new Error(adErr.message);

    // 2. Cria o usuário ADM no auth
    const { data: created, error: cErr } =
      await supabaseAdmin.auth.admin.createUser({
        email: data.adminEmail,
        password: data.adminPassword,
        email_confirm: true,
        user_metadata: { nome: data.adminNome, adega_id: adega.id },
      });
    if (cErr || !created.user) {
      await supabaseAdmin.from("adegas").delete().eq("id", adega.id);
      throw new Error(cErr?.message ?? "Falha ao criar ADM");
    }
    const newUserId = created.user.id;

    // 3. Garante role admin vinculado à nova adega
    await supabaseAdmin.from("user_roles").delete().eq("user_id", newUserId);
    const { error: rErr } = await supabaseAdmin.from("user_roles").insert({
      user_id: newUserId,
      role: "admin",
      adega_id: adega.id,
    });
    if (rErr) throw new Error(rErr.message);

    // 4. Atualiza profile com adega
    await supabaseAdmin
      .from("profiles")
      .update({ adega_id: adega.id })
      .eq("id", newUserId);

    // 5. Copia catálogo (categorias + produtos) se solicitado
    if (data.copiarProdutosDe) {
      // categorias
      const { data: cats } = await supabaseAdmin
        .from("categorias")
        .select("id, nome")
        .eq("adega_id", data.copiarProdutosDe);
      const mapaCat = new Map<string, string>();
      for (const c of cats ?? []) {
        const { data: nova } = await supabaseAdmin
          .from("categorias")
          .insert({ nome: c.nome, adega_id: adega.id })
          .select("id")
          .single();
        if (nova) mapaCat.set(c.id, nova.id);
      }
      // produtos
      const { data: prods } = await supabaseAdmin
        .from("produtos")
        .select(
          "nome, codigo_barras, codigo_interno, marca, preco_custo, preco_venda, estoque_minimo, categoria_id",
        )
        .eq("adega_id", data.copiarProdutosDe);
      if (prods && prods.length > 0) {
        const novos = prods.map((p: any) => ({
          nome: p.nome,
          codigo_barras: p.codigo_barras,
          codigo_interno: p.codigo_interno,
          marca: p.marca,
          preco_custo: p.preco_custo,
          preco_venda: p.preco_venda,
          estoque: 0,
          estoque_minimo: p.estoque_minimo,
          categoria_id: p.categoria_id ? mapaCat.get(p.categoria_id) ?? null : null,
          adega_id: adega.id,
        }));
        await supabaseAdmin.from("produtos").insert(novos);
      }
    }

    return { adega, adminId: newUserId };
  });

export const setAdegaAtivo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), ativo: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as any;
    await assertSuperAdmin(userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("adegas")
      .update({ ativo: data.ativo, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
