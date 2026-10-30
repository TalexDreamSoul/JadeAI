import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';
import { buildDesktopStartUrl, normalizeRemoteUrl, resolveDesktopMode, type DesktopMode } from './runtime-policy';

interface BundledDesktopConfig {
  mode?: DesktopMode;
  remoteUrl?: string;
  startPath?: string;
}

export interface DesktopRuntime {
  mode: DesktopMode;
  startUrl?: string;
  trustedOrigin?: string;
}

function readBundledConfig(): BundledDesktopConfig {
  const path = app.isPackaged
    ? join(process.resourcesPath, 'desktop-runtime.json')
    : join(process.cwd(), 'config', 'desktop-runtime.json');
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as BundledDesktopConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to read desktop runtime configuration: ${message}`);
  }
}

export function resolveDesktopRuntime(): DesktopRuntime {
  const explicitMode = process.env.JADE_DESKTOP_MODE;
  if (!explicitMode && !app.isPackaged) return { mode: 'local' };

  const bundled = readBundledConfig();
  const mode = resolveDesktopMode(explicitMode || bundled.mode, app.isPackaged);
  if (mode === 'local') return { mode };

  const baseUrl = normalizeRemoteUrl(process.env.JADE_DESKTOP_URL || bundled.remoteUrl, app.isPackaged);
  const startUrl = buildDesktopStartUrl(baseUrl, process.env.JADE_DESKTOP_START_PATH || bundled.startPath);
  return { mode, startUrl, trustedOrigin: new URL(startUrl).origin };
}
