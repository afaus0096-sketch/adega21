// Gerenciamento de configurações de impressora.
// No navegador puro: usamos window.print() que abre o diálogo do SO
// e respeita a fila de impressão instalada.
// No app Electron: detectamos via window.electronAPI (ver electron/preload.cjs)

export type PrinterSettings = {
  defaultPrinter: string;     // nome (Electron) ou rótulo
  paperSize: "80mm" | "58mm" | "A4";
  copies: number;
  silentPrint: boolean;       // só funciona no Electron
  autoOpen: boolean;          // abre diálogo automaticamente após venda
};

const KEY = "adega:printer-settings";

export const defaultSettings: PrinterSettings = {
  defaultPrinter: "",
  paperSize: "80mm",
  copies: 1,
  silentPrint: false,
  autoOpen: true,
};

export function loadSettings(): PrinterSettings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch { return defaultSettings; }
}

export function saveSettings(s: PrinterSettings) {
  localStorage.setItem(KEY, JSON.stringify(s));
}

// Detecta se rodando dentro do Electron com nossa API exposta
type ElectronAPI = {
  getPrinters: () => Promise<Array<{ name: string; displayName?: string; isDefault?: boolean }>>;
  print: (html: string, options: { printer?: string; silent?: boolean; copies?: number }) => Promise<{ ok: boolean }>;
};
declare global {
  interface Window { electronAPI?: ElectronAPI }
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && !!window.electronAPI;
}

export async function listSystemPrinters(): Promise<string[]> {
  if (!isElectron()) return [];
  try {
    const list = await window.electronAPI!.getPrinters();
    return list.map((p) => p.displayName || p.name);
  } catch { return []; }
}
