import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';

async function sha256(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

const input = process.argv[2];
if (!input) throw new Error('Usage: pnpm db:backup:verify <backup-file>');

const backupPath = resolve(input);
const checksumPath = `${backupPath}.sha256`;
if (!existsSync(backupPath)) throw new Error(`Backup not found: ${backupPath}`);
if (!existsSync(checksumPath)) throw new Error(`Checksum not found: ${checksumPath}`);

const expected = readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
const actual = await sha256(backupPath);
if (expected !== actual) throw new Error('Backup checksum mismatch');

if (extname(backupPath) === '.sqlite') {
  const database = new Database(backupPath, { readonly: true, fileMustExist: true });
  try {
    const result = database.pragma('integrity_check', { simple: true });
    if (result !== 'ok') throw new Error(`SQLite integrity check failed: ${result}`);
  } finally {
    database.close();
  }
} else if (extname(backupPath) === '.dump') {
  const result = spawnSync('pg_restore', ['--list', backupPath], { stdio: 'ignore' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pg_restore verification failed with status ${result.status}`);
} else {
  throw new Error(`Unsupported backup extension: ${extname(backupPath)}`);
}

console.log(`[backup] verified ${backupPath}`);
