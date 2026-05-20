import { app, BrowserWindow, globalShortcut, ipcMain, Menu, screen, Tray, nativeImage } from 'electron';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Pin the user-data folder to "ClaudeTalk" so dev (productName=Electron) and
// production both read/write the same models/secrets/logs as the standalone
// voice-mcp-server child process. Must run before app.whenReady().
app.setName('ClaudeTalk');
app.setPath('userData', join(app.getPath('appData'), 'ClaudeTalk'));

import { VoiceMcpHost } from './mcp-host.js';
import { getSecretStatus, loadAllToEnv, setSecret, type SecretKey } from './secrets.js';
import { modelsDir, startDownload, type DownloadKind } from './downloads.js';
import { loadSettings, saveSettings } from './settings.js';
import { ConversationSession } from './session.js';
import { EventLogTail } from './log-tail.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
const mcpHost = new VoiceMcpHost();
const session = new ConversationSession();
const logTail = new EventLogTail();

const isDev = !app.isPackaged;

const WIN_WIDTH = 420;
const WIN_HEIGHT = 640;
const WIN_TRAY_GAP = 4;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: WIN_WIDTH,
    height: WIN_HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    transparent: false,
    backgroundColor: '#FAF9F5',
    alwaysOnTop: true,
    hasShadow: true,
    vibrancy: 'sidebar',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.setAlwaysOnTop(true, 'floating');
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  win.on('blur', () => {
    if (win.webContents.isDevToolsOpened()) return;
    win.hide();
  });

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

function positionWindowUnderTray(win: BrowserWindow): void {
  if (tray === null) return;
  const trayBounds = tray.getBounds();
  const display = screen.getDisplayMatching(trayBounds);
  const winBounds = win.getBounds();

  const trayCenterX = Math.round(trayBounds.x + trayBounds.width / 2);
  let x = Math.round(trayCenterX - winBounds.width / 2);
  let y = Math.round(trayBounds.y + trayBounds.height + WIN_TRAY_GAP);

  const margin = 8;
  if (x + winBounds.width > display.workArea.x + display.workArea.width - margin) {
    x = display.workArea.x + display.workArea.width - winBounds.width - margin;
  }
  if (x < display.workArea.x + margin) x = display.workArea.x + margin;
  if (y + winBounds.height > display.workArea.y + display.workArea.height - margin) {
    y = display.workArea.y + display.workArea.height - winBounds.height - margin;
  }

  win.setPosition(x, y, false);
}

function showWindow(): void {
  if (mainWindow === null) mainWindow = createWindow();
  positionWindowUnderTray(mainWindow);
  mainWindow.show();
  mainWindow.focus();
}

function toggleWindow(): void {
  if (mainWindow === null) {
    showWindow();
    return;
  }
  if (mainWindow.isVisible()) mainWindow.hide();
  else showWindow();
}

function setupTray(): void {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  tray.setTitle('🎙');
  tray.setToolTip('ClaudeTalk');
  tray.on('click', toggleWindow);
  tray.on('right-click', () => {
    tray?.popUpContextMenu(
      Menu.buildFromTemplate([
        { label: 'Open ClaudeTalk', click: toggleWindow },
        { type: 'separator' },
        { label: 'Quit', role: 'quit' },
      ]),
    );
  });
}

function setupIpc(): void {
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:platform', () => process.platform);

  ipcMain.handle('mcp:listProviders', async () => mcpHost.listProviders());
  ipcMain.handle('mcp:setProvider', async (_evt, kind: 'stt' | 'tts', id: string) => {
    const result = await mcpHost.setProvider(kind, id);
    await saveSettings(kind === 'stt' ? { sttProviderId: id } : { ttsProviderId: id });
    session.applyProviderSelection(kind, id);
    return result;
  });
  ipcMain.handle('settings:get', async () => loadSettings());

  ipcMain.handle('secrets:status', async () => getSecretStatus());
  ipcMain.handle('secrets:set', async (_evt, key: SecretKey, value: string) => {
    await setSecret(key, value);
    await loadAllToEnv();
    await mcpHost.restart();
  });

  ipcMain.handle('voice:start', async (evt) => {
    session.attachRenderer(evt.sender);
    await session.start();
  });
  ipcMain.handle('voice:endTurn', async (_evt, audio: ArrayBuffer, sampleRate: number) =>
    session.endTurn(audio, sampleRate),
  );
  ipcMain.handle('voice:stop', async () => session.stop());
  ipcMain.handle('voice:bargeIn', async () => session.bargeIn());
  ipcMain.handle('voice:reset', () => session.reset());

  ipcMain.handle(
    'models:download',
    async (evt, kind: DownloadKind, providerId: string) => {
      await startDownload(kind, providerId, (progress) => {
        evt.sender.send('models:progress', { providerId, ...progress });
      });
    },
  );

  ipcMain.handle('log:start', async (evt) => {
    await logTail.start(evt.sender);
  });
}

app.whenReady().then(async () => {
  if (process.platform === 'darwin') app.dock?.hide();
  setupTray();
  setupIpc();

  await loadAllToEnv();
  const persisted = await loadSettings();
  if (persisted.sttProviderId !== undefined) {
    session.applyProviderSelection('stt', persisted.sttProviderId);
  }
  if (persisted.ttsProviderId !== undefined) {
    session.applyProviderSelection('tts', persisted.ttsProviderId);
  }

  try {
    await mcpHost.connect();
    if (persisted.sttProviderId !== undefined) {
      try { await mcpHost.setProvider('stt', persisted.sttProviderId); } catch { /* ignore */ }
    }
    if (persisted.ttsProviderId !== undefined) {
      try { await mcpHost.setProvider('tts', persisted.ttsProviderId); } catch { /* ignore */ }
    }
  } catch (err) {
    process.stderr.write(`[claudetalk] MCP host failed to connect: ${(err as Error).message}\n`);
  }

  mainWindow = createWindow();

  const ok = globalShortcut.register('CommandOrControl+Shift+Space', toggleWindow);
  if (!ok) process.stderr.write('[claudetalk] failed to register global hotkey\n');
});

app.on('window-all-closed', () => {
  // Keep the app alive as a menubar app — only quit via tray menu.
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  void mcpHost.close();
});
