import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fornecedores")({ component: Fornecedores });

const empty = { razao_social: "", nome_fantasia: "", cnpj: "", telefone: "", email: "", endereco: "" };

function Fornecedores() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState(empty);

  const { data } = useQuery({
    queryKey: ["fornecedores"],
    queryFn: async () => (await supabase.from("fornecedores").select("*").order("razao_social")).data ?? [],
  });

  const save = async () => {
    if (!form.razao_social) { toast.error("Razão social obrigatória"); return; }
    const r = editing
      ? await supabase.from("fornecedores").update(form).eq("id", editing.id)
      : await supabase.from("fornecedores").insert(form);
    if (r.error) toast.error(r.error.message);
    else { toast.success("Salvo"); setOpen(false); qc.invalidateQueries({ queryKey: ["fornecedores"] }); }
  };
  const remove = async (id: string) => {
    if (!confirm("Excluir?")) return;
    const { error } = await supabase.from("fornecedores").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["fornecedores"] }); }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl display font-bold flex items-center gap-2"><Truck className="w-7 h-7 text-accent" /> Fornecedores</h1>
          <p className="text-muted-foreground text-sm">{data?.length ?? 0} cadastrados.</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(empty); } }}>
          <DialogTrigger asChild><Button onClick={() => { setEditing(null); setForm(empty); }}><Plus className="w-4 h-4 mr-1" /> Novo</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Editar" : "Novo"} fornecedor</DialogTitle></DialogHeader>
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Razão social *" className="sm:col-span-2"><Input value={form.razao_social} onChange={(e) => setForm({ ...form, razao_social: e.target.value })} /></Field>
              <Field label="Nome fantasia"><Input value={form.nome_fantasia} onChange={(e) => setForm({ ...form, nome_fantasia: e.target.value })} /></Field>
              <Field label="CNPJ"><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></Field>
              <Field label="Telefone"><Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field>
              <Field label="E-mail"><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Endereço" className="sm:col-span-2"><Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></Field>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground bg-muted/30 text-left">
              <tr><th className="px-4 py-3">Razão Social</th><th className="px-4 py-3">CNPJ</th><th className="px-4 py-3">Contato</th><th className="px-4 py-3"></th></tr>
            </thead>
            <tbody>
              {(data ?? []).map((f: any) => (
                <tr key={f.id} className="border-t border-border">
                  <td className="px-4 py-3"><div className="font-medium">{f.razao_social}</div>{f.nome_fantasia && <div className="text-xs text-muted-foreground">{f.nome_fantasia}</div>}</td>
                  <td className="px-4 py-3 text-muted-foreground font-mono">{f.cnpj ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.telefone ?? f.email ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(f); setForm({ razao_social: f.razao_social, nome_fantasia: f.nome_fantasia ?? "", cnpj: f.cnpj ?? "", telefone: f.telefone ?? "", email: f.email ?? "", endereco: f.endereco ?? "" }); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => remove(f.id)}><Trash2 className="w-4 h-4" /></Button>
                  </td>
                </tr>
              ))}
              {(!data || data.length === 0) && <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">Nenhum fornecedor.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><Label className="mb-1.5 block text-xs">{label}</Label>{children}</div>;
}
