import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Receipt } from "lucide-react";
import { brl, dtBR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/vendas")({ component: Vendas });

function Vendas() {
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<string | null>(null);

  const { data: vendas } = useQuery({
    queryKey: ["vendas-hist"],
    queryFn: async () => (await supabase.from("vendas").select("*, profiles:user_id(nome), itens_venda(produto_nome, quantidade, preco_unitario, subtotal)").order("created_at", { ascending: false }).limit(200)).data ?? [],
  });

  const filtered = (vendas ?? []).filter((v: any) => {
    if (!busca) return true;
    const q = busca.toLowerCase();
    return String(v.numero).includes(q)
      || v.profiles?.nome?.toLowerCase().includes(q)
      || v.itens_venda?.some((i: any) => i.produto_nome.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4 max-w-6xl">
      <div>
        <h1 className="text-3xl display font-bold flex items-center gap-2"><Receipt className="w-7 h-7 text-accent" /> Histórico de Vendas</h1>
        <p className="text-muted-foreground text-sm">Últimas 200 vendas registradas.</p>
      </div>

      <Card>
        <CardHeader className="pb-3"><Input placeholder="Buscar por nº, operador ou produto…" value={busca} onChange={(e) => setBusca(e.target.value)} /></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground bg-muted/30 text-left">
                <tr><th className="px-4 py-3">#</th><th className="px-4 py-3">Data</th><th className="px-4 py-3">Operador</th><th className="px-4 py-3">Pagamento</th><th className="px-4 py-3 text-right">Total</th></tr>
              </thead>
              <tbody>
                {filtered.map((v: any) => (
                  <>
                    <tr key={v.id} className="border-t border-border hover:bg-muted/20 cursor-pointer" onClick={() => setAberta(aberta === v.id ? null : v.id)}>
                      <td className="px-4 py-3 font-mono">#{v.numero}</td>
                      <td className="px-4 py-3 text-muted-foreground">{dtBR(v.created_at)}</td>
                      <td className="px-4 py-3">{v.profiles?.nome ?? "—"}</td>
                      <td className="px-4 py-3 uppercase text-xs">{v.forma_pagamento}</td>
                      <td className="px-4 py-3 text-right font-bold text-accent">{brl(Number(v.total))}</td>
                    </tr>
                    {aberta === v.id && (
                      <tr key={v.id+"-d"} className="bg-muted/10">
                        <td colSpan={5} className="px-6 py-3">
                          <table className="w-full text-xs">
                            <thead className="text-muted-foreground"><tr><th className="text-left py-1">Produto</th><th className="text-right py-1">Qtd</th><th className="text-right py-1">Unit.</th><th className="text-right py-1">Subtotal</th></tr></thead>
                            <tbody>
                              {v.itens_venda?.map((i: any, idx: number) => (
                                <tr key={idx} className="border-t border-border/50">
                                  <td className="py-1">{i.produto_nome}</td>
                                  <td className="text-right py-1 font-mono">{Number(i.quantidade)}</td>
                                  <td className="text-right py-1 font-mono">{brl(Number(i.preco_unitario))}</td>
                                  <td className="text-right py-1 font-mono">{brl(Number(i.subtotal))}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {v.forma_pagamento === "dinheiro" && (
                            <div className="mt-2 text-xs text-muted-foreground">Recebido: {brl(Number(v.valor_recebido))} · Troco: {brl(Number(v.troco))}</div>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                ))}
                {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">Nenhuma venda.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
