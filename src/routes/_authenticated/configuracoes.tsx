import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Settings, ShieldAlert, KeyRound, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { hasBrokenPassword, setBrokenPassword } from "@/lib/caixa.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { role } = useAuth();
  if (role !== "admin") return <Navigate to="/dashboard" replace />;

  const hasFn = useServerFn(hasBrokenPassword);
  const setFn = useServerFn(setBrokenPassword);
  const { data, refetch } = useQuery({
    queryKey: ["broken-password-exists"],
    queryFn: () => hasFn() as Promise<{ exists: boolean }>,
  });

  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");

  const mut = useMutation({
    mutationFn: () => setFn({ data: { newPassword: pwd } }),
    onSuccess: () => {
      toast.success("Senha Broken Caixa salva.");
      setPwd(""); setConfirm("");
      refetch();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro"),
  });

  const podeSalvar =
    pwd.length >= 4 && pwd === confirm && !mut.isPending;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="display text-3xl font-bold flex items-center gap-2">
          <Settings className="w-7 h-7 text-accent" /> Configurações
        </h1>
        <p className="text-muted-foreground text-sm">
          Opções avançadas disponíveis apenas para o administrador.
        </p>
      </div>

      <Alert>
        <ShieldAlert className="w-4 h-4" />
        <AlertTitle>Senha Broken Caixa</AlertTitle>
        <AlertDescription>
          Senha de alto privilégio usada para forçar o fechamento de um caixa
          pendente do dia anterior e liberar a abertura do caixa de hoje.
          Mantenha-a em segurança e não compartilhe com funcionários comuns.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" /> Cadastrar / alterar senha
          </CardTitle>
          <CardDescription>
            {data?.exists ? (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="w-4 h-4" /> Senha já cadastrada — informe uma nova para substituir.
              </span>
            ) : "Nenhuma senha cadastrada ainda."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nova senha (mín. 4 caracteres)</Label>
            <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Confirmar nova senha</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {confirm && pwd !== confirm && (
              <p className="text-xs text-destructive">As senhas não conferem.</p>
            )}
          </div>
          <Button onClick={() => mut.mutate()} disabled={!podeSalvar}>
            {mut.isPending ? "Salvando…" : "Salvar senha Broken"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
