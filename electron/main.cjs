const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');

// URL do app publicado no Lovable. Substitua pela URL real após publicar.
const APP_URL = process.env.ADEGA_URL || 'https://adega-point-pro.lovable.app';

function createWindow() {
  const win = new BrowserWindow({
    width: 1366,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Adega - Gestão e PDV',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.png'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  Menu.setApplicationMenu(null);
  win.maximize();
  win.loadURL(APP_URL);

  // ===== IPC para impressoras =====
  ipcMain.handle('printers:list', async () => {
    try { return await win.webContents.getPrintersAsync(); }
    catch { return []; }
  });

  ipcMain.handle('printers:print', async (_evt, { html, options }) => {
    const printWin = new BrowserWindow({ show: false, webPreferences: { offscreen: false } });
    await printWin.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    return new Promise((resolve) => {
      printWin.webContents.print({
        silent: !!options?.silent,
        deviceName: options?.printer || undefined,
        copies: options?.copies || 1,
        printBackground: true,
      }, (ok) => { printWin.close(); resolve({ ok }); });
    });
  });

  // Abrir links externos no navegador padrão
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Atalho F5 para recarregar, F11 para fullscreen, Ctrl+Shift+I para devtools
  win.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F5') win.reload();
    if (input.key === 'F11') win.setFullScreen(!win.isFullScreen());
    if (input.control && input.shift && input.key.toLowerCase() === 'i') {
      win.webContents.toggleDevTools();
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
