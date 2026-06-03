import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FileBarChart2, Download, ArrowUp, ArrowDown } from "lucide-react";
import { brl, dtBR } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fechamento")({ component: Fechamento });

type Filtro = "vendas" | "compras" | "saidas" | "ajuste" | "estoque";

const FILTROS: { id: Filtro; label: string }[] = [
  { id: "vendas", label: "Vendas" },
  { id: "compras", label: "Compras" },
  { id: "saidas", label: "Saídas / Despesas" },
  { id: "ajuste", label: "Ajustes de saldo" },
  { id: "estoque", label: "Movimentações de estoque" },
];

function startOfDay(d: string) { const x = new Date(d + "T00:00:00"); return x.toISOString(); }
function endOfDay(d: string) { const x = new Date(d + "T23:59:59.999"); return x.toISOString(); }

function todayStr() {
  const d = new Date(); d.setHours(0,0,0,0);
  return d.toISOString().slice(0, 10);
}
function firstOfMonthStr() {
  const d = new Date(); d.setDate(1); d.setHours(0,0,0,0);
  return d.toISOString().slice(0, 10);
}

function Fechamento() {
  const [de, setDe] = useState(firstOfMonthStr());
  const [ate, setAte] = useState(todayStr());
  const [sel, setSel] = useState<Record<Filtro, boolean>>({
    vendas: true, compras: true, saidas: true, ajuste: true, estoque: true,
  });

  const toggle = (id: Filtro) => setSel((s) => ({ ...s, [id]: !s[id] }));

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["fechamento", de, ate],
    queryFn: async () => {
      const ini = startOfDay(de); const fim = endOfDay(ate);
      const [fluxo, vendas, mov] = await Promise.all([
        supabase.from("fluxo_caixa").select("*").gte("created_at", ini).lte("created_at", fim).order("created_at", { ascending: false }),
        supabase.from("vendas").select("*").gte("created_at", ini).lte("created_at", fim).order("created_at", { ascending: false }),
        supabase.from("movimentacoes_estoque").select("*, produtos:produto_id(nome)").gte("created_at", ini).lte("created_at", fim).order("created_at", { ascending: false }),
      ]);
      return { fluxo: fluxo.data ?? [], vendas: vendas.data ?? [], mov: mov.data ?? [] };
    },
  });

  const linhas = useMemo(() => {
    if (!data) return [] as any[];
    const out: any[] = [];

    if (sel.vendas) {
      data.vendas.forEach((v: any) => out.push({
        when: v.created_at, grupo: "Vendas", tipo: "entrada",
        descricao: `Venda #${v.numero} • ${v.forma_pagamento}`,
        valor: Number(v.total),
      }));
    }
    data.fluxo.forEach((f: any) => {
      const cat = String(f.categoria ?? "").toLowerCase();
      const isCompra = cat.includes("compra");
      const isAjuste = cat.includes("ajuste");
      const isVenda = cat.includes("venda");
      // Vendas já vêm da tabela vendas; pular o espelho do fluxo
      if (isVenda) return;

      let grupo: string | null = null;
      if (isCompra && sel.compras) grupo = "Compras";
      else if (isAjuste && sel.ajuste) grupo = "Ajuste de saldo";
      else if (!isCompra && !isAjuste && f.tipo === "saida" && sel.saidas) grupo = "Saídas";
      else if (!isCompra && !isAjuste && f.tipo === "entrada" && sel.saidas) grupo = "Outras entradas";

      if (!grupo) return;
      out.push({
        when: f.created_at, grupo, tipo: f.tipo,
        descricao: `${f.categoria} • ${f.descricao ?? "—"}`,
        valor: Number(f.valor),
      });
    });

    if (sel.estoque) {
      data.mov.forEach((m: any) => out.push({
        when: m.created_at, grupo: "Estoque", tipo: m.tipo === "saida_venda" || m.tipo === "saida" ? "saida" : "entrada",
        descricao: `${m.produtos?.nome ?? "Produto"} • ${m.tipo} (${Number(m.quantidade)} un) ${m.observacao ? "• " + m.observacao : ""}`,
        valor: 0,
      }));
    }

    return out.sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime());
  }, [data, sel]);

  const totais = useMemo(() => {
    const entradas = linhas.filter((l) => l.tipo === "entrada").reduce((a, l) => a + l.valor, 0);
    const saidas = linhas.filter((l) => l.tipo === "saida").reduce((a, l) => a + l.valor, 0);
    const porGrupo: Record<string, { entrada: number; saida: number; qtd: number }> = {};
    linhas.forEach((l) => {
      porGrupo[l.grupo] ??= { entrada: 0, saida: 0, qtd: 0 };
      porGrupo[l.grupo].qtd += 1;
      if (l.tipo === "entrada") porGrupo[l.grupo].entrada += l.valor;
      else porGrupo[l.grupo].saida += l.valor;
    });
    return { entradas, saidas, saldo: entradas - saidas, porGrupo };
  }, [linhas]);

  const exportarCSV = () => {
    if (linhas.length === 0) { toast.error("Nada a exportar"); return; }
    const head = ["Data", "Grupo", "Tipo", "Descrição", "Valor"];
    const rows = linhas.map((l) => [
      dtBR(l.when), l.grupo, l.tipo, (l.descricao ?? "").replace(/"/g, '""'),
      l.valor.toFixed(2).replace(".", ","),
    ]);
    const csv = [head, ...rows].map((r) => r.map((c) => `"${c}"`).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fechamento_${de}_a_${ate}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado");
  };

  const imprimir = () => window.print();

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <div>
          <h1 className="text-3xl display font-bold flex items-center gap-2"><FileBarChart2 className="w-7 h-7 text-accent" /> Fechamento</h1>
          <p className="text-muted-foreground text-sm">Relatório de entradas e saídas por período.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={imprimir}>Imprimir</Button>
          <Button onClick={exportarCSV}><Download className="w-4 h-4 mr-1" /> Exportar CSV</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="display text-lg">Filtros</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <div><Label className="text-xs">De</Label><Input type="date" value={de} onChange={(e) => setDe(e.target.value)} /></div>
            <div><Label className="text-xs">Até</Label><Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} /></div>
            <div className="flex items-end"><Button variant="outline" className="w-full" onClick={() => refetch()}>Atualizar</Button></div>
          </div>
          <div className="flex flex-wrap gap-3">
            {FILTROS.map((f) => (
              <label key={f.id} className="flex items-center gap-2 px-3 py-2 rounded-md border border-border cursor-pointer hover:bg-muted/40">
                <Checkbox checked={sel[f.id]} onCheckedChange={() => toggle(f.id)} />
                <span className="text-sm">{f.label}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Entradas</div><div className="text-2xl font-bold text-success">{brl(totais.entradas)}</div></CardContent></Card>
        <Card><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Saídas</div><div className="text-2xl font-bold text-destructive">{brl(totais.saidas)}</div></CardContent></Card>
        <Card className="bg-gradient-to-br from-primary/15 to-card border-primary/30"><CardContent className="pt-6"><div className="text-sm text-muted-foreground">Saldo do período</div><div className={`text-2xl font-bold ${totais.saldo>=0?"text-accent":"text-destructive"}`}>{brl(totais.saldo)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="display text-lg">Resumo por categoria</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/30 text-left">
                <tr><th className="px-4 py-3">Categoria</th><th className="px-4 py-3 text-right">Qtd</th><th className="px-4 py-3 text-right">Entradas</th><th className="px-4 py-3 text-right">Saídas</th></tr>
              </thead>
              <tbody>
                {Object.entries(totais.porGrupo).map(([g, v]) => (
                  <tr key={g} className="border-t border-border">
                    <td className="px-4 py-2 font-medium">{g}</td>
                    <td className="px-4 py-2 text-right font-mono">{v.qtd}</td>
                    <td className="px-4 py-2 text-right font-mono text-success">{brl(v.entrada)}</td>
                    <td className="px-4 py-2 text-right font-mono text-destructive">{brl(v.saida)}</td>
                  </tr>
                ))}
                {Object.keys(totais.porGrupo).length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum dado no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="display text-lg">Lançamentos {isFetching && <span className="text-xs text-muted-foreground">(carregando…)</span>}</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/30 text-left">
                <tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3 text-right">Valor</th></tr>
              </thead>
              <tbody>
                {linhas.map((l, i) => (
                  <tr key={i} className="border-t border-border">
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">{dtBR(l.when)}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1">
                        {l.tipo === "entrada" ? <ArrowUp className="w-3 h-3 text-success" /> : <ArrowDown className="w-3 h-3 text-destructive" />}
                        {l.grupo}
                      </span>
                    </td>
                    <td className="px-4 py-2">{l.descricao}</td>
                    <td className={`px-4 py-2 text-right font-mono font-semibold ${l.tipo === "entrada" ? "text-success" : "text-destructive"}`}>
                      {l.valor > 0 ? (l.tipo === "entrada" ? "+" : "−") + brl(l.valor) : "—"}
                    </td>
                  </tr>
                ))}
                {linhas.length === 0 && <tr><td colSpan={4} className="text-center py-10 text-muted-foreground">Nenhum lançamento para os filtros selecionados.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
