import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Boxes, Plus, AlertTriangle } from "lucide-react";
import { dtBR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/estoque")({ component: Estoque });

const tipoLabel: Record<string, string> = {
  entrada_compra: "Compra fornecedor",
  entrada_ajuste: "Ajuste (+)",
  entrada_inventario: "Inventário",
  saida_venda: "Venda",
  saida_perda: "Perda",
  saida_quebra: "Quebra",
  saida_ajuste: "Ajuste (-)",
};

function Estoque() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ produto_id: "", tipo: "entrada_compra", quantidade: "", observacao: "" });

  const { data: produtos } = useQuery({
    queryKey: ["produtos-est"],
    queryFn: async () => (await supabase.from("produtos").select("id, nome, estoque, estoque_minimo").order("nome")).data ?? [],
  });
  const { data: movs } = useQuery({
    queryKey: ["movs"],
    queryFn: async () => (await supabase.from("movimentacoes_estoque").select("*, produtos(nome)").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });

  const baixos = (produtos ?? []).filter((p: any) => Number(p.estoque) <= Number(p.estoque_minimo) && Number(p.estoque_minimo) > 0);

  const salvar = async () => {
    if (!user || !form.produto_id || !form.quantidade) { toast.error("Preencha os campos"); return; }
    const qtd = Number(form.quantidade);
    const isEntrada = form.tipo.startsWith("entrada");
    const delta = isEntrada ? qtd : -qtd;

    const { error: e1 } = await supabase.from("movimentacoes_estoque").insert({
      produto_id: form.produto_id, tipo: form.tipo as any, quantidade: qtd, observacao: form.observacao || null, user_id: user.id,
    });
    if (e1) { toast.error(e1.message); return; }

    const p = (produtos ?? []).find((x: any) => x.id === form.produto_id);
    if (p) {
      const { error: e2 } = await supabase.from("produtos").update({ estoque: Number(p.estoque) + delta }).eq("id", form.produto_id);
      if (e2) { toast.error(e2.message); return; }
    }
    toast.success("Movimentação registrada");
    setOpen(false); setForm({ produto_id: "", tipo: "entrada_compra", quantidade: "", observacao: "" });
    qc.invalidateQueries({ queryKey: ["movs"] }); qc.invalidateQueries({ queryKey: ["produtos-est"] });
    qc.invalidateQueries({ queryKey: ["produtos"] }); qc.invalidateQueries({ queryKey: ["produtos-pdv"] });
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl display font-bold flex items-center gap-2"><Boxes className="w-7 h-7 text-accent" /> Estoque</h1>
          <p className="text-muted-foreground text-sm">Movimentações e alertas.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> Nova movimentação</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Movimentação manual</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Produto</Label>
                <Select value={form.produto_id} onValueChange={(v) => setForm({ ...form, produto_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{produtos?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.nome} (est: {Number(p.estoque)})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrada_compra">Entrada — Compra fornecedor</SelectItem>
                    <SelectItem value="entrada_ajuste">Entrada — Ajuste manual</SelectItem>
                    <SelectItem value="entrada_inventario">Entrada — Inventário</SelectItem>
                    <SelectItem value="saida_perda">Saída — Perda</SelectItem>
                    <SelectItem value="saida_quebra">Saída — Quebra</SelectItem>
                    <SelectItem value="saida_ajuste">Saída — Ajuste manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Quantidade</Label><Input type="number" step="0.01" value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: e.target.value })} /></div>
              <div><Label className="text-xs">Observação</Label><Input value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.target.value })} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={salvar}>Registrar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {baixos.length > 0 && (
        <Card className="border-warning/40 bg-warning/5">
          <CardHeader><CardTitle className="text-warning text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {baixos.length} produto(s) com estoque baixo</CardTitle></CardHeader>
          <CardContent><ul className="grid sm:grid-cols-2 gap-1 text-sm">
            {baixos.map((p: any) => <li key={p.id} className="flex justify-between border-b border-border py-1"><span>{p.nome}</span><span className="font-mono">{Number(p.estoque)} / mín {Number(p.estoque_minimo)}</span></li>)}
          </ul></CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="display">Histórico (últimas 100)</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/30 text-left">
                <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3 text-right">Qtd</th><th className="px-4 py-3">Obs</th></tr>
              </thead>
              <tbody>
                {(movs ?? []).map((m: any) => (
                  <tr key={m.id} className="border-t border-border">
                    <td className="px-4 py-2 text-muted-foreground">{dtBR(m.created_at)}</td>
                    <td className="px-4 py-2">{m.produtos?.nome ?? "—"}</td>
                    <td className="px-4 py-2"><span className={m.tipo.startsWith("entrada") ? "text-success" : "text-destructive"}>{tipoLabel[m.tipo]}</span></td>
                    <td className="px-4 py-2 text-right font-mono">{m.tipo.startsWith("entrada") ? "+" : "−"}{Number(m.quantidade)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{m.observacao ?? "—"}</td>
                  </tr>
                ))}
                {(!movs || movs.length === 0) && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Sem movimentações.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
