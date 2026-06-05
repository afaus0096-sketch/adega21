import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Printer, Info, TestTube2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  loadSettings, saveSettings, listSystemPrinters, isElectron,
  type PrinterSettings,
} from "@/lib/printer";

export const Route = createFileRoute("/_authenticated/impressoras")({
  component: ImpressorasPage,
});

function ImpressorasPage() {
  const { role } = useAuth();
  if (role !== "admin") return <Navigate to="/dashboard" replace />;

  const [s, setS] = useState<PrinterSettings>(loadSettings());
  const [printers, setPrinters] = useState<string[]>([]);
  const electron = isElectron();

  useEffect(() => {
    listSystemPrinters().then(setPrinters);
  }, []);

  const handleSave = () => {
    saveSettings(s);
    toast.success("Configurações salvas!");
  };

  const handleTest = () => {
    const html = `
      <html><head><title>Teste de impressão</title>
      <style>body{font-family:monospace;padding:12px}h2{margin:0 0 8px}</style>
      </head><body>
      <h2>=== TESTE DE IMPRESSÃO ===</h2>
      <div>Adega PDV</div>
      <div>Impressora: ${s.defaultPrinter || "(padrão do sistema)"}</div>
      <div>Tamanho: ${s.paperSize}</div>
      <div>Cópias: ${s.copies}</div>
      <hr/>
      <div>Se você consegue ler isso, está tudo certo!</div>
      <div>${new Date().toLocaleString("pt-BR")}</div>
      </body></html>`;
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) { toast.error("Bloqueador de pop-ups ativo"); return; }
    w.document.write(html); w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 250);
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl font-bold display flex items-center gap-2">
          <Printer className="w-7 h-7 text-accent" /> Impressoras
        </h1>
        <p className="text-muted-foreground mt-1">
          Configure como o sistema envia recibos e comandas para impressão.
        </p>
      </div>

      {!electron && (
        <Alert>
          <Info className="w-4 h-4" />
          <AlertTitle>Você está usando a versão Web</AlertTitle>
          <AlertDescription>
            No navegador, o sistema usa o <strong>diálogo de impressão do Windows/macOS/Linux</strong>,
            que mostra todas as impressoras instaladas (incluindo as térmicas). A escolha final da
            impressora é feita lá. Para impressão silenciosa (sem diálogo) e seleção automática,
            use o <strong>aplicativo desktop</strong> (Electron).
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Configurações</CardTitle>
          <CardDescription>Aplicam-se à impressão de recibos, comandas e relatórios.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Impressora padrão</Label>
            {electron && printers.length > 0 ? (
              <Select value={s.defaultPrinter} onValueChange={(v) => setS({ ...s, defaultPrinter: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione uma impressora…" /></SelectTrigger>
                <SelectContent>
                  {printers.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <>
                <Input
                  value={s.defaultPrinter}
                  onChange={(e) => setS({ ...s, defaultPrinter: e.target.value })}
                  placeholder="ex.: Epson TM-T20 (deixe em branco para usar a padrão do SO)"
                />
                <p className="text-xs text-muted-foreground">
                  Informe o nome exato da impressora no Windows/macOS, ou deixe em branco.
                </p>
              </>
            )}
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tamanho do papel</Label>
              <Select value={s.paperSize} onValueChange={(v) => setS({ ...s, paperSize: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="80mm">Térmica 80mm (recomendado)</SelectItem>
                  <SelectItem value="58mm">Térmica 58mm</SelectItem>
                  <SelectItem value="A4">A4</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Cópias</Label>
              <Input
                type="number" min={1} max={5}
                value={s.copies}
                onChange={(e) => setS({ ...s, copies: Math.max(1, Math.min(5, Number(e.target.value) || 1)) })}
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border border-border p-3">
            <div>
              <div className="font-medium">Abrir diálogo de impressão automaticamente</div>
              <p className="text-xs text-muted-foreground">Após cada venda/comanda fechada.</p>
            </div>
            <Switch checked={s.autoOpen} onCheckedChange={(v) => setS({ ...s, autoOpen: v })} />
          </div>

          <div className={`flex items-center justify-between rounded-md border border-border p-3 ${!electron ? "opacity-60" : ""}`}>
            <div>
              <div className="font-medium">Impressão silenciosa</div>
              <p className="text-xs text-muted-foreground">
                Envia direto para a impressora sem mostrar diálogo. {!electron && "Requer app desktop."}
              </p>
            </div>
            <Switch
              checked={s.silentPrint}
              disabled={!electron}
              onCheckedChange={(v) => setS({ ...s, silentPrint: v })}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave}><Save className="w-4 h-4 mr-1" /> Salvar</Button>
            <Button variant="outline" onClick={handleTest}>
              <TestTube2 className="w-4 h-4 mr-1" /> Imprimir página de teste
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Impressoras detectadas</CardTitle>
        </CardHeader>
        <CardContent>
          {electron ? (
            printers.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma impressora encontrada no sistema.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {printers.map((p) => <li key={p}>• {p}</li>)}
              </ul>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              A listagem automática só está disponível no aplicativo desktop.
              No navegador, todas as impressoras instaladas aparecerão no diálogo do sistema ao imprimir.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
