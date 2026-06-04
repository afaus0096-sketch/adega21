import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wine, Shield, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

const FUNC_DOMAIN = "funcionarios.adega.local";

function LoginPage() {
  const { user, signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("adm");

  // ADM
  const [admMode, setAdmMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");

  // Funcionário
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");

  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  const submitAdm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = admMode === "login"
      ? await signIn(email, password)
      : await signUp(email, password, nome);
    setBusy(false);
    if (r.error) toast.error(r.error);
    else if (admMode === "signup") toast.success("Conta criada! Verifique seu email.");
  };

  const submitFunc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[a-z0-9_.-]+$/.test(username)) {
      toast.error("Usuário inválido."); return;
    }
    if (!/^\d{6}$/.test(pin)) {
      toast.error("PIN deve ter 6 dígitos."); return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: `${username}@${FUNC_DOMAIN}`,
      password: pin,
    });
    setBusy(false);
    if (error) toast.error("Usuário ou PIN inválido.");
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
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="adm" className="gap-2">
                <Shield className="w-4 h-4" /> Master ADM
              </TabsTrigger>
              <TabsTrigger value="func" className="gap-2">
                <User className="w-4 h-4" /> Funcionário
              </TabsTrigger>
            </TabsList>

            <TabsContent value="adm" className="mt-6">
              <form onSubmit={submitAdm} className="space-y-4">
                {admMode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="nome">Nome</Label>
                    <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required placeholder="Seu nome" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="voce@adega.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
                </div>
                <Button type="submit" className="w-full" size="lg" disabled={busy}>
                  {busy ? "Aguarde…" : admMode === "login" ? "Entrar como ADM" : "Criar conta ADM"}
                </Button>
                <button
                  type="button"
                  onClick={() => setAdmMode(admMode === "login" ? "signup" : "login")}
                  className="text-sm text-muted-foreground hover:text-foreground block mx-auto"
                >
                  {admMode === "login" ? "Criar conta de administrador" : "Já tenho conta — entrar"}
                </button>
              </form>
            </TabsContent>

            <TabsContent value="func" className="mt-6">
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
                <p className="text-xs text-muted-foreground text-center">
                  Acessos criados pelo administrador. Esqueceu o PIN? Solicite reset ao ADM.
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
