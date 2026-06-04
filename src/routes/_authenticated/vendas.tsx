import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Receipt, Calendar } from "lucide-react";
import { brl } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/vendas")({ component: Vendas });

function startOfDayISO(d: Date) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x.toISOString();
}
function endOfDayISO(d: Date) {
  const x = new Date(d); x.setHours(23, 59, 59, 999); return x.toISOString();
}
function todayInput() {
  const d = new Date();
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function horaBR(s: string) {
  return new Date(s).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function Vendas() {
  const [dia, setDia] = useState(todayInput());
  const [categoria, setCategoria] = useState<string>("todas");
  const [busca, setBusca] = useState("");

  const dataRef = new Date(`${dia}T12:00:00`);
  const ini = startOfDayISO(dataRef);
  const fim = endOfDayISO(dataRef);

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias"],
    queryFn: async () => (await supabase.from("categorias").select("id, nome").order("nome")).data ?? [],
  });

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["itens-do-dia", ini, fim],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itens_venda")
        .select(`
          id, produto_nome, quantidade, preco_unitario, subtotal,
          produtos:produto_id ( id, categoria_id, categorias:categoria_id ( id, nome ) ),
          vendas:venda_id!inner ( id, numero, created_at, forma_pagamento )
        `)
        .gte("vendas.created_at", ini)
        .lte("vendas.created_at", fim)
        .order("created_at", { foreignTable: "vendas", ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    return (itens as any[]).filter((i) => {
      if (categoria !== "todas") {
        if (i.produtos?.categoria_id !== categoria) return false;
      }
      if (busca) {
        const q = busca.toLowerCase();
        if (!i.produto_nome.toLowerCase().includes(q) && !String(i.vendas?.numero).includes(q)) return false;
      }
      return true;
    });
  }, [itens, categoria, busca]);

  const totais = useMemo(() => {
    let qtd = 0, valor = 0;
    for (const i of filtered) { qtd += Number(i.quantidade); valor += Number(i.subtotal); }
    return { qtd, valor, registros: filtered.length };
  }, [filtered]);

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-3xl display font-bold flex items-center gap-2">
          <Receipt className="w-7 h-7 text-accent" /> Vendas do dia
        </h1>
        <p className="text-muted-foreground text-sm">Itens vendidos no dia selecionado.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Registros</div>
          <div className="text-2xl font-bold">{totais.registros}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Itens vendidos</div>
          <div className="text-2xl font-bold">{totais.qtd}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs text-muted-foreground uppercase">Total</div>
          <div className="text-2xl font-bold text-accent">{brl(totais.valor)}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input type="date" value={dia} onChange={(e) => setDia(e.target.value)} className="pl-9" />
            </div>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as categorias</SelectItem>
                {(categorias as any[]).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Buscar produto ou nº venda…" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/30 text-left">
                <tr>
                  <th className="px-4 py-3">Hora</th>
                  <th className="px-4 py-3">Venda</th>
                  <th className="px-4 py-3">Produto</th>
                  <th className="px-4 py-3">Categoria</th>
                  <th className="px-4 py-3 text-right">Qtd</th>
                  <th className="px-4 py-3 text-right">Unit.</th>
                  <th className="px-4 py-3 text-right">Subtotal</th>
                  <th className="px-4 py-3">Pgto</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Carregando…</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-10 text-muted-foreground">Nenhum item para os filtros selecionados.</td></tr>
                ) : filtered.map((i: any) => (
                  <tr key={i.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-4 py-2 text-muted-foreground font-mono">{horaBR(i.vendas.created_at)}</td>
                    <td className="px-4 py-2 font-mono">#{i.vendas.numero}</td>
                    <td className="px-4 py-2 font-medium">{i.produto_nome}</td>
                    <td className="px-4 py-2 text-muted-foreground">{i.produtos?.categorias?.nome ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{Number(i.quantidade)}</td>
                    <td className="px-4 py-2 text-right font-mono">{brl(Number(i.preco_unitario))}</td>
                    <td className="px-4 py-2 text-right font-mono font-semibold">{brl(Number(i.subtotal))}</td>
                    <td className="px-4 py-2 uppercase text-xs">{i.vendas.forma_pagamento}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
