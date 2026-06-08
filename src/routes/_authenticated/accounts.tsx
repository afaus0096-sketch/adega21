import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Building2, Plus, Power, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { listAdegasAll, createAdega, toggleAdega, listAccounts, createAccount } from "@/lib/adegas.functions";

export const Route = createFileRoute("/_authenticated/accounts")({ component: AccountsPage });

function AccountsPage() {
  const { role } = useAuth();
  if (role !== "super_admin") return <Navigate to="/dashboard" replace />;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="display text-3xl font-bold flex items-center gap-2">
          <Building2 className="w-7 h-7 text-accent" /> Accounts
        </h1>
        <p className="text-muted-foreground text-sm">
          Gerencie adegas (tenants) e as contas administradoras de cada uma.
        </p>
      </div>

      <Tabs defaultValue="adegas">
        <TabsList>
          <TabsTrigger value="adegas">Adegas</TabsTrigger>
          <TabsTrigger value="accounts">Contas</TabsTrigger>
        </TabsList>
        <TabsContent value="adegas" className="mt-4"><AdegasPanel /></TabsContent>
        <TabsContent value="accounts" className="mt-4"><AccountsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

function AdegasPanel() {
  const qc = useQueryClient();
  const listFn = useServerFn(listAdegasAll);
  const createFn = useServerFn(createAdega);
  const toggleFn = useServerFn(toggleAdega);

  const { data: adegas = [] } = useQuery({
    queryKey: ["adegas-all"],
    queryFn: () => listFn() as Promise<Array<{ id: string; nome: string; slug: string; ativo: boolean }>>,
  });

  const [nome, setNome] = useState("");
  const [slug, setSlug] = useState("");

  const createMut = useMutation({
    mutationFn: () => createFn({ data: { nome, slug } }),
    onSuccess: () => {
      toast.success("Adega criada.");
      setNome(""); setSlug("");
      qc.invalidateQueries({ queryKey: ["adegas-all"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; ativo: boolean }) => toggleFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adegas-all"] }),
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Plus className="w-5 h-5" /> Nova adega</CardTitle>
          <CardDescription>Cada adega tem dados isolados: produtos, vendas, estoque, funcionários.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Adega do João" />
          </div>
          <div>
            <Label>Slug (identificador)</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="adega-joao"
            />
            <p className="text-xs text-muted-foreground mt-1">Use letras minúsculas, números e hífen.</p>
          </div>
          <Button
            disabled={nome.length < 2 || slug.length < 2 || createMut.isPending}
            onClick={() => createMut.mutate()}
          >
            {createMut.isPending ? "Criando…" : "Criar adega"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Adegas cadastradas</CardTitle>
          <CardDescription>{adegas.length} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {adegas.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma adega.</p>}
          {adegas.map((a) => (
            <div key={a.id} className="flex items-center justify-between border rounded-lg p-3">
              <div>
                <div className="font-medium">{a.nome}</div>
                <div className="text-xs text-muted-foreground">/{a.slug}</div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={a.ativo ? "default" : "secondary"}>{a.ativo ? "Ativa" : "Inativa"}</Badge>
                <Button size="sm" variant="outline" onClick={() => toggleMut.mutate({ id: a.id, ativo: !a.ativo })}>
                  <Power className="w-3.5 h-3.5 mr-1" />
                  {a.ativo ? "Desativar" : "Ativar"}
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function AccountsPanel() {
  const qc = useQueryClient();
  const listAd = useServerFn(listAdegasAll);
  const listAcc = useServerFn(listAccounts);
  const createAcc = useServerFn(createAccount);

  const { data: adegas = [] } = useQuery({
    queryKey: ["adegas-all"],
    queryFn: () => listAd() as Promise<Array<{ id: string; nome: string; ativo: boolean }>>,
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts-list"],
    queryFn: () => listAcc() as Promise<Array<{ user_id: string; email: string; nome: string; adega_nome: string }>>,
  });

  const [adegaId, setAdegaId] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");

  const mut = useMutation({
    mutationFn: () => createAcc({ data: { adega_id: adegaId, nome, email, password: pwd } }),
    onSuccess: () => {
      toast.success("Conta criada.");
      setNome(""); setEmail(""); setPwd(""); setAdegaId("");
      qc.invalidateQueries({ queryKey: ["accounts-list"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const podeCriar = adegaId && nome.length >= 2 && /.+@.+\..+/.test(email) && pwd.length >= 6 && !mut.isPending;

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><UserPlus className="w-5 h-5" /> Nova conta ADM</CardTitle>
          <CardDescription>Cria um administrador (dono) para a adega selecionada.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Adega</Label>
            <Select value={adegaId} onValueChange={setAdegaId}>
              <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
              <SelectContent>
                {adegas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.nome}{!a.ativo && " (inativa)"}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Nome do responsável</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Senha (mín. 6)</Label>
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </div>
          <Button onClick={() => mut.mutate()} disabled={!podeCriar}>
            {mut.isPending ? "Criando…" : "Criar conta"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Contas cadastradas</CardTitle>
          <CardDescription>{accounts.length} total</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {accounts.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta.</p>}
          {accounts.map((a) => (
            <div key={a.user_id} className="border rounded-lg p-3">
              <div className="font-medium">{a.nome}</div>
              <div className="text-xs text-muted-foreground">{a.email}</div>
              <Badge variant="outline" className="mt-1">{a.adega_nome}</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
