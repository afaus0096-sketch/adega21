import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { brl } from "@/lib/format";
import { ShoppingCart, Trash2, Plus, Minus, ScanLine, Search } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pdv")({ component: PDV });

type Produto = { id: string; codigo_interno: string; codigo_barras: string | null; nome: string; preco_venda: number; estoque: number };
type Item = { produto: Produto; qtd: number };

function PDV() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState<Item[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [forma, setForma] = useState<"dinheiro"|"pix"|"debito"|"credito">("dinheiro");
  const [recebido, setRecebido] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => { codeRef.current?.focus(); }, []);

  const { data: produtos } = useQuery({
    queryKey: ["produtos-pdv"],
    queryFn: async () => {
      const { data, error } = await supabase.from("produtos").select("id, codigo_interno, codigo_barras, nome, preco_venda, estoque").eq("ativo", true).order("nome");
      if (error) throw error;
      return data as Produto[];
    },
  });

  const total = useMemo(() => itens.reduce((a, i) => a + i.qtd * Number(i.produto.preco_venda), 0), [itens]);
  const troco = Math.max(0, (Number(recebido) || 0) - total);

  const addProduto = (p: Produto) => {
    setItens((prev) => {
      const i = prev.findIndex((x) => x.produto.id === p.id);
      if (i >= 0) { const c = [...prev]; c[i] = { ...c[i], qtd: c[i].qtd + 1 }; return c; }
      return [...prev, { produto: p, qtd: 1 }];
    });
  };

  const onScan = (e: React.FormEvent) => {
    e.preventDefault();
    const q = busca.trim();
    if (!q || !produtos) return;
    const p = produtos.find((x) => x.codigo_barras === q || x.codigo_interno === q)
      ?? produtos.find((x) => x.nome.toLowerCase().includes(q.toLowerCase()));
    if (!p) { toast.error("Produto não encontrado"); return; }
    addProduto(p);
    setBusca("");
    codeRef.current?.focus();
  };

  const updateQtd = (id: string, d: number) => {
    setItens((prev) => prev.map((i) => i.produto.id === id ? { ...i, qtd: Math.max(1, i.qtd + d) } : i));
  };
  const removeItem = (id: string) => setItens((prev) => prev.filter((i) => i.produto.id !== id));

  const finalizar = async () => {
    if (!user || itens.length === 0) return;
    if (forma === "dinheiro" && (Number(recebido) || 0) < total) { toast.error("Valor recebido insuficiente"); return; }
    setFinalizing(true);
    try {
      const { data: venda, error: e1 } = await supabase.from("vendas").insert({
        user_id: user.id, total, forma_pagamento: forma,
        valor_recebido: forma === "dinheiro" ? Number(recebido) : null,
        troco: forma === "dinheiro" ? troco : 0,
      }).select().single();
      if (e1) throw e1;

      const payload = itens.map((i) => ({
        venda_id: venda.id, produto_id: i.produto.id, produto_nome: i.produto.nome,
        quantidade: i.qtd, preco_unitario: Number(i.produto.preco_venda), subtotal: i.qtd * Number(i.produto.preco_venda),
      }));
      const { error: e2 } = await supabase.from("itens_venda").insert(payload);
      if (e2) throw e2;

      toast.success(`Venda #${venda.numero} concluída — ${brl(total)}`);
      setItens([]); setRecebido(""); setPayOpen(false); setForma("dinheiro");
      qc.invalidateQueries({ queryKey: ["produtos-pdv"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      codeRef.current?.focus();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao finalizar");
    } finally { setFinalizing(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_400px] max-w-7xl">
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="display flex items-center gap-2"><ScanLine className="w-5 h-5 text-accent" /> Frente de Caixa</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onScan} className="flex gap-2">
              <Input
                ref={codeRef}
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Código de barras, código interno ou nome…"
                className="text-lg h-12"
                autoComplete="off"
              />
              <Button type="submit" size="lg" className="h-12"><Plus className="w-4 h-4 mr-1" />Adicionar</Button>
              <Button type="button" variant="outline" size="lg" className="h-12" onClick={() => setSearchOpen(true)}>
                <Search className="w-4 h-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="min-h-[400px]">
          <CardContent className="p-0">
            {itens.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <ShoppingCart className="w-12 h-12 mb-3 opacity-40" />
                <p>Escaneie ou digite o código de um produto.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {itens.map((i) => (
                  <li key={i.produto.id} className="p-4 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{i.produto.nome}</p>
                      <p className="text-xs text-muted-foreground">{brl(Number(i.produto.preco_venda))} cada</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQtd(i.produto.id, -1)}><Minus className="w-3 h-3" /></Button>
                      <span className="w-10 text-center font-mono font-semibold">{i.qtd}</span>
                      <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => updateQtd(i.produto.id, 1)}><Plus className="w-3 h-3" /></Button>
                    </div>
                    <div className="w-24 text-right font-semibold">{brl(i.qtd * Number(i.produto.preco_venda))}</div>
                    <Button size="icon" variant="ghost" onClick={() => removeItem(i.produto.id)} className="h-8 w-8 text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-4 lg:self-start">
        <CardHeader><CardTitle className="display">Resumo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Itens</span><span>{itens.reduce((a,i)=>a+i.qtd,0)}</span>
          </div>
          <div className="pt-4 border-t border-border">
            <div className="flex justify-between items-baseline">
              <span className="text-muted-foreground">Total</span>
              <span className="text-4xl font-bold display text-accent">{brl(total)}</span>
            </div>
          </div>
          <Button size="lg" className="w-full h-14 text-lg" disabled={itens.length === 0} onClick={() => setPayOpen(true)}>
            Finalizar Venda
          </Button>
          {itens.length > 0 && (
            <Button variant="ghost" className="w-full text-destructive" size="sm" onClick={() => setItens([])}>
              Cancelar venda
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Search modal */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Buscar produto</DialogTitle></DialogHeader>
          <Input placeholder="Digite o nome…" value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
          <div className="max-h-96 overflow-y-auto divide-y divide-border">
            {(produtos ?? []).filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase())).slice(0, 50).map((p) => (
              <button key={p.id} className="w-full p-3 text-left hover:bg-accent/10 flex justify-between items-center" onClick={() => { addProduto(p); setSearchOpen(false); setBusca(""); }}>
                <div><div className="font-medium">{p.nome}</div><div className="text-xs text-muted-foreground">Estoque: {Number(p.estoque)}</div></div>
                <div className="font-semibold text-accent">{brl(Number(p.preco_venda))}</div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Pagamento */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle className="display text-2xl">Pagamento — {brl(total)}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
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
            {forma === "dinheiro" && (
              <div>
                <Label>Valor recebido</Label>
                <Input type="number" step="0.01" value={recebido} onChange={(e) => setRecebido(e.target.value)} placeholder="0,00" autoFocus className="text-2xl h-14" />
                <div className="mt-2 text-sm">Troco: <span className="font-bold text-success">{brl(troco)}</span></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancelar</Button>
            <Button onClick={finalizar} disabled={finalizing}>{finalizing ? "Processando…" : "Confirmar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
