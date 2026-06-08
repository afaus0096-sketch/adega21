import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Wine, Crown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { listAdegasPublic } from "@/lib/adegas.functions";

export const Route = createFileRoute("/login")({ component: LoginPage });

const FUNC_DOMAIN = "funcionarios.adega.local";

function LoginPage() {
  const { user, signIn, loading, role } = useAuth();
  const navigate = useNavigate();

  const listFn = useServerFn(listAdegasPublic);
  const { data: adegas = [] } = useQuery({
    queryKey: ["adegas-public"],
    queryFn: () => listFn() as Promise<Array<{ id: string; nome: string; slug: string }>>,
  });

  const [adegaSlug, setAdegaSlug] = useState<string>("");
  const [username, setUsername] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);

  const [superOpen, setSuperOpen] = useState(false);
  const [superEmail, setSuperEmail] = useState("");
  const [superPwd, setSuperPwd] = useState("");

  useEffect(() => {
    if (!loading && user) {
      navigate({ to: role === "super_admin" ? "/accounts" : "/dashboard", replace: true });
    }
  }, [user, loading, role, navigate]);

  useEffect(() => {
    if (!adegaSlug && adegas[0]) setAdegaSlug(adegas[0].slug);
  }, [adegas, adegaSlug]);

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
    else setSuperOpen(false);
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

      <div className="flex items-center justify-center p-6 lg:p-12 relative">
        {/* Botão lateral de Super Admin */}
        <button
          type="button"
          onClick={() => setSuperOpen(true)}
          className="absolute top-4 right-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-full px-3 py-1.5 bg-background/60 backdrop-blur"
        >
          <Crown className="w-3.5 h-3.5" /> Admin
        </button>

        <div className="w-full max-w-md space-y-6">
          <div className="flex items-center gap-2 lg:hidden mb-4">
            <Wine className="w-6 h-6 text-accent" />
            <span className="text-lg font-semibold display">Adega PDV</span>
          </div>
          <div>
            <h2 className="text-3xl font-bold display">Bem-vindo</h2>
            <p className="text-muted-foreground mt-1">Selecione sua adega e entre com seu usuário e PIN.</p>
          </div>

          <form onSubmit={submitFunc} className="space-y-4">
            <div className="space-y-2">
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
              {busy ? "Aguarde…" : "Entrar"}
            </Button>
          </form>

          <Link to="/" className="block text-center text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </div>

        <Dialog open={superOpen} onOpenChange={setSuperOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Crown className="w-5 h-5 text-accent" /> Acesso Super Admin</DialogTitle>
              <DialogDescription>Somente o Super Usuário entra por email e senha.</DialogDescription>
            </DialogHeader>
            <form onSubmit={submitSuper} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={superEmail} onChange={(e) => setSuperEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" value={superPwd} onChange={(e) => setSuperPwd(e.target.value)} required minLength={6} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? "Aguarde…" : "Entrar como Super"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
