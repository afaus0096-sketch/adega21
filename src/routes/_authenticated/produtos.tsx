import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Package, AlertTriangle } from "lucide-react";
import { brl } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/produtos")({ component: Produtos });

type Produto = any;
const empty = {
  codigo_interno: "", codigo_barras: "", nome: "", categoria_id: "", marca: "",
  fornecedor_id: "", preco_custo: "0", preco_venda: "0", estoque: "0", estoque_minimo: "0", ativo: true,
};

function Produtos() {
  const { role } = useAuth();
  const isAdmin = role === "admin";
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState<any>(empty);

  const { data: produtos } = useQuery({
    queryKey: ["produtos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("*, categorias(nome), fornecedores(razao_social)").order("nome");
      if (error) throw error;
      return data as any[];
    },
  });
  const { data: categorias } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => (await supabase.from("categorias").select("*").order("nome")).data ?? [],
  });
  const { data: fornecedores } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => (await supabase.from("fornecedores").select("*").order("razao_social")).data ?? [],
  });

  const filtered = (produtos ?? []).filter((p) => {
    const q = busca.toLowerCase();
    return !q || p.nome.toLowerCase().includes(q) || p.codigo_interno?.toLowerCase().includes(q) || p.codigo_barras?.toLowerCase().includes(q);
  });

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (p: any) => {
    setEditing(p);
    setForm({
      codigo_interno: p.codigo_interno, codigo_barras: p.codigo_barras ?? "", nome: p.nome,
      categoria_id: p.categoria_id ?? "", marca: p.marca ?? "", fornecedor_id: p.fornecedor_id ?? "",
      preco_custo: String(p.preco_custo), preco_venda: String(p.preco_venda),
      estoque: String(p.estoque), estoque_minimo: String(p.estoque_minimo), ativo: p.ativo,
    });
    setOpen(true);
  };

  const save = async () => {
    const payload: any = {
      codigo_interno: form.codigo_interno.trim(),
      codigo_barras: form.codigo_barras.trim() || null,
      nome: form.nome.trim(),
      categoria_id: form.categoria_id || null,
      marca: form.marca || null,
      fornecedor_id: form.fornecedor_id || null,
      preco_custo: Number(form.preco_custo),
      preco_venda: Number(form.preco_venda),
      estoque: Number(form.estoque),
      estoque_minimo: Number(form.estoque_minimo),
      ativo: form.ativo,
    };
    if (!payload.nome || !payload.codigo_interno) { toast.error("Nome e código interno são obrigatórios"); return; }

    const r = editing
      ? await supabase.from("produtos").update(payload).eq("id", editing.id)
      : await supabase.from("produtos").insert(payload);
    if (r.error) { toast.error(r.error.message); return; }
    toast.success(editing ? "Produto atualizado" : "Produto criado");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["produtos"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Produto excluído"); qc.invalidateQueries({ queryKey: ["produtos"] }); }
  };

  const seedDemo = async () => {
    if (!categorias?.length) { toast.error("Sem categorias"); return; }
    const cat = (n: string) => categorias.find((c: any) => c.nome === n)?.id ?? null;
    const demo = [
      ["SKL350","7891991010955","Skol Lata 350ml","Cervejas","Skol",3.5,5.5,120,24],
      ["BRH350","7891149102104","Brahma Lata 350ml","Cervejas","Brahma",3.5,5.5,100,24],
      ["HEILN","7896045506361","Heineken Long Neck","Cervejas","Heineken",6.0,9.5,80,12],
      ["BUDLN","7896045500604","Budweiser Long Neck","Cervejas","Budweiser",5.5,8.9,60,12],
      ["CORX","7501064100536","Corona Extra","Cervejas","Corona",7.0,11.0,48,12],
      ["RB250","9002490100070","Red Bull 250ml","Energéticos","Red Bull",6.5,10.0,72,12],
      ["COCA2","7894900011517","Coca-Cola 2L","Refrigerantes","Coca-Cola",6.5,11.5,30,6],
      ["GUA2","7891991010719","Guaraná Antarctica 2L","Refrigerantes","Antarctica",5.5,9.9,30,6],
      ["AGUA","7896005800010","Água Mineral 500ml","Água","Crystal",1.0,3.0,90,24],
      ["GEL5","9999999999912","Gelo 5kg","Gelo",null,7.0,15.0,20,5],
      ["CARV","9999999999929","Carvão 5kg","Carvão",null,12.0,25.0,15,5],
    ] as const;
    const payload = demo.map(([codigo_interno, codigo_barras, nome, c, marca, custo, venda, est, min]) => ({
      codigo_interno, codigo_barras, nome, categoria_id: cat(c as string), marca: marca as any,
      preco_custo: custo, preco_venda: venda, estoque: est, estoque_minimo: min, ativo: true,
    }));
    const { error } = await supabase.from("produtos").upsert(payload, { onConflict: "codigo_interno" });
    if (error) toast.error(error.message);
    else { toast.success("Produtos de demonstração cadastrados"); qc.invalidateQueries({ queryKey: ["produtos"] }); }
  };

  return (
    <div className="space-y-4 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl display font-bold flex items-center gap-2"><Package className="w-7 h-7 text-accent" /> Produtos</h1>
          <p className="text-muted-foreground text-sm">{filtered.length} produtos cadastrados.</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {(!produtos || produtos.length === 0) && (
              <Button variant="outline" onClick={seedDemo}>Carregar demonstração</Button>
            )}
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo produto</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} produto</DialogTitle></DialogHeader>
                <div className="grid sm:grid-cols-2 gap-3">
                  <Field label="Código interno *"><Input value={form.codigo_interno} onChange={(e) => setForm({ ...form, codigo_interno: e.target.value })} /></Field>
                  <Field label="Código de barras"><Input value={form.codigo_barras} onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })} /></Field>
                  <Field label="Nome *" className="sm:col-span-2"><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
                  <Field label="Categoria">
                    <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>{categorias?.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Marca"><Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} /></Field>
                  <Field label="Fornecedor" className="sm:col-span-2">
                    <Select value={form.fornecedor_id} onValueChange={(v) => setForm({ ...form, fornecedor_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                      <SelectContent>{fornecedores?.map((f: any) => <SelectItem key={f.id} value={f.id}>{f.razao_social}</SelectItem>)}</SelectContent>
                    </Select>
                  </Field>
                  <Field label="Preço de custo"><Input type="number" step="0.01" value={form.preco_custo} onChange={(e) => setForm({ ...form, preco_custo: e.target.value })} /></Field>
                  <Field label="Preço de venda"><Input type="number" step="0.01" value={form.preco_venda} onChange={(e) => setForm({ ...form, preco_venda: e.target.value })} /></Field>
                  <Field label="Estoque atual"><Input type="number" step="0.01" value={form.estoque} onChange={(e) => setForm({ ...form, estoque: e.target.value })} /></Field>
                  <Field label="Estoque mínimo"><Input type="number" step="0.01" value={form.estoque_minimo} onChange={(e) => setForm({ ...form, estoque_minimo: e.target.value })} /></Field>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} id="ativo" />
                    <Label htmlFor="ativo">Produto ativo</Label>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button onClick={save}>Salvar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="pb-3"><Input placeholder="Buscar por nome ou código…" value={busca} onChange={(e) => setBusca(e.target.value)} /></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground bg-muted/30">
                <tr>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3 text-right">Custo</th>
                  <th className="px-4 py-3 text-right">Venda</th>
                  <th className="px-4 py-3 text-right">Estoque</th>
                  <th className="px-4 py-3">Status</th>
                  {isAdmin && <th className="px-4 py-3"></th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-muted-foreground">Nenhum produto.</td></tr>}
                {filtered.map((p: any) => {
                  const baixo = Number(p.estoque) <= Number(p.estoque_minimo) && Number(p.estoque_minimo) > 0;
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{p.nome}</div>
                        <div className="text-xs text-muted-foreground">{p.codigo_interno} {p.codigo_barras && `· ${p.codigo_barras}`}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{p.categorias?.nome ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono">{brl(Number(p.preco_custo))}</td>
                      <td className="px-4 py-3 text-right font-mono font-semibold text-accent">{brl(Number(p.preco_venda))}</td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className={baixo ? "text-warning font-semibold" : ""}>{Number(p.estoque)}</span>
                        {baixo && <AlertTriangle className="inline w-3 h-3 ml-1 text-warning" />}
                      </td>
                      <td className="px-4 py-3">{p.ativo ? <Badge variant="secondary">Ativo</Badge> : <Badge variant="outline">Inativo</Badge>}</td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-right">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(p.id)}><Trash2 className="w-4 h-4" /></Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="mb-1.5 block text-xs">{label}</Label>{children}</div>;
}
