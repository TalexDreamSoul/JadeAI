import { config } from '@/lib/config';
import { SQLiteAdapter } from './adapters/sqlite';
import { PostgreSQLAdapter } from './adapters/postgresql';
import type { DatabaseAdapter } from './adapter';

const skipDbInit = process.env.SKIP_DB_INIT === '1'
  || process.env.NEXT_PHASE === 'phase-production-build';

function createUnavailableDb() {
  return new Proxy({}, {
    get() {
      throw new Error('Database is unavailable while SKIP_DB_INIT=1');
    },
  });
}

let adapter: DatabaseAdapter;

if (skipDbInit) {
  adapter = {
    db: createUnavailableDb(),
    initialize: async () => undefined,
    close: async () => undefined,
  };
} else if (config.db.type === 'postgresql') {
  adapter = new PostgreSQLAdapter(process.env.DATABASE_URL!);
} else {
  if (process.env.VERCEL) {
    throw new Error(
      'SQLite is not supported on Vercel (read-only filesystem). ' +
      'Please set DB_TYPE=postgresql and DATABASE_URL in your Vercel environment variables.',
    );
  }
  adapter = new SQLiteAdapter(process.env.SQLITE_PATH || './data/touchresume.db');
}

// Initialize (migrate + seed) — must complete before first query.
// Store the promise so consumers can await it if needed.
const _initPromise = adapter.initialize().catch((e) => {
  console.error('[DB] Initialize failed:', e);
  throw e;
});

/** Await this before any DB operation to ensure tables exist */
export const dbReady = _initPromise;

export const db = adapter.db;
export { adapter };
