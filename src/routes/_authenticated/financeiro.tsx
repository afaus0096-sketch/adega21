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
import { Wallet, Plus, ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { brl, dtBR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/financeiro")({ component: Financeiro });

function Financeiro() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tipo: "saida", categoria: "Despesa", descricao: "", valor: "" });

  const { data: fluxo } = useQuery({
    queryKey: ["fluxo"],
    queryFn: async () => (await supabase.from("fluxo_caixa").select("*").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });
  const { data: produtos } = useQuery({
    queryKey: ["fin-produtos"],
    queryFn: async () => (await supabase.from("produtos").select("preco_custo, preco_venda")).data ?? [],
  });
  const { data: vendasMes } = useQuery({
    queryKey: ["fin-vendas"],
    queryFn: async () => {
      const d = new Date(); d.setDate(1); d.setHours(0,0,0,0);
      return (await supabase.from("vendas").select("total").gte("created_at", d.toISOString())).data ?? [];
    },
  });
  const { data: itensMes } = useQuery({
    queryKey: ["fin-itens"],
    queryFn: async () => {
      const d = new Date(); d.setDate(1); d.setHours(0,0,0,0);
      return (await supabase.from("itens_venda").select("subtotal, quantidade, produtos:produto_id(preco_custo)").gte("created_at", d.toISOString())).data ?? [];
    },
  });

  const entradas = (fluxo ?? []).filter((f: any) => f.tipo === "entrada").reduce((a: number, f: any) => a + Number(f.valor), 0);
  const saidas = (fluxo ?? []).filter((f: any) => f.tipo === "saida").reduce((a: number, f: any) => a + Number(f.valor), 0);
  const saldo = entradas - saidas;

  const fatMes = (vendasMes ?? []).reduce((a, v: any) => a + Number(v.total), 0);
  const custoMes = (itensMes ?? []).reduce((a, i: any) => a + Number(i.quantidade) * Number(i.produtos?.preco_custo ?? 0), 0);
  const lucroBruto = fatMes - custoMes;

  const salvar = async () => {
    if (!form.descricao || !form.valor) { toast.error("Preencha os campos"); return; }
    const { error } = await supabase.from("fluxo_caixa").insert({
      tipo: form.tipo as any, categoria: form.categoria, descricao: form.descricao, valor: Number(form.valor), user_id: user?.id ?? null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Lançado"); setOpen(false); setForm({ tipo: "saida", categoria: "Despesa", descricao: "", valor: "" }); qc.invalidateQueries({ queryKey: ["fluxo"] }); }
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir lançamento?")) return;
    const { error } = await supabase.from("fluxo_caixa").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["fluxo"] }); }
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-3xl display font-bold flex items-center gap-2"><Wallet className="w-7 h-7 text-accent" /> Financeiro</h1>
          <p className="text-muted-foreground text-sm">Fluxo de caixa e lucratividade.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 mr-1" /> Lançamento</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo lançamento</DialogTitle></DialogHeader>
            <div className="grid sm:grid-cols-2 gap-3">
              <div><Label className="text-xs">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="entrada">Entrada</SelectItem><SelectItem value="saida">Saída</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Categoria</Label>
                <Select value={form.categoria} onValueChange={(v) => setForm({ ...form, categoria: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Recebimento">Recebimento</SelectItem>
                    <SelectItem value="Compra">Compra de mercadoria</SelectItem>
                    <SelectItem value="Despesa">Despesa</SelectItem>
                    <SelectItem value="Salário">Salário</SelectItem>
                    <SelectItem value="Conta">Conta</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2"><Label className="text-xs">Descrição</Label><Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label className="text-xs">Valor (R$)</Label><Input type="number" step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={salvar}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Entradas</div><div className="text-2xl font-bold text-success">{brl(entradas)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Saídas</div><div className="text-2xl font-bold text-destructive">{brl(saidas)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Saldo</div><div className={`text-2xl font-bold ${saldo>=0?"text-accent":"text-destructive"}`}>{brl(saldo)}</div></CardContent></Card>
        <Card className="bg-gradient-to-br from-primary/15 to-card border-primary/30"><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Lucro bruto (mês)</div><div className="text-2xl font-bold text-accent">{brl(lucroBruto)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display">Fluxo de Caixa</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/30 text-left">
                <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3 text-right">Valor</th><th></th></tr>
              </thead>
              <tbody>
                {(fluxo ?? []).map((f: any) => (
                  <tr key={f.id} className="border-t border-border">
                    <td className="px-4 py-2 text-muted-foreground">{dtBR(f.created_at)}</td>
                    <td className="px-4 py-2"><span className="inline-flex items-center gap-1">{f.tipo === "entrada" ? <ArrowUp className="w-3 h-3 text-success" /> : <ArrowDown className="w-3 h-3 text-destructive" />} {f.categoria}</span></td>
                    <td className="px-4 py-2">{f.descricao ?? "—"}</td>
                    <td className={`px-4 py-2 text-right font-mono font-semibold ${f.tipo === "entrada" ? "text-success" : "text-destructive"}`}>{f.tipo === "entrada" ? "+" : "−"}{brl(Number(f.valor))}</td>
                    <td className="px-4 py-2 text-right">
                      {!f.venda_id && <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => remove(f.id)}><Trash2 className="w-3 h-3" /></Button>}
                    </td>
                  </tr>
                ))}
                {(!fluxo || fluxo.length === 0) && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Nenhum lançamento.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
