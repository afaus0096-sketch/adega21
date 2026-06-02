const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

// URL do app publicado no Lovable. Substitua pela URL real após publicar.
const APP_URL = process.env.ADEGA_URL || 'https://REPLACE-ME.lovable.app';

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
    },
  });

  Menu.setApplicationMenu(null);
  win.maximize();
  win.loadURL(APP_URL);

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
