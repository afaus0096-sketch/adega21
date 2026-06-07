import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";
import { listAdegasAll, createAdega, setAdegaAtivo } from "@/lib/adegas.functions";

export const Route = createFileRoute("/_authenticated/super-admin")({
  component: SuperAdminPage,
});

function SuperAdminPage() {
  const { isSuperAdmin } = useAuth();
  if (!isSuperAdmin) return <Navigate to="/dashboard" replace />;

  const qc = useQueryClient();
  const listFn = useServerFn(listAdegasAll);
  const createFn = useServerFn(createAdega);
  const toggleFn = useServerFn(setAdegaAtivo);

  const { data: adegas, isLoading } = useQuery({
    queryKey: ["adegas-all"],
    queryFn: () => listFn() as Promise<any[]>,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nome: "", slug: "", adminNome: "", adminEmail: "", adminPassword: "",
    copiarProdutosDe: "" as string,
  });

  const create = useMutation({
    mutationFn: () => createFn({ data: {
      nome: form.nome,
      slug: form.slug,
      adminNome: form.adminNome,
      adminEmail: form.adminEmail,
      adminPassword: form.adminPassword,
      copiarProdutosDe: form.copiarProdutosDe || undefined,
    } }),
    onSuccess: () => {
      toast.success("Adega criada com sucesso!");
      setOpen(false);
      setForm({ nome: "", slug: "", adminNome: "", adminEmail: "", adminPassword: "", copiarProdutosDe: "" });
      qc.invalidateQueries({ queryKey: ["adegas-all"] });
      qc.invalidateQueries({ queryKey: ["adegas-publicas"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar"),
  });

  const toggle = useMutation({
    mutationFn: (v: { id: string; ativo: boolean }) =>
      toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adegas-all"] }),
  });

  const podeCriar =
    form.nome.length > 1 &&
    /^[a-z0-9-]{2,40}$/.test(form.slug) &&
    form.adminNome.length > 1 &&
    /^.+@.+\..+$/.test(form.adminEmail) &&
    form.adminPassword.length >= 6;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="display text-3xl font-bold flex items-center gap-2">
            <Building2 className="w-7 h-7 text-accent" /> Adegas (Super Admin)
          </h1>
          <p className="text-muted-foreground text-sm">
            Gerencie todas as adegas do sistema.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-1" /> Nova adega</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Criar nova adega</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Nome da adega</Label>
                <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Adega do Centro" />
              </div>
              <div>
                <Label>Slug (identificador único)</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder="adega-centro" />
                <p className="text-xs text-muted-foreground mt-1">Letras minúsculas, números e hífen. Usado nos logins de funcionário.</p>
              </div>
              <div className="border-t pt-3 mt-2">
                <p className="text-sm font-medium mb-2">Primeiro administrador da adega</p>
                <div className="space-y-2">
                  <div>
                    <Label>Nome</Label>
                    <Input value={form.adminNome} onChange={(e) => setForm({ ...form, adminNome: e.target.value })} />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input type="email" value={form.adminEmail} onChange={(e) => setForm({ ...form, adminEmail: e.target.value })} />
                  </div>
                  <div>
                    <Label>Senha (mín. 6)</Label>
                    <Input type="password" value={form.adminPassword} onChange={(e) => setForm({ ...form, adminPassword: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="border-t pt-3">
                <Label>Importar catálogo de outra adega (opcional)</Label>
                <Select value={form.copiarProdutosDe || "none"} onValueChange={(v) => setForm({ ...form, copiarProdutosDe: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Não importar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Não importar</SelectItem>
                    {(adegas ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Copia categorias e produtos (sem estoque).</p>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => create.mutate()} disabled={!podeCriar || create.isPending}>
                {create.isPending ? "Criando…" : "Criar adega"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adegas cadastradas</CardTitle>
          <CardDescription>{adegas?.length ?? 0} adega(s)</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <p className="text-muted-foreground">Carregando…</p> : (
            <div className="space-y-2">
              {(adegas ?? []).map((a: any) => (
                <div key={a.id} className="flex items-center justify-between border rounded-lg p-3">
                  <div>
                    <div className="font-medium">{a.nome}</div>
                    <div className="text-xs text-muted-foreground">slug: {a.slug}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{a.ativo ? "Ativa" : "Inativa"}</span>
                    <Switch
                      checked={a.ativo}
                      onCheckedChange={(v) => toggle.mutate({ id: a.id, ativo: v })}
                    />
                  </div>
                </div>
              ))}
              {(adegas ?? []).length === 0 && (
                <p className="text-muted-foreground text-center py-6">Nenhuma adega ainda.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
