import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import type { DatabaseAdapter } from '../adapter';
import { resolve } from 'path';

export class PostgreSQLAdapter implements DatabaseAdapter {
  db;
  private client: ReturnType<typeof postgres>;

  constructor(connectionString: string) {
    this.client = postgres(connectionString);
    this.db = drizzle(this.client);
  }

  async initialize(): Promise<void> {
    // Auto-run migrations (PG-native migration files)
    try {
      await migrate(this.db, {
        migrationsFolder: resolve(process.cwd(), 'drizzle/pg-migrations'),
      });

      // Sanity check: if migration tracking says "done" but tables are missing
      // (e.g. after a manual DROP SCHEMA), reset tracking and re-run
      const check = await this.db.execute(
        sql`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') AS ok`
      );
      const checkRows = check as Array<{ ok?: boolean }>;
      if (!checkRows[0]?.ok) {
        console.warn('[DB] Migration tracking is stale — resetting and re-running');
        await this.db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`);
        await migrate(this.db, {
          migrationsFolder: resolve(process.cwd(), 'drizzle/pg-migrations'),
        });
      }

      await this.db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_credits integer NOT NULL DEFAULT 20`);
      await this.db.execute(sql`ALTER TABLE jd_analyses ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success'`);
      await this.db.execute(sql`ALTER TABLE jd_analyses ADD COLUMN IF NOT EXISTS error text`);
      await this.db.execute(sql`ALTER TABLE resume_ai_reviews ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success'`);
      await this.db.execute(sql`ALTER TABLE resume_ai_reviews ADD COLUMN IF NOT EXISTS error text`);
      await this.db.execute(sql`ALTER TABLE grammar_checks ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success'`);
      await this.db.execute(sql`ALTER TABLE grammar_checks ADD COLUMN IF NOT EXISTS error text`);

      console.log('[DB] PostgreSQL migrations applied');
    } catch (e) {
      console.error('[DB] PostgreSQL migration failed:', e);
    }

    // Auto-seed if empty
    try {
      const result = await this.db.execute(sql`SELECT count(*)::int as count FROM users`);
      const rows = result as Array<{ count?: number | string }>;
      const count = Number(rows[0]?.count ?? 0);
      if (count === 0) {
        const { seedDemoUser } = await import('../seed-demo');
        await seedDemoUser(this.db);
        console.log('[DB] PostgreSQL auto-seed complete');
      }
      const { ensureAdminUser } = await import('../seed-admin');
      await ensureAdminUser(this.db);
    } catch (e) {
      console.error('[DB] PostgreSQL auto-seed failed:', e);
    }
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
