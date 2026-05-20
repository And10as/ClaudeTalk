import { app, BrowserWindow, globalShortcut, ipcMain, Menu, Tray, nativeImage } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { VoiceMcpHost } from './mcp-host.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const mcpHost = new VoiceMcpHost();

const isDev = !app.isPackaged;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 480,
    height: 720,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#FAF9F5',
    titleBarStyle: 'hiddenInset',
    vibrancy: 'sidebar',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  win.on('ready-to-show', () => win.show());
  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

function toggleWindow(): void {
  if (mainWindow === null) {
    mainWindow = createWindow();
    return;
  }
  if (mainWindow.isVisible()) mainWindow.hide();
  else mainWindow.show();
}

function setupTray(): void {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setTitle('🎙');
  tray.setToolTip('ClaudeTalk');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Open ClaudeTalk', click: toggleWindow },
      { type: 'separator' },
      { label: 'Quit', role: 'quit' },
    ]),
  );
  tray.on('click', toggleWindow);
}

function setupIpc(): void {
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:platform', () => process.platform);

  ipcMain.handle('mcp:listProviders', async () => mcpHost.listProviders());
  ipcMain.handle('mcp:setProvider', async (_evt, kind: 'stt' | 'tts', id: string) =>
    mcpHost.setProvider(kind, id),
  );
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin') app.dock?.hide();
  setupTray();
  setupIpc();

  try {
    await mcpHost.connect();
  } catch (err) {
    process.stderr.write(`[claudetalk] MCP host failed to connect: ${(err as Error).message}\n`);
  }

  mainWindow = createWindow();

  const ok = globalShortcut.register('CommandOrControl+Shift+Space', toggleWindow);
  if (!ok) process.stderr.write('[claudetalk] failed to register global hotkey\n');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  void mcpHost.close();
});
