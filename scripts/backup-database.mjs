import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import Database from 'better-sqlite3';

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function sha256(filePath) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

const backupDir = resolve(process.env.BACKUP_DIR || './backups');
const dbType = process.env.DB_TYPE || 'sqlite';
mkdirSync(backupDir, { recursive: true, mode: 0o700 });

let backupPath;
if (dbType === 'postgresql') {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required for PostgreSQL backup');
  backupPath = resolve(backupDir, `jadeai-${timestamp()}.dump`);
  const result = spawnSync('pg_dump', ['--format=custom', '--file', backupPath], {
    env: { ...process.env, PGDATABASE: process.env.DATABASE_URL },
    stdio: 'inherit',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`pg_dump failed with status ${result.status}`);
} else if (dbType === 'sqlite') {
  const sourcePath = resolve(process.env.SQLITE_PATH || './data/touchresume.db');
  if (!existsSync(sourcePath)) throw new Error(`SQLite database not found: ${sourcePath}`);
  backupPath = resolve(backupDir, `jadeai-${timestamp()}.sqlite`);
  const database = new Database(sourcePath, { readonly: true, fileMustExist: true });
  try {
    await database.backup(backupPath);
  } finally {
    database.close();
  }
} else {
  throw new Error(`Unsupported DB_TYPE: ${dbType}`);
}

const digest = await sha256(backupPath);
writeFileSync(`${backupPath}.sha256`, `${digest}  ${backupPath.split('/').pop()}\n`, { mode: 0o600 });
console.log(`[backup] created ${backupPath}`);
console.log(`[backup] checksum ${backupPath}.sha256`);
