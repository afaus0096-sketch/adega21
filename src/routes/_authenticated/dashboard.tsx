import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl } from "@/lib/format";
import { TrendingUp, DollarSign, ShoppingBag, AlertTriangle, Wine } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

export const Route = createFileRoute("/_authenticated/dashboard")({ component: Dashboard });

function startOfDay() { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); }
function startOfWeek() { const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString(); }
function startOfMonth() { const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d.toISOString(); }

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [dia, semana, mes, baixo, last7, porCat, porPag] = await Promise.all([
        supabase.from("vendas").select("total, forma_pagamento").gte("created_at", startOfDay()),
        supabase.from("vendas").select("total").gte("created_at", startOfWeek()),
        supabase.from("vendas").select("total").gte("created_at", startOfMonth()),
        supabase.from("produtos").select("id, nome, estoque, estoque_minimo").eq("ativo", true),
        supabase.from("vendas").select("total, created_at").gte("created_at", startOfWeek()),
        supabase.from("itens_venda").select("subtotal, quantidade, produtos:produto_id(nome, categorias:categoria_id(nome))").gte("created_at", startOfMonth()),
        supabase.from("vendas").select("total, forma_pagamento").gte("created_at", startOfMonth()),
      ]);

      const sum = (rows: any[] | null) => (rows ?? []).reduce((a, r) => a + Number(r.total || 0), 0);
      const vendasDia = dia.data ?? [];
      const baixos = (baixo.data ?? []).filter((p) => Number(p.estoque) <= Number(p.estoque_minimo) && Number(p.estoque_minimo) > 0);

      // por dia (últimos 7)
      const byDay = new Map<string, number>();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
        byDay.set(d.toLocaleDateString("pt-BR", { weekday: "short" }), 0);
      }
      (last7.data ?? []).forEach((v: any) => {
        const k = new Date(v.created_at).toLocaleDateString("pt-BR", { weekday: "short" });
        byDay.set(k, (byDay.get(k) ?? 0) + Number(v.total));
      });

      // por categoria
      const cats = new Map<string, number>();
      (porCat.data ?? []).forEach((it: any) => {
        const nome = it.produtos?.categorias?.nome ?? "Outros";
        cats.set(nome, (cats.get(nome) ?? 0) + Number(it.subtotal));
      });

      // por forma pagamento
      const pags = new Map<string, number>();
      (porPag.data ?? []).forEach((v: any) => {
        pags.set(v.forma_pagamento, (pags.get(v.forma_pagamento) ?? 0) + Number(v.total));
      });

      return {
        faturamentoDia: sum(vendasDia),
        faturamentoSemana: sum(semana.data),
        faturamentoMes: sum(mes.data),
        qtdVendas: vendasDia.length,
        ticket: vendasDia.length ? sum(vendasDia) / vendasDia.length : 0,
        baixos,
        byDay: Array.from(byDay, ([dia, total]) => ({ dia, total })),
        cats: Array.from(cats, ([name, value]) => ({ name, value })).sort((a,b)=>b.value-a.value).slice(0,6),
        pags: Array.from(pags, ([name, value]) => ({ name: name.toUpperCase(), value })),
      };
    },
  });

  const colors = ["oklch(0.55 0.18 20)", "oklch(0.72 0.16 75)", "oklch(0.65 0.16 145)", "oklch(0.6 0.12 280)", "oklch(0.7 0.14 200)", "oklch(0.6 0.18 340)"];

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-3xl display font-bold flex items-center gap-3">
          <Wine className="w-7 h-7 text-accent" /> Dashboard
        </h1>
        <p className="text-muted-foreground">Visão geral do seu negócio em tempo real.</p>
      </div>

      {isLoading ? (
        <div className="text-muted-foreground">Carregando…</div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Faturamento Hoje" value={brl(data!.faturamentoDia)} icon={<DollarSign className="w-5 h-5" />} accent />
            <StatCard title="Vendas Hoje" value={String(data!.qtdVendas)} icon={<ShoppingBag className="w-5 h-5" />} />
            <StatCard title="Ticket Médio" value={brl(data!.ticket)} icon={<TrendingUp className="w-5 h-5" />} />
            <StatCard title="Estoque Baixo" value={String(data!.baixos.length)} icon={<AlertTriangle className="w-5 h-5" />} warn={data!.baixos.length > 0} />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">Semana</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{brl(data!.faturamentoSemana)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">Mês</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{brl(data!.faturamentoMes)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-normal text-muted-foreground">Produtos Baixos</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-warning">{data!.baixos.length}</div></CardContent></Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="display">Vendas — últimos 7 dias</CardTitle></CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data!.byDay}>
                    <XAxis dataKey="dia" stroke="oklch(0.72 0.02 60)" fontSize={12} />
                    <YAxis stroke="oklch(0.72 0.02 60)" fontSize={12} />
                    <Tooltip contentStyle={{ background: "oklch(0.22 0.025 25)", border: "1px solid oklch(0.32 0.02 30)", borderRadius: 8 }} formatter={(v: any) => brl(Number(v))} />
                    <Bar dataKey="total" fill="oklch(0.55 0.18 20)" radius={[6,6,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="display">Vendas por categoria (mês)</CardTitle></CardHeader>
              <CardContent className="h-72">
                {data!.cats.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm">Sem dados.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={data!.cats} dataKey="value" nameKey="name" outerRadius={90} label={(e) => e.name}>
                        {data!.cats.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: any) => brl(Number(v))} contentStyle={{ background: "oklch(0.22 0.025 25)", border: "1px solid oklch(0.32 0.02 30)", borderRadius: 8 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {data!.baixos.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="display text-warning flex items-center gap-2"><AlertTriangle className="w-5 h-5" /> Estoque baixo</CardTitle></CardHeader>
              <CardContent>
                <ul className="divide-y divide-border">
                  {data!.baixos.map((p) => (
                    <li key={p.id} className="flex justify-between py-2 text-sm">
                      <span>{p.nome}</span>
                      <span className="text-warning font-mono">{Number(p.estoque)} / mín {Number(p.estoque_minimo)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ title, value, icon, accent, warn }: { title: string; value: string; icon: React.ReactNode; accent?: boolean; warn?: boolean }) {
  return (
    <Card className={accent ? "bg-gradient-to-br from-primary/20 to-card border-primary/30" : ""}>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold mt-1 ${warn ? "text-warning" : ""}`}>{value}</p>
          </div>
          <div className={`p-2 rounded-lg ${accent ? "bg-primary/30 text-accent" : "bg-muted text-muted-foreground"}`}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
