import { app, BrowserWindow, ipcMain, Menu, session, shell } from 'electron';
import { join } from 'node:path';
import { initializeDataPath, databaseFile } from './data-path';
import { migrationsDirectory, resourceFile } from './app-paths';
import { NextServerHost } from './next-server-host';
import { checkForUpdates, initializeAutoUpdates } from './auto-update';
import { resolveDesktopRuntime, type DesktopRuntime } from './runtime-config';
import {
  isSafeCheckoutNavigation,
  isSafeExternalNavigation,
  isTrustedInAppNavigation,
} from './runtime-policy';

app.setName('JadeAI');

const server = new NextServerHost();
let mainWindow: BrowserWindow | null = null;
let checkoutWindow: BrowserWindow | null = null;
let dataDirectory = '';
let trustedOrigin: string | null = null;
let booting = false;
let desktopRuntime: DesktopRuntime | null = null;

function openExternal(value: string): void {
  if (isSafeExternalNavigation(value)) void shell.openExternal(value);
}

async function openCheckout(value: string): Promise<void> {
  if (!mainWindow || mainWindow.isDestroyed()) throw new Error('JadeAI main window is unavailable');
  if (!isSafeCheckoutNavigation(value, app.isPackaged)) throw new Error('Checkout URL is not allowed');

  if (checkoutWindow && !checkoutWindow.isDestroyed()) checkoutWindow.close();
  const window = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    width: 1080,
    height: 780,
    minWidth: 720,
    minHeight: 560,
    show: false,
    title: 'JadeAI 支付',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  checkoutWindow = window;

  const guardNavigation = (event: Electron.Event, url: string) => {
    if (isTrustedInAppNavigation(url, trustedOrigin)) {
      event.preventDefault();
      window.close();
      if (mainWindow && !mainWindow.isDestroyed()) {
        void mainWindow.loadURL(url);
      }
      return;
    }
    if (isSafeCheckoutNavigation(url, app.isPackaged)) return;
    event.preventDefault();
    openExternal(url);
  };

  window.once('ready-to-show', () => window.show());
  window.on('closed', () => {
    if (checkoutWindow === window) checkoutWindow = null;
  });
  window.webContents.on('will-navigate', guardNavigation);
  window.webContents.on('will-redirect', guardNavigation);
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeCheckoutNavigation(url, app.isPackaged)) void window.loadURL(url);
    else openExternal(url);
    return { action: 'deny' };
  });
  await window.loadURL(value);
}

function installApplicationMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    ...(process.platform === 'darwin' ? [{
      label: 'JadeAI',
      submenu: [
        { role: 'about' as const },
        { label: '检查更新...', click: () => void checkForUpdates() },
        { type: 'separator' as const },
        { role: 'hide' as const },
        { role: 'hideOthers' as const },
        { role: 'unhide' as const },
        { type: 'separator' as const },
        { role: 'quit' as const },
      ],
    }] : []),
    { label: '编辑', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: '显示', submenu: [{ role: 'reload' }, { role: 'toggleDevTools', visible: !app.isPackaged }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: '窗口', submenu: [{ role: 'minimize' }, { role: 'close' }] },
    ...((process.platform === 'darwin') ? [] : [{ label: '帮助', submenu: [{ label: '检查更新...', click: () => void checkForUpdates() }] }]),
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 940,
    minHeight: 600,
    show: false,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });
  window.once('ready-to-show', () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isTrustedInAppNavigation(url, trustedOrigin)) void window.loadURL(url);
    else openExternal(url);
    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event, url) => {
    if (isTrustedInAppNavigation(url, trustedOrigin)) return;
    event.preventDefault();
    openExternal(url);
  });
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  return window;
}

async function boot(window: BrowserWindow): Promise<void> {
  if (booting) return;
  booting = true;
  await window.loadFile(resourceFile('splash.html'));
  try {
    const runtime = desktopRuntime || resolveDesktopRuntime();
    let startUrl = runtime.startUrl;
    trustedOrigin = runtime.trustedOrigin || null;

    if (runtime.mode === 'local') {
      dataDirectory ||= initializeDataPath();
      const origin = await server.start({
        database: databaseFile(dataDirectory),
        migrations: migrationsDirectory(),
        production: app.isPackaged,
      });
      trustedOrigin = new URL(origin).origin;
      startUrl = `${origin}/zh`;
    } else {
      server.stop();
    }

    if (!startUrl) throw new Error('Desktop start URL is unavailable');
    await window.loadURL(startUrl);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error('[desktop:startup] Failed to start:', detail);
    await window.loadFile(resourceFile('startup-error.html'), {
      search: new URLSearchParams({ detail, local: dataDirectory ? '1' : '0' }).toString(),
    });
  } finally {
    booting = false;
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

app.on('second-instance', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(async () => {
  app.setAppUserModelId('com.jadeai.desktop');
  installApplicationMenu();
  desktopRuntime = resolveDesktopRuntime();
  if (desktopRuntime.mode === 'local') {
    dataDirectory = initializeDataPath();
  }
  const allowedPermissions = new Set(['clipboard-sanitized-write', 'media', 'notifications']);
  session.defaultSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin) => (
    isTrustedInAppNavigation(requestingOrigin, trustedOrigin) && allowedPermissions.has(permission)
  ));
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(Boolean(webContents && isTrustedInAppNavigation(webContents.getURL(), trustedOrigin) && allowedPermissions.has(permission)));
  });
  ipcMain.handle('jade:shell:open-data-dir', async () => {
    if (dataDirectory) await shell.openPath(dataDirectory);
  });
  ipcMain.handle('jade:checkout:open', async (event, value: unknown) => {
    const senderUrl = event.senderFrame?.url || event.sender.getURL();
    if (!isTrustedInAppNavigation(senderUrl, trustedOrigin)) throw new Error('Checkout request is not trusted');
    if (typeof value !== 'string') throw new Error('Checkout URL is required');
    await openCheckout(value);
  });
  ipcMain.on('jade:startup:retry', () => {
    if (mainWindow && !mainWindow.isDestroyed()) void boot(mainWindow);
  });
  mainWindow = createWindow();
  mainWindow.on('closed', () => { mainWindow = null; });
  await boot(mainWindow);
  initializeAutoUpdates();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length > 0) return;
  mainWindow = createWindow();
  void boot(mainWindow);
});
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('will-quit', () => server.stop());
