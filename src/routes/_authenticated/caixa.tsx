import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Lock, Unlock, AlertTriangle, ShieldAlert, CalendarClock, History,
} from "lucide-react";
import { toast } from "sonner";
import { brl } from "@/lib/format";
import { canAccess } from "@/lib/permissions";
import {
  abrirCaixa, fecharCaixa, getCaixaStatus, listCaixas,
} from "@/lib/caixa.functions";

export const Route = createFileRoute("/_authenticated/caixa")({ component: CaixaPage });

function CaixaPage() {
  const { role, permissoes } = useAuth();
  if (!canAccess(role, permissoes, "/caixa"))
    return <Navigate to="/dashboard" replace />;

  const qc = useQueryClient();
  const statusFn = useServerFn(getCaixaStatus);
  const listFn = useServerFn(listCaixas);
  const abrirFn = useServerFn(abrirCaixa);
  const fecharFn = useServerFn(fecharCaixa);

  const { data: status, isLoading } = useQuery({
    queryKey: ["caixa-status"],
    queryFn: () => statusFn(),
  });
  const { data: historico = [] } = useQuery({
    queryKey: ["caixa-historico"],
    queryFn: () => listFn() as Promise<any[]>,
  });

  const [openAbrir, setOpenAbrir] = useState(false);
  const [openFechar, setOpenFechar] = useState(false);
  const [pin, setPin] = useState("");
  const [brokenPwd, setBrokenPwd] = useState("");
  const [obs, setObs] = useState("");
  const [needBroken, setNeedBroken] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["caixa-status"] });
    qc.invalidateQueries({ queryKey: ["caixa-historico"] });
  };

  const abrirMut = useMutation({
    mutationFn: () =>
      abrirFn({
        data: { pin, brokenPassword: brokenPwd || undefined },
      }),
    onSuccess: (r: any) => {
      toast.success(
        r?.brokenUsado ? "Caixa pendente fechado e novo aberto." : "Caixa aberto!",
      );
      setOpenAbrir(false);
      setPin(""); setBrokenPwd(""); setNeedBroken(false);
      refresh();
    },
    onError: (e: any) => {
      const msg: string = e?.message ?? "Erro ao abrir caixa";
      if (msg.startsWith("PENDENTE:")) {
        setNeedBroken(true);
        toast.warning(msg.replace("PENDENTE:", ""));
      } else {
        toast.error(msg);
      }
    },
  });

  const fecharMut = useMutation({
    mutationFn: () =>
      fecharFn({ data: { id: status!.caixaDeHoje!.id, observacao: obs || undefined } }),
    onSuccess: (r: any) => {
      toast.success(
        `Caixa fechado. ${r.qtd} venda(s), total ${brl(Number(r.total))}.`,
      );
      setOpenFechar(false); setObs("");
      refresh();
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao fechar"),
  });

  const aberto = status?.aberto;
  const pendente = status?.pendente;
  const caixaHoje = status?.caixaDeHoje;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="display text-3xl font-bold flex items-center gap-2">
          <CalendarClock className="w-7 h-7 text-accent" /> Caixa
        </h1>
        <p className="text-muted-foreground text-sm">
          Controle de abertura e fechamento diário.
        </p>
      </div>

      {pendente && (
        <Alert variant="destructive">
          <ShieldAlert className="w-4 h-4" />
          <AlertTitle>Caixa pendente do dia anterior</AlertTitle>
          <AlertDescription>
            O caixa do dia <strong>{pendente.data_dia}</strong> aberto por{" "}
            <strong>{pendente.opened_by_nome}</strong> ainda não foi finalizado.
            Para abrir um novo caixa hoje, será necessária a senha{" "}
            <strong>Broken Caixa</strong>.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Status atual</CardTitle>
          <CardDescription>
            {isLoading ? "Carregando…" :
              caixaHoje ? "Caixa de hoje está ABERTO" :
              pendente ? "Caixa pendente — finalize antes de abrir hoje" :
              "Nenhum caixa aberto hoje"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {caixaHoje ? (
            <div className="grid sm:grid-cols-3 gap-3">
              <Info label="Aberto por" value={caixaHoje.opened_by_nome} />
              <Info label="Aberto às"
                value={new Date(caixaHoje.opened_at).toLocaleString("pt-BR")} />
              <Info label="Status" value={<Badge>Aberto</Badge>} />
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Clique em <strong>Abrir caixa</strong> para começar o expediente.
            </p>
          )}

          <div className="flex gap-2 pt-2">
            {!caixaHoje && (
              <Button onClick={() => setOpenAbrir(true)}>
                <Unlock className="w-4 h-4 mr-2" /> Abrir caixa
              </Button>
            )}
            {caixaHoje && (
              <Button variant="destructive" onClick={() => setOpenFechar(true)}>
                <Lock className="w-4 h-4 mr-2" /> Finalizar caixa
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" /> Histórico recente
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dia</TableHead>
                <TableHead>Abertura</TableHead>
                <TableHead>Fechamento</TableHead>
                <TableHead>Vendas</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historico.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem registros.</TableCell></TableRow>
              ) : historico.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-mono text-xs">{c.data_dia}</TableCell>
                  <TableCell>{c.opened_by_nome} <span className="text-muted-foreground text-xs block">{new Date(c.opened_at).toLocaleString("pt-BR")}</span></TableCell>
                  <TableCell>{c.closed_at ? <>{c.closed_by_nome}<span className="text-muted-foreground text-xs block">{new Date(c.closed_at).toLocaleString("pt-BR")}</span></> : "—"}</TableCell>
                  <TableCell>{c.qtd_vendas}</TableCell>
                  <TableCell className="text-right font-semibold">{brl(Number(c.total_vendas))}</TableCell>
                  <TableCell>
                    {c.status === "aberto"
                      ? <Badge>Aberto</Badge>
                      : <Badge variant="secondary">Fechado</Badge>}
                    {c.broken_used && <Badge variant="destructive" className="ml-1">Broken</Badge>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Abrir */}
      <Dialog open={openAbrir} onOpenChange={(o) => { setOpenAbrir(o); if (!o) { setPin(""); setBrokenPwd(""); setNeedBroken(false); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Abrir caixa</DialogTitle>
            <DialogDescription>
              Confirme com sua senha/PIN para abrir o caixa de hoje.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Sua senha/PIN</Label>
              <Input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="••••••"
                autoFocus
              />
            </div>
            {(pendente || needBroken) && (
              <div className="space-y-2 border-t pt-3">
                <Label className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="w-4 h-4" /> Senha Broken Caixa
                </Label>
                <Input
                  type="password"
                  value={brokenPwd}
                  onChange={(e) => setBrokenPwd(e.target.value)}
                  placeholder="Senha de quebra"
                />
                <p className="text-xs text-muted-foreground">
                  Obrigatória para finalizar o caixa pendente e abrir o de hoje.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenAbrir(false)}>Cancelar</Button>
            <Button onClick={() => abrirMut.mutate()} disabled={abrirMut.isPending || !pin}>
              {abrirMut.isPending ? "Abrindo…" : "Confirmar abertura"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fechar */}
      <Dialog open={openFechar} onOpenChange={setOpenFechar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar caixa</DialogTitle>
            <DialogDescription>
              O sistema vai somar todas as vendas desde a abertura.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Observação (opcional)</Label>
            <Input value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: sangria de R$ 200" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenFechar(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => fecharMut.mutate()} disabled={fecharMut.isPending}>
              {fecharMut.isPending ? "Fechando…" : "Finalizar caixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-medium mt-1">{value}</div>
    </div>
  );
}
