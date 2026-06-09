import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger, DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Crown, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/vips")({ component: VipsPage });

type Vip = {
  id: string;
  nome: string;
  telefone: string | null;
  observacoes: string | null;
  credito: number;
  limite_fiado: number;
  fiado_atual: number;
  rosh_credito: number;
  rosh_fiado_limite: number;
  rosh_fiado_atual: number;
  ativo: boolean;
};

const empty = {
  nome: "",
  telefone: "",
  observacoes: "",
  credito: "0",
  limite_fiado: "0",
  fiado_atual: "0",
  rosh_credito: "0",
  rosh_fiado_limite: "0",
  rosh_fiado_atual: "0",
  ativo: true,
};

function brl(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function VipsPage() {
  const { role } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Vip | null>(null);
  const [form, setForm] = useState(empty);
  const isAdmin = role === "admin";

  const { data } = useQuery({
    queryKey: ["vips"],
    queryFn: async () =>
      ((await supabase.from("vips").select("*").order("nome")).data ?? []) as Vip[],
  });

  const openNew = () => { setEditing(null); setForm(empty); setOpen(true); };
  const openEdit = (v: Vip) => {
    setEditing(v);
    setForm({
      nome: v.nome,
      telefone: v.telefone ?? "",
      observacoes: v.observacoes ?? "",
      credito: String(v.credito),
      limite_fiado: String(v.limite_fiado),
      fiado_atual: String(v.fiado_atual),
      rosh_credito: String(v.rosh_credito),
      rosh_fiado_limite: String(v.rosh_fiado_limite),
      rosh_fiado_atual: String(v.rosh_fiado_atual),
      ativo: v.ativo,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = {
      nome: form.nome.trim(),
      telefone: form.telefone || null,
      observacoes: form.observacoes || null,
      credito: Number(form.credito) || 0,
      limite_fiado: Number(form.limite_fiado) || 0,
      fiado_atual: Number(form.fiado_atual) || 0,
      rosh_credito: parseInt(form.rosh_credito) || 0,
      rosh_fiado_limite: parseInt(form.rosh_fiado_limite) || 0,
      rosh_fiado_atual: parseInt(form.rosh_fiado_atual) || 0,
      ativo: form.ativo,
    };
    const r = editing
      ? await supabase.from("vips").update(payload).eq("id", editing.id)
      : await supabase.from("vips").insert(payload);
    if (r.error) toast.error(r.error.message);
    else {
      toast.success("Salvo");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["vips"] });
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este VIP?")) return;
    const { error } = await supabase.from("vips").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["vips"] }); }
  };

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl display font-bold flex items-center gap-2">
            <Crown className="w-7 h-7 text-accent" /> VIPs
          </h1>
          <p className="text-muted-foreground text-sm">
            {data?.length ?? 0} cliente(s) cadastrado(s).
          </p>
        </div>
        {isAdmin && (
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo VIP</Button>
        )}
      </div>

      {!isAdmin && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="p-4 text-sm flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-amber-500 mt-0.5" />
            <span>Apenas o administrador pode criar ou alterar valores de crédito, fiado e rosh.</span>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3">
        {(data ?? []).map((v) => {
          const fiadoDisp = Math.max(0, v.limite_fiado - v.fiado_atual);
          const roshFiadoDisp = Math.max(0, v.rosh_fiado_limite - v.rosh_fiado_atual);
          return (
            <Card key={v.id} className={!v.ativo ? "opacity-60" : ""}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold flex items-center gap-2">
                      <Crown className="w-4 h-4 text-accent" /> {v.nome}
                      {!v.ativo && <span className="text-xs text-muted-foreground">(inativo)</span>}
                    </div>
                    {v.telefone && <div className="text-xs text-muted-foreground">{v.telefone}</div>}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(v)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(v.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <Stat label="Crédito" value={brl(v.credito)} tone="good" />
                  <Stat label="Fiado disponível" value={brl(fiadoDisp)} sub={`Devendo ${brl(v.fiado_atual)} / Limite ${brl(v.limite_fiado)}`} />
                  <Stat label="Rosh crédito" value={String(v.rosh_credito)} tone="good" />
                  <Stat label="Rosh fiado disp." value={String(roshFiadoDisp)} sub={`Devendo ${v.rosh_fiado_atual} / Limite ${v.rosh_fiado_limite}`} />
                </div>
                {v.observacoes && (
                  <p className="text-xs text-muted-foreground border-t pt-2">{v.observacoes}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
        {data && data.length === 0 && (
          <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Nenhum VIP cadastrado.</CardContent></Card>
        )}
      </div>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm(empty); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar" : "Novo"} VIP</DialogTitle>
            <DialogDescription>
              Apenas administradores podem configurar crédito, limite de fiado e rosh.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="Nome *" className="sm:col-span-2">
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
              </Field>
              <Field label="Telefone">
                <Input value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
              </Field>
              <Field label="Ativo">
                <div className="flex items-center h-10">
                  <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                </div>
              </Field>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <div className="text-sm font-semibold">Crédito e Fiado (R$)</div>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Crédito (pré-pago)">
                  <Input type="number" step="0.01" min="0" value={form.credito}
                    onChange={(e) => setForm({ ...form, credito: e.target.value })} />
                </Field>
                <Field label="Limite de fiado">
                  <Input type="number" step="0.01" min="0" value={form.limite_fiado}
                    onChange={(e) => setForm({ ...form, limite_fiado: e.target.value })} />
                </Field>
                <Field label="Fiado atual (devendo)">
                  <Input type="number" step="0.01" min="0" value={form.fiado_atual}
                    onChange={(e) => setForm({ ...form, fiado_atual: e.target.value })} />
                </Field>
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <div className="text-sm font-semibold">Rosh (quantidade)</div>
              <div className="grid sm:grid-cols-3 gap-3">
                <Field label="Rosh crédito">
                  <Input type="number" step="1" min="0" value={form.rosh_credito}
                    onChange={(e) => setForm({ ...form, rosh_credito: e.target.value })} />
                </Field>
                <Field label="Limite rosh fiado">
                  <Input type="number" step="1" min="0" value={form.rosh_fiado_limite}
                    onChange={(e) => setForm({ ...form, rosh_fiado_limite: e.target.value })} />
                </Field>
                <Field label="Rosh fiado atual">
                  <Input type="number" step="1" min="0" value={form.rosh_fiado_atual}
                    onChange={(e) => setForm({ ...form, rosh_fiado_atual: e.target.value })} />
                </Field>
              </div>
            </div>

            <Field label="Observações">
              <Textarea rows={3} value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })} />
            </Field>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" }) {
  return (
    <div className="border rounded-md p-2">
      <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className={`font-semibold ${tone === "good" ? "text-emerald-500" : ""}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
