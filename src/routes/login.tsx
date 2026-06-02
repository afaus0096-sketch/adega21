import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Wine } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const { user, signIn, signUp, loading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const r = tab === "login"
      ? await signIn(email, password)
      : await signUp(email, password, nome);
    setBusy(false);
    if (r.error) toast.error(r.error);
    else if (tab === "signup") toast.success("Conta criada! Verifique seu email para confirmar.");
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
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>

            <form onSubmit={submit} className="space-y-4 mt-6">
              <TabsContent value="signup" className="space-y-4 mt-0">
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required={tab === "signup"} placeholder="Seu nome" />
                </div>
              </TabsContent>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="voce@adega.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder="••••••••" />
              </div>
              <Button type="submit" className="w-full" size="lg" disabled={busy}>
                {busy ? "Aguarde…" : tab === "login" ? "Entrar" : "Criar conta"}
              </Button>
              {tab === "signup" && (
                <p className="text-xs text-muted-foreground text-center">
                  O primeiro usuário cadastrado vira <b>administrador</b>. Os demais ficam como <b>operador de caixa</b>.
                </p>
              )}
            </form>
          </Tabs>

          <Link to="/" className="block text-center text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </div>
      </div>
    </div>
  );
}
