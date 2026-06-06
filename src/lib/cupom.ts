// Renderiza um cupom HTML simples para impressão térmica 80mm.
// Usado pelo PDV e Comandas.

export type CupomItem = {
  nome: string;
  qtd: number;
  preco: number;
  subtotal: number;
};

export type CupomVenda = {
  titulo: string;
  numero?: string | number;
  cliente?: string;
  itens: CupomItem[];
  total: number;
  forma_pagamento?: string;
  recebido?: number;
  troco?: number;
  observacao?: string;
};

const brl = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function renderCupomHTML(v: CupomVenda, paperSize: "80mm" | "58mm" | "A4" = "80mm") {
  const width = paperSize === "58mm" ? "58mm" : paperSize === "A4" ? "210mm" : "80mm";
  return `<!doctype html><html><head><meta charset="utf-8"/>
<title>${v.titulo}</title>
<style>
  @page { size: ${width} auto; margin: 4mm; }
  body { font-family: 'Courier New', monospace; width: ${width}; margin: 0; padding: 4mm; font-size: 12px; color: #000; }
  h1 { font-size: 14px; text-align: center; margin: 0 0 4px; }
  .meta { text-align: center; font-size: 11px; margin-bottom: 6px; }
  hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 0; vertical-align: top; font-size: 11px; }
  .right { text-align: right; }
  .total { font-size: 14px; font-weight: bold; }
  .small { font-size: 10px; }
</style></head><body>
  <h1>ADEGA PDV</h1>
  <div class="meta">${v.titulo}${v.numero ? ` #${v.numero}` : ""}</div>
  <div class="meta">${new Date().toLocaleString("pt-BR")}</div>
  ${v.cliente ? `<div class="meta">Cliente: ${v.cliente}</div>` : ""}
  <hr/>
  <table>
    ${v.itens
      .map(
        (i) => `
      <tr><td colspan="2">${escapeHtml(i.nome)}</td></tr>
      <tr>
        <td>${i.qtd} x ${brl(i.preco)}</td>
        <td class="right">${brl(i.subtotal)}</td>
      </tr>`,
      )
      .join("")}
  </table>
  <hr/>
  <table>
    <tr class="total"><td>TOTAL</td><td class="right">${brl(v.total)}</td></tr>
    ${v.forma_pagamento ? `<tr><td>Pagamento</td><td class="right">${v.forma_pagamento.toUpperCase()}</td></tr>` : ""}
    ${v.recebido != null ? `<tr><td>Recebido</td><td class="right">${brl(v.recebido)}</td></tr>` : ""}
    ${v.troco != null && v.troco > 0 ? `<tr><td>Troco</td><td class="right">${brl(v.troco)}</td></tr>` : ""}
  </table>
  ${v.observacao ? `<hr/><div class="small">${escapeHtml(v.observacao)}</div>` : ""}
  <hr/>
  <div class="meta small">Obrigado pela preferência!</div>
</body></html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Dispara a impressão respeitando as configurações salvas
export async function imprimirCupom(v: CupomVenda) {
  const { loadSettings, isElectron } = await import("@/lib/printer");
  const s = loadSettings();
  const html = renderCupomHTML(v, s.paperSize);

  if (isElectron() && window.electronAPI) {
    for (let i = 0; i < (s.copies || 1); i++) {
      await window.electronAPI.print(html, {
        printer: s.defaultPrinter || undefined,
        silent: s.silentPrint,
        copies: 1,
      });
    }
    return;
  }
  // Navegador: abre uma janela e dispara window.print()
  const w = window.open("", "_blank", "width=400,height=600");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => {
    w.focus();
    w.print();
    setTimeout(() => w.close(), 500);
  }, 300);
}
