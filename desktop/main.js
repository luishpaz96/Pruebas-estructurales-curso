// Envoltorio de escritorio (Windows): abre la app web local en una ventana nativa, sin servidor ni internet.
const { app, BrowserWindow, Menu, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.whenReady().then(() => {
  const root = path.join(__dirname, 'app');
  // Protocolo app:// para que los módulos ES y el importmap funcionen igual que en un servidor
  protocol.handle('app', req => { const u = new URL(req.url); let p = decodeURIComponent(u.pathname); if (p === '/' || !p) p = '/index.html'; const f = path.normalize(path.join(root, p)); if (!f.startsWith(root)) return new Response('no', { status: 403 }); return net.fetch(pathToFileURL(f).toString()); });
  Menu.setApplicationMenu(null);
  const w = new BrowserWindow({ width: 1440, height: 900, minWidth: 900, minHeight: 600, backgroundColor: '#0f1318', title: 'Academia de Inspección', autoHideMenuBar: true, webPreferences: { contextIsolation: true, sandbox: true } });
  w.webContents.on('before-input-event', (e, i) => { if (i.key === 'F11' && i.type === 'keyDown') w.setFullScreen(!w.isFullScreen()); });
  w.loadURL('app://local/index.html#inicio');
});
app.on('window-all-closed', () => app.quit());
