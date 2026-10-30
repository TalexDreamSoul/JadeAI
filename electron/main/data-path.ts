import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { app } from 'electron';

export function initializeDataPath(): string {
  const base = app.getPath('userData');
  const directory = app.isPackaged ? base : `${base}-dev`;
  app.setPath('userData', directory);
  mkdirSync(directory, { recursive: true });
  return directory;
}

export function databaseFile(dataDirectory: string): string {
  return join(dataDirectory, 'jade.db');
}
