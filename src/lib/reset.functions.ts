import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const opcoesSchema = z.object({
  vendas: z.boolean(),
  produtos: z.boolean(),
  estoque: z.boolean(),
  funcionarios: z.boolean(),
  confirmacao: z.literal("ZERAR"),
});

export const resetarDados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => opcoesSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as any;
    // Apenas admin pode chamar
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role, adega_id")
      .eq("user_id", userId);
    const adminRow = (roles ?? []).find((r: any) => r.role === "admin");
    if (!adminRow) throw new Error("Apenas o ADM pode zerar dados.");
    const adegaId = adminRow.adega_id as string;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const scope = (q: any) => q.eq("adega_id", adegaId);

    if (data.vendas) {
      await scope(supabaseAdmin.from("itens_venda").delete());
      await scope(supabaseAdmin.from("fluxo_caixa").delete());
      await scope(supabaseAdmin.from("vendas").delete());
      await scope(supabaseAdmin.from("itens_comanda").delete());
      await scope(supabaseAdmin.from("comandas").delete());
      await scope(supabaseAdmin.from("caixa_logs").delete());
      await scope(supabaseAdmin.from("caixas").delete());
    }
    if (data.estoque) {
      await scope(supabaseAdmin.from("movimentacoes_estoque").delete());
      await supabaseAdmin
        .from("produtos")
        .update({ estoque: 0 })
        .eq("adega_id", adegaId);
    }
    if (data.produtos) {
      // produtos depende de itens — limpa também
      await scope(supabaseAdmin.from("itens_venda").delete());
      await scope(supabaseAdmin.from("itens_comanda").delete());
      await scope(supabaseAdmin.from("movimentacoes_estoque").delete());
      await scope(supabaseAdmin.from("produtos").delete());
    }
    if (data.funcionarios) {
      const { data: funcs } = await supabaseAdmin
        .from("funcionarios")
        .select("id")
        .eq("adega_id", adegaId);
      for (const f of funcs ?? []) {
        if (f.id === userId) continue; // nunca remove o próprio ADM
        await supabaseAdmin.from("funcionarios").delete().eq("id", f.id);
        const { error } = await supabaseAdmin.auth.admin.deleteUser(f.id);
        if (error) {
          await supabaseAdmin.from("user_roles").delete().eq("user_id", f.id);
          await supabaseAdmin.from("profiles").delete().eq("id", f.id);
          await supabaseAdmin.auth.admin.updateUserById(f.id, { ban_duration: "876000h" });
        }
      }
    }
    return { ok: true };
  });
