import { app } from 'electron';
import { join } from 'node:path';

export function appRoot(): string {
  return app.isPackaged ? app.getAppPath() : process.cwd();
}

export function resourceFile(...segments: string[]): string {
  return app.isPackaged
    ? join(process.resourcesPath, ...segments)
    : join(appRoot(), 'resources', ...segments);
}

export function migrationsDirectory(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'drizzle', 'migrations')
    : join(appRoot(), 'drizzle', 'migrations');
}
