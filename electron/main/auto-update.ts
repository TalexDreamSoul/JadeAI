import { app, BrowserWindow, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';

let initialized = false;
let manualCheck = false;

function activeWindow(): BrowserWindow | undefined {
  return BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
}

async function showMessage(options: Electron.MessageBoxOptions): Promise<Electron.MessageBoxReturnValue> {
  const window = activeWindow();
  if (window) return dialog.showMessageBox(window, options);
  return dialog.showMessageBox(options);
}

export function initializeAutoUpdates(): void {
  if (initialized || !app.isPackaged || process.env.JADE_DISABLE_AUTO_UPDATE === '1') return;
  initialized = true;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('update-downloaded', async ({ version }) => {
    manualCheck = false;
    const result = await showMessage({
      type: 'info',
      title: 'JadeAI 更新已就绪',
      message: `JadeAI ${version} 已下载完成。`,
      detail: '现在重启即可完成更新，也可以稍后退出应用时自动安装。',
      buttons: ['立即重启', '稍后'],
      defaultId: 0,
      cancelId: 1,
    });
    if (result.response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on('update-not-available', () => {
    if (!manualCheck) return;
    manualCheck = false;
    void showMessage({
      type: 'info',
      title: 'JadeAI 更新',
      message: '当前已经是最新版本。',
      buttons: ['知道了'],
    });
  });

  autoUpdater.on('error', (error) => {
    console.warn('[desktop:update] Update check failed:', error.message);
    if (!manualCheck) return;
    manualCheck = false;
    void showMessage({
      type: 'warning',
      title: '暂时无法检查更新',
      message: '请稍后重试。',
      detail: error.message,
      buttons: ['知道了'],
    });
  });

  setTimeout(() => {
    void autoUpdater.checkForUpdates().catch((error) => {
      console.warn('[desktop:update] Automatic update check failed:', error instanceof Error ? error.message : String(error));
    });
  }, 10_000);
}

export async function checkForUpdates(): Promise<void> {
  if (!app.isPackaged) {
    await showMessage({
      type: 'info',
      title: 'JadeAI 更新',
      message: '开发版本不检查自动更新。',
      buttons: ['知道了'],
    });
    return;
  }
  initializeAutoUpdates();
  manualCheck = true;
  await autoUpdater.checkForUpdates().catch((error) => {
    manualCheck = false;
    console.warn('[desktop:update] Manual update check failed:', error instanceof Error ? error.message : String(error));
  });
}
