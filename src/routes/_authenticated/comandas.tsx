import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { brl, dtBR } from "@/lib/format";
import {
  Plus, Trash2, Search, ReceiptText, CheckCircle2, X, Printer,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/comandas")({
  component: ComandasPage,
});

type Produto = {
  id: string; nome: string; preco_venda: number; estoque: number;
  codigo_interno: string;
};
type Comanda = {
  id: string; cliente_nome: string; cliente_telefone: string | null;
  observacao: string | null; status: "aberta" | "fechada" | "cancelada";
  total: number; forma_pagamento: string | null;
  created_at: string; closed_at: string | null;
};
type ItemComanda = {
  id: string; produto_id: string; produto_nome: string;
  quantidade: number; preco_unitario: number; subtotal: number;
};
type ItemNovo = { produto: Produto; qtd: number };

function ComandasPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filtroStatus, setFiltroStatus] = useState<"todas" | "aberta" | "fechada">("aberta");
  const [busca, setBusca] = useState("");
  const [novaOpen, setNovaOpen] = useState(false);
  const [detalheId, setDetalheId] = useState<string | null>(null);

  const { data: comandas, isLoading } = useQuery({
    queryKey: ["comandas", filtroStatus],
    queryFn: async () => {
      let q = supabase.from("comandas").select("*").order("created_at", { ascending: false });
      if (filtroStatus !== "todas") q = q.eq("status", filtroStatus);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Comanda[];
    },
  });

  const filtered = useMemo(() => {
    const s = busca.trim().toLowerCase();
    if (!s) return comandas ?? [];
    return (comandas ?? []).filter(
      (c) => c.cliente_nome.toLowerCase().includes(s) ||
        (c.cliente_telefone ?? "").includes(s),
    );
  }, [comandas, busca]);

  const abertas = (comandas ?? []).filter((c) => c.status === "aberta").length;
  const totalAberto = (comandas ?? [])
    .filter((c) => c.status === "aberta")
    .reduce((a, c) => a + Number(c.total), 0);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold display flex items-center gap-2">
            <ReceiptText className="w-7 h-7 text-accent" /> Contas Abertas
          </h1>
          <p className="text-muted-foreground mt-1">
            Controle de comandas — abra, adicione itens e feche pagamentos.
          </p>
        </div>
        <Button size="lg" onClick={() => setNovaOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Nova Comanda
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Contas abertas</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold display">{abertas}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total em aberto</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold display text-destructive">{brl(totalAberto)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total no filtro</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold display">{(comandas ?? []).length}</div></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filtroStatus} onValueChange={(v) => setFiltroStatus(v as any)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberta">Apenas abertas</SelectItem>
                  <SelectItem value="fechada">Apenas fechadas</SelectItem>
                  <SelectItem value="todas">Todas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[200px] space-y-1">
              <Label className="text-xs">Buscar cliente</Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Nome ou telefone…" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-10 text-center text-muted-foreground">Carregando…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">Nenhuma comanda encontrada.</div>
          ) : (
            <ul className="divide-y divide-border">
              {filtered.map((c) => {
                const aberta = c.status === "aberta";
                return (
                  <li
                    key={c.id}
                    className="p-4 flex items-center gap-4 hover:bg-accent/5 cursor-pointer"
                    onClick={() => setDetalheId(c.id)}
                  >
                    <StatusDot status={c.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold truncate">{c.cliente_nome}</span>
                        {c.cliente_telefone && (
                          <span className="text-xs text-muted-foreground">· {c.cliente_telefone}</span>
                        )}
                        <Badge variant={aberta ? "destructive" : "secondary"} className="text-[10px]">
                          {c.status.toUpperCase()}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Aberta em {dtBR(c.created_at)}
                        {c.closed_at && ` · Fechada em ${dtBR(c.closed_at)}`}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold display">{brl(Number(c.total))}</div>
                      {c.forma_pagamento && (
                        <div className="text-[10px] text-muted-foreground uppercase">{c.forma_pagamento}</div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {novaOpen && (
        <NovaComandaDialog
          open={novaOpen}
          onClose={() => setNovaOpen(false)}
          userId={user!.id}
          onCreated={() => { qc.invalidateQueries({ queryKey: ["comandas"] }); }}
        />
      )}

      {detalheId && (
        <DetalheComandaDialog
          id={detalheId}
          onClose={() => setDetalheId(null)}
          onChanged={() => qc.invalidateQueries({ queryKey: ["comandas"] })}
        />
      )}
    </div>
  );
}

function StatusDot({ status }: { status: Comanda["status"] }) {
  const aberta = status === "aberta";
  return (
    <span className="relative inline-flex h-3 w-3 shrink-0">
      {aberta && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
      )}
      <span
        className={cn(
          "relative inline-flex h-3 w-3 rounded-full",
          aberta ? "bg-destructive" : status === "fechada" ? "bg-success" : "bg-muted-foreground"
        )}
      />
    </span>
  );
}

/* ---------- Nova comanda ---------- */

function NovaComandaDialog({
  open, onClose, userId, onCreated,
}: { open: boolean; onClose: () => void; userId: string; onCreated: () => void }) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [obs, setObs] = useState("");
  const [itens, setItens] = useState<ItemNovo[]>([]);
  const [buscaProd, setBuscaProd] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: produtos } = useQuery({
    queryKey: ["produtos-comanda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos")
        .select("id, nome, preco_venda, estoque, codigo_interno")
        .eq("ativo", true).order("nome");
      if (error) throw error;
      return (data ?? []) as Produto[];
    },
  });

  const sugestoes = useMemo(() => {
    const s = buscaProd.trim().toLowerCase();
    if (!s) return [];
    return (produtos ?? [])
      .filter((p) => p.nome.toLowerCase().includes(s) || p.codigo_interno.toLowerCase() === s)
      .slice(0, 8);
  }, [produtos, buscaProd]);

  const total = itens.reduce((a, i) => a + i.qtd * Number(i.produto.preco_venda), 0);

  const addProduto = (p: Produto) => {
    setItens((prev) => {
      const i = prev.findIndex((x) => x.produto.id === p.id);
      if (i >= 0) { const c = [...prev]; c[i] = { ...c[i], qtd: c[i].qtd + 1 }; return c; }
      return [...prev, { produto: p, qtd: 1 }];
    });
    setBuscaProd("");
  };

  const salvar = async () => {
    if (!nome.trim()) { toast.error("Informe o nome do cliente"); return; }
    setSaving(true);
    try {
      const { data: comanda, error: e1 } = await supabase
        .from("comandas")
        .insert({
          cliente_nome: nome.trim(),
          cliente_telefone: telefone.trim() || null,
          observacao: obs.trim() || null,
          status: "aberta",
          total,
          user_id: userId,
        }).select().single();
      if (e1) throw e1;

      if (itens.length > 0) {
        const payload = itens.map((i) => ({
          comanda_id: comanda.id,
          produto_id: i.produto.id,
          produto_nome: i.produto.nome,
          quantidade: i.qtd,
          preco_unitario: Number(i.produto.preco_venda),
          subtotal: i.qtd * Number(i.produto.preco_venda),
        }));
        const { error: e2 } = await supabase.from("itens_comanda").insert(payload);
        if (e2) throw e2;
      }
      toast.success("Comanda aberta!");
      onCreated(); onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar");
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="display text-2xl">Nova Comanda</DialogTitle>
          <DialogDescription>Abra uma conta para o cliente. Itens podem ser adicionados aqui ou depois.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Cliente *</Label>
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do cliente" autoFocus />
            </div>
            <div className="space-y-1">
              <Label>Telefone</Label>
              <Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(opcional)" />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Observação</Label>
            <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Mesa, anotações, etc." rows={2} />
          </div>

          <div className="space-y-2 pt-2 border-t border-border">
            <Label>Adicionar itens</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                value={buscaProd}
                onChange={(e) => setBuscaProd(e.target.value)}
                placeholder="Buscar produto pelo nome ou código…"
              />
              {sugestoes.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {sugestoes.map((p) => (
                    <button
                      key={p.id} type="button"
                      onClick={() => addProduto(p)}
                      className="w-full text-left p-2 hover:bg-accent/10 flex justify-between items-center"
                    >
                      <span className="truncate">{p.nome}</span>
                      <span className="text-sm font-semibold text-accent ml-2">{brl(Number(p.preco_venda))}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {itens.length > 0 && (
              <ul className="border border-border rounded-md divide-y divide-border max-h-56 overflow-y-auto">
                {itens.map((i) => (
                  <li key={i.produto.id} className="p-2 flex items-center gap-2 text-sm">
                    <span className="flex-1 truncate">{i.produto.nome}</span>
                    <Input
                      type="number" min={1} value={i.qtd}
                      onChange={(e) => {
                        const q = Math.max(1, Number(e.target.value) || 1);
                        setItens((prev) => prev.map((x) => x.produto.id === i.produto.id ? { ...x, qtd: q } : x));
                      }}
                      className="w-16 h-8"
                    />
                    <span className="w-24 text-right font-semibold">{brl(i.qtd * Number(i.produto.preco_venda))}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => setItens((prev) => prev.filter((x) => x.produto.id !== i.produto.id))}>
                      <X className="w-3 h-3" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex justify-between items-baseline pt-2">
              <span className="text-muted-foreground text-sm">Total inicial</span>
              <span className="text-2xl font-bold display text-accent">{brl(total)}</span>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando…" : "Abrir conta"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Detalhe / fechamento ---------- */

function DetalheComandaDialog({
  id, onClose, onChanged,
}: { id: string; onClose: () => void; onChanged: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [forma, setForma] = useState<"dinheiro" | "pix" | "debito" | "credito">("dinheiro");
  const [fechando, setFechando] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["comanda", id],
    queryFn: async () => {
      const [{ data: c, error: e1 }, { data: items, error: e2 }] = await Promise.all([
        supabase.from("comandas").select("*").eq("id", id).single(),
        supabase.from("itens_comanda").select("*").eq("comanda_id", id).order("created_at"),
      ]);
      if (e1) throw e1; if (e2) throw e2;
      return { comanda: c as Comanda, itens: (items ?? []) as ItemComanda[] };
    },
  });

  const { data: produtos } = useQuery({
    queryKey: ["produtos-comanda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("produtos").select("id, nome, preco_venda, estoque, codigo_interno")
        .eq("ativo", true).order("nome");
      if (error) throw error;
      return (data ?? []) as Produto[];
    },
  });

  const [buscaProd, setBuscaProd] = useState("");
  const sugestoes = useMemo(() => {
    const s = buscaProd.trim().toLowerCase();
    if (!s) return [];
    return (produtos ?? [])
      .filter((p) => p.nome.toLowerCase().includes(s) || p.codigo_interno.toLowerCase() === s)
      .slice(0, 8);
  }, [produtos, buscaProd]);

  const aberta = data?.comanda.status === "aberta";

  const recalcTotal = async (comandaId: string) => {
    const { data: items } = await supabase.from("itens_comanda").select("subtotal").eq("comanda_id", comandaId);
    const total = (items ?? []).reduce((a, i) => a + Number(i.subtotal), 0);
    await supabase.from("comandas").update({ total }).eq("id", comandaId);
  };

  const addItem = async (p: Produto) => {
    if (!data) return;
    const existing = data.itens.find((i) => i.produto_id === p.id);
    if (existing) {
      const novaQtd = Number(existing.quantidade) + 1;
      const sub = novaQtd * Number(existing.preco_unitario);
      await supabase.from("itens_comanda").update({ quantidade: novaQtd, subtotal: sub }).eq("id", existing.id);
    } else {
      await supabase.from("itens_comanda").insert({
        comanda_id: data.comanda.id,
        produto_id: p.id,
        produto_nome: p.nome,
        quantidade: 1,
        preco_unitario: Number(p.preco_venda),
        subtotal: Number(p.preco_venda),
      });
    }
    await recalcTotal(data.comanda.id);
    setBuscaProd("");
    refetch(); onChanged();
  };

  const removeItem = async (itemId: string) => {
    if (!data) return;
    await supabase.from("itens_comanda").delete().eq("id", itemId);
    await recalcTotal(data.comanda.id);
    refetch(); onChanged();
  };

  const fecharComanda = async () => {
    if (!data || !user) return;
    if (data.itens.length === 0) { toast.error("Adicione ao menos um item antes de fechar."); return; }
    setFechando(true);
    try {
      // 1. cria venda — triggers cuidam de estoque + fluxo de caixa
      const { data: venda, error: ev } = await supabase.from("vendas").insert({
        user_id: user.id,
        total: Number(data.comanda.total),
        forma_pagamento: forma,
        valor_recebido: null,
        troco: 0,
      }).select().single();
      if (ev) throw ev;

      const payload = data.itens.map((i) => ({
        venda_id: venda.id,
        produto_id: i.produto_id,
        produto_nome: i.produto_nome,
        quantidade: Number(i.quantidade),
        preco_unitario: Number(i.preco_unitario),
        subtotal: Number(i.subtotal),
      }));
      const { error: ei } = await supabase.from("itens_venda").insert(payload);
      if (ei) throw ei;

      // 2. marca comanda como fechada
      const { error: ec } = await supabase.from("comandas").update({
        status: "fechada",
        forma_pagamento: forma,
        closed_at: new Date().toISOString(),
        venda_id: venda.id,
      }).eq("id", data.comanda.id);
      if (ec) throw ec;

      toast.success(`Comanda fechada — venda #${venda.numero}`);
      qc.invalidateQueries({ queryKey: ["produtos-comanda"] });
      qc.invalidateQueries({ queryKey: ["produtos-pdv"] });
      onChanged(); onClose();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao fechar comanda");
    } finally { setFechando(false); }
  };

  const imprimir = () => {
    if (!data) return;
    const html = `
      <html><head><title>Comanda — ${data.comanda.cliente_nome}</title>
      <style>body{font-family:monospace;padding:12px;max-width:300px}h2{margin:0}hr{border:0;border-top:1px dashed #999}table{width:100%;font-size:12px}td{padding:2px 0}.r{text-align:right}</style>
      </head><body>
      <h2>COMANDA</h2>
      <div>Cliente: ${data.comanda.cliente_nome}</div>
      ${data.comanda.cliente_telefone ? `<div>Tel: ${data.comanda.cliente_telefone}</div>` : ""}
      <div>Aberta: ${dtBR(data.comanda.created_at)}</div>
      <hr/>
      <table>
        ${data.itens.map((i) => `<tr><td>${i.quantidade}x ${i.produto_nome}</td><td class="r">${brl(Number(i.subtotal))}</td></tr>`).join("")}
      </table>
      <hr/>
      <table><tr><td><b>TOTAL</b></td><td class="r"><b>${brl(Number(data.comanda.total))}</b></td></tr></table>
      ${data.comanda.observacao ? `<hr/><div>${data.comanda.observacao}</div>` : ""}
      </body></html>`;
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) { toast.error("Bloqueador de pop-ups ativo"); return; }
    w.document.write(html); w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 250);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="display text-2xl flex items-center gap-2">
            <StatusDot status={data?.comanda.status ?? "aberta"} />
            {data?.comanda.cliente_nome ?? "…"}
          </DialogTitle>
          <DialogDescription>
            {data?.comanda.cliente_telefone && <>📞 {data.comanda.cliente_telefone} · </>}
            Aberta em {data && dtBR(data.comanda.created_at)}
            {data?.comanda.closed_at && <> · Fechada {dtBR(data.comanda.closed_at)}</>}
          </DialogDescription>
        </DialogHeader>

        {!data ? <div className="text-center py-8 text-muted-foreground">Carregando…</div> : (
          <div className="space-y-4">
            {aberta && (
              <div className="space-y-2 border-b border-border pb-3">
                <Label>Adicionar item</Label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input className="pl-9" value={buscaProd}
                    onChange={(e) => setBuscaProd(e.target.value)}
                    placeholder="Nome ou código do produto…" />
                  {sugestoes.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {sugestoes.map((p) => (
                        <button key={p.id} type="button" onClick={() => addItem(p)}
                          className="w-full text-left p-2 hover:bg-accent/10 flex justify-between items-center">
                          <span className="truncate">{p.nome}</span>
                          <span className="text-sm font-semibold text-accent ml-2">{brl(Number(p.preco_venda))}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <ul className="divide-y divide-border border border-border rounded-md">
              {data.itens.length === 0 ? (
                <li className="p-4 text-center text-sm text-muted-foreground">Sem itens</li>
              ) : data.itens.map((i) => (
                <li key={i.id} className="p-2 flex items-center gap-2 text-sm">
                  <span className="w-8 text-center font-mono">{Number(i.quantidade)}x</span>
                  <span className="flex-1 truncate">{i.produto_nome}</span>
                  <span className="text-muted-foreground text-xs">{brl(Number(i.preco_unitario))}</span>
                  <span className="w-24 text-right font-semibold">{brl(Number(i.subtotal))}</span>
                  {aberta && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"
                      onClick={() => removeItem(i.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>

            <div className="flex justify-between items-baseline pt-2 border-t border-border">
              <span className="text-muted-foreground">Total</span>
              <span className="text-3xl font-bold display text-accent">{brl(Number(data.comanda.total))}</span>
            </div>

            {data.comanda.observacao && (
              <div className="text-sm text-muted-foreground italic">
                "{data.comanda.observacao}"
              </div>
            )}

            {aberta && (
              <div className="space-y-2 pt-2 border-t border-border">
                <Label>Forma de pagamento</Label>
                <Select value={forma} onValueChange={(v) => setForma(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="debito">Cartão Débito</SelectItem>
                    <SelectItem value="credito">Cartão Crédito</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 flex-wrap">
          <Button variant="outline" onClick={imprimir} disabled={!data}>
            <Printer className="w-4 h-4 mr-1" /> Imprimir
          </Button>
          {aberta ? (
            <Button onClick={fecharComanda} disabled={fechando}>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              {fechando ? "Fechando…" : "Fechar conta (pagar)"}
            </Button>
          ) : (
            <Button onClick={onClose}>Fechar</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
