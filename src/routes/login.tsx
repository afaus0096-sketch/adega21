import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
// after-login redirect handled below based on role
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Wine, Shield, User, Crown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { listAdegasPublic } from "@/lib/adegas.functions";

export const Route = createFileRoute("/login")({ component: LoginPage });

const FUNC_DOMAIN = "funcionarios.adega.local";

function LoginPage() {
  const { user, signIn, loading, role } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("adm");

  const listFn = useServerFn(listAdegasPublic);
  const { data: adegas = [] } = useQuery({
    queryKey: ["adegas-public"],
    queryFn: () => listFn() as Promise<Array<{ id: string; nome: string; slug: string }>>,
  });

  const [adegaSlug, setAdegaSlug] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [superEmail, setSuperEmail] = useState("");
  const [superPwd, setSuperPwd] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: role === "super_admin" ? "/accounts" : "/dashboard", replace: true });
    }
  }, [user, loading, role, navigate]);

  useEffect(() => {
    if (!adegaSlug && adegas[0]) setAdegaSlug(adegas[0].slug);
  }, [adegas, adegaSlug]);

  const submitAdm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await signIn(email, password);
    setBusy(false);
    if (r.error) toast.error(r.error);
  };

  const submitFunc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adegaSlug) { toast.error("Selecione uma adega."); return; }
    if (!/^[a-z0-9_.-]+$/.test(username)) { toast.error("Usuário inválido."); return; }
    if (!/^\d{6}$/.test(pin)) { toast.error("PIN deve ter 6 dígitos."); return; }
    setBusy(true);
    const built = adegaSlug === "principal"
      ? `${username}@${FUNC_DOMAIN}`
      : `${adegaSlug}.${username}@${FUNC_DOMAIN}`;
    let { error } = await supabase.auth.signInWithPassword({ email: built, password: pin });
    if (error) {
      // fallback legado
      const retry = await supabase.auth.signInWithPassword({
        email: `${username}@${FUNC_DOMAIN}`,
        password: pin,
      });
      error = retry.error;
    }
    setBusy(false);
    if (error) toast.error("Usuário ou PIN inválido para essa adega.");
  };

  const submitSuper = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = await signIn(superEmail, superPwd);
    setBusy(false);
    if (r.error) toast.error(r.error);
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
              <TabsTrigger value="adm" className="gap-1.5"><Shield className="w-4 h-4" /> ADM</TabsTrigger>
              <TabsTrigger value="func" className="gap-1.5"><User className="w-4 h-4" /> Funcionário</TabsTrigger>
              <TabsTrigger value="super" className="gap-1.5"><Crown className="w-4 h-4" /> Super</TabsTrigger>
            </TabsList>

            {tab !== "super" && (
              <div className="mt-6 space-y-2">
                <Label>Adega</Label>
                <Select value={adegaSlug} onValueChange={setAdegaSlug}>
                  <SelectTrigger><SelectValue placeholder="Selecione a adega…" /></SelectTrigger>
                  <SelectContent>
                    {adegas.map((a) => (
                      <SelectItem key={a.id} value={a.slug}>{a.nome}</SelectItem>
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
                  <Label>Email Super</Label>
                  <Input type="email" value={superEmail} onChange={(e) => setSuperEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input type="password" value={superPwd} onChange={(e) => setSuperPwd(e.target.value)} required minLength={6} />
                </div>
                <Button type="submit" className="w-full" size="lg" variant="default" disabled={busy}>
                  {busy ? "Aguarde…" : "Entrar como Super"}
                </Button>
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
