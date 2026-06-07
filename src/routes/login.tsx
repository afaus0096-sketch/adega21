import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Wine, Shield, User, Crown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { listAdegasAtivas } from "@/lib/adegas.functions";

export const Route = createFileRoute("/login")({ component: LoginPage });

const FUNC_DOMAIN = "funcionarios.adega.local";

function funcionarioEmail(slug: string, username: string) {
  return slug === "principal"
    ? `${username}@${FUNC_DOMAIN}`
    : `${slug}.${username}@${FUNC_DOMAIN}`;
}

function LoginPage() {
  const { user, signIn, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("adm");

  const listFn = useServerFn(listAdegasAtivas);
  const { data: adegas } = useQuery({
    queryKey: ["adegas-publicas"],
    queryFn: () => listFn() as Promise<{ id: string; nome: string; slug: string }[]>,
  });

  const [adegaId, setAdegaId] = useState<string>("");
  // ADM
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Funcionário
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  // Super Admin
  const [superEmail, setSuperEmail] = useState("");
  const [superPwd, setSuperPwd] = useState("");

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  // Seleciona primeira adega ativa por padrão
  useEffect(() => {
    if (!adegaId && adegas && adegas.length > 0) setAdegaId(adegas[0].id);
  }, [adegas, adegaId]);

  const adegaSelecionada = adegas?.find((a) => a.id === adegaId);

  async function validarAdega(uid: string, esperado: string) {
    const { data } = await supabase
      .from("user_roles")
      .select("adega_id, role")
      .eq("user_id", uid);
    const ok =
      (data ?? []).some(
        (r) => r.role === "super_admin" || r.adega_id === esperado,
      );
    return ok;
  }

  const submitAdm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adegaSelecionada) { toast.error("Selecione a adega."); return; }
    setBusy(true);
    const r = await signIn(email, password);
    if (r.error) { setBusy(false); toast.error(r.error); return; }
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u && !(await validarAdega(u.id, adegaSelecionada.id))) {
      await supabase.auth.signOut();
      setBusy(false);
      toast.error("Esse usuário não pertence à adega selecionada.");
      return;
    }
    setBusy(false);
  };

  const submitFunc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adegaSelecionada) { toast.error("Selecione a adega."); return; }
    if (!/^[a-z0-9_.-]+$/.test(username)) { toast.error("Usuário inválido."); return; }
    if (!/^\d{6}$/.test(pin)) { toast.error("PIN deve ter 6 dígitos."); return; }
    setBusy(true);
    const { error, data } = await supabase.auth.signInWithPassword({
      email: funcionarioEmail(adegaSelecionada.slug, username),
      password: pin,
    });
    if (error) { setBusy(false); toast.error("Usuário ou PIN inválido."); return; }
    if (data.user && !(await validarAdega(data.user.id, adegaSelecionada.id))) {
      await supabase.auth.signOut();
      setBusy(false);
      toast.error("Esse usuário não pertence à adega selecionada.");
      return;
    }
    setBusy(false);
  };

  const submitSuper = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await signIn(superEmail, superPwd);
    if (r.error) { setBusy(false); toast.error(r.error); return; }
    const { data: { user: u } } = await supabase.auth.getUser();
    if (u) {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.id)
        .eq("role", "super_admin")
        .maybeSingle();
      if (!data) {
        await supabase.auth.signOut();
        setBusy(false);
        toast.error("Esse usuário não é Super Admin.");
        return;
      }
    }
    setBusy(false);
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary/30 via-background to-accent/10 relative overflow-hidden">
        <div className="flex items-center gap-3 text-foreground">
          <Wine className="w-8 h-8 text-accent" />
          <span className="text-xl font-semibold display">Adega PDV</span>
        </div>
        <div className="space-y-4 relative z-10">
          <h1 className="text-5xl display font-bold leading-tight">
            Gestão completa<br /><span className="text-accent">da sua adega.</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            PDV ágil, controle de estoque automático, relatórios em tempo real e financeiro integrado.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© Adega PDV — Sistema profissional para adegas</p>
      </div>

      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center gap-2 lg:hidden mb-4">
            <Wine className="w-6 h-6 text-accent" />
            <span className="text-lg font-semibold display">Adega PDV</span>
          </div>
          <div>
            <h2 className="text-3xl font-bold display">Bem-vindo</h2>
            <p className="text-muted-foreground mt-1">Acesse o sistema para começar.</p>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="adm" className="gap-1.5">
                <Shield className="w-4 h-4" /> ADM
              </TabsTrigger>
              <TabsTrigger value="func" className="gap-1.5">
                <User className="w-4 h-4" /> Funcionário
              </TabsTrigger>
              <TabsTrigger value="super" className="gap-1.5">
                <Crown className="w-4 h-4" /> Super
              </TabsTrigger>
            </TabsList>

            {(tab === "adm" || tab === "func") && (
              <div className="mt-6 space-y-2">
                <Label>Adega</Label>
                <Select value={adegaId} onValueChange={setAdegaId}>
                  <SelectTrigger><SelectValue placeholder="Selecione a adega" /></SelectTrigger>
                  <SelectContent>
                    {(adegas ?? []).map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <TabsContent value="adm" className="mt-4">
              <form onSubmit={submitAdm} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="voce@adega.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={busy}>
                  {busy ? "Aguarde…" : "Entrar como ADM"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Acessos ADM são criados pelo Super Admin.
                </p>
              </form>
            </TabsContent>

            <TabsContent value="func" className="mt-4">
              <form onSubmit={submitFunc} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Usuário</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                    required
                    placeholder="joao"
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pin">PIN (6 dígitos)</Label>
                  <Input
                    id="pin"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    autoComplete="current-password"
                    className="text-center text-2xl tracking-[0.5em] font-mono"
                  />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={busy}>
                  {busy ? "Aguarde…" : "Entrar como funcionário"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="super" className="mt-6">
              <form onSubmit={submitSuper} className="space-y-4">
                <div className="space-y-2">
                  <Label>Email Super Admin</Label>
                  <Input type="email" value={superEmail} onChange={(e) => setSuperEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input type="password" value={superPwd} onChange={(e) => setSuperPwd(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={busy} variant="default">
                  {busy ? "Aguarde…" : "Entrar como Super Admin"}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Acesso ao painel global de gerenciamento de adegas.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <Link to="/" className="block text-center text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </div>
      </div>
    </div>
  );
}
