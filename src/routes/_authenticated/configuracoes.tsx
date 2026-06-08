import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Settings, ShieldAlert, KeyRound, CheckCircle2, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { hasBrokenPassword, setBrokenPassword } from "@/lib/caixa.functions";
import { resetarDados } from "@/lib/reset.functions";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  component: ConfiguracoesPage,
});

function ConfiguracoesPage() {
  const { role } = useAuth();
  if (role !== "admin") return <Navigate to="/dashboard" replace />;

  const qc = useQueryClient();
  const hasFn = useServerFn(hasBrokenPassword);
  const setFn = useServerFn(setBrokenPassword);
  const resetFn = useServerFn(resetarDados);

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

  const podeSalvar = pwd.length >= 4 && pwd === confirm && !mut.isPending;

  // ===== Zerar dados =====
  const [openReset, setOpenReset] = useState(false);
  const [opts, setOpts] = useState({ vendas: false, produtos: false, estoque: false, funcionarios: false });
  const [confirmTxt, setConfirmTxt] = useState("");

  const resetMut = useMutation({
    mutationFn: () => resetFn({ data: { ...opts, confirmacao: "ZERAR" as const } }),
    onSuccess: () => {
      toast.success("Dados zerados com sucesso.");
      setOpenReset(false);
      setOpts({ vendas: false, produtos: false, estoque: false, funcionarios: false });
      setConfirmTxt("");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao zerar"),
  });

  const algoSelecionado = opts.vendas || opts.produtos || opts.estoque || opts.funcionarios;
  const podeZerar = algoSelecionado && confirmTxt === "ZERAR" && !resetMut.isPending;

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

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="w-5 h-5" /> Zona de perigo — Zerar dados
          </CardTitle>
          <CardDescription>
            Apaga permanentemente os dados selecionados. Esta ação é irreversível.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setOpenReset(true)}>
            <Trash2 className="w-4 h-4 mr-2" /> Zerar dados…
          </Button>
        </CardContent>
      </Card>

      <Dialog open={openReset} onOpenChange={(o) => { setOpenReset(o); if (!o) { setConfirmTxt(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Zerar dados
            </DialogTitle>
            <DialogDescription>
              Selecione o que deseja apagar. Esta operação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="flex items-start gap-3 p-2 rounded hover:bg-muted/40">
              <Checkbox checked={opts.vendas} onCheckedChange={(v) => setOpts({ ...opts, vendas: !!v })} />
              <div>
                <div className="font-medium text-sm">Vendas</div>
                <div className="text-xs text-muted-foreground">Vendas, comandas, caixas e fluxo financeiro.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-2 rounded hover:bg-muted/40">
              <Checkbox checked={opts.estoque} onCheckedChange={(v) => setOpts({ ...opts, estoque: !!v })} />
              <div>
                <div className="font-medium text-sm">Estoque</div>
                <div className="text-xs text-muted-foreground">Movimentações e zera o estoque dos produtos.</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-2 rounded hover:bg-muted/40">
              <Checkbox checked={opts.produtos} onCheckedChange={(v) => setOpts({ ...opts, produtos: !!v })} />
              <div>
                <div className="font-medium text-sm">Produtos</div>
                <div className="text-xs text-muted-foreground">Remove todos os produtos cadastrados (também limpa vendas e movimentações vinculadas).</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-2 rounded hover:bg-muted/40">
              <Checkbox checked={opts.funcionarios} onCheckedChange={(v) => setOpts({ ...opts, funcionarios: !!v })} />
              <div>
                <div className="font-medium text-sm">Funcionários</div>
                <div className="text-xs text-muted-foreground">Remove todos os funcionários (seu acesso ADM é mantido).</div>
              </div>
            </label>

            <div className="border-t pt-3 space-y-2">
              <Label>Digite <strong className="text-destructive">ZERAR</strong> para confirmar</Label>
              <Input value={confirmTxt} onChange={(e) => setConfirmTxt(e.target.value.toUpperCase())} placeholder="ZERAR" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenReset(false)}>Cancelar</Button>
            <Button variant="destructive" disabled={!podeZerar} onClick={() => resetMut.mutate()}>
              {resetMut.isPending ? "Apagando…" : "Apagar selecionados"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
