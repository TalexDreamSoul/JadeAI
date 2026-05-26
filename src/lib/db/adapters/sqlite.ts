import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '../schema';
import type { DatabaseAdapter } from '../adapter';
import { mkdirSync } from 'fs';
import { dirname, resolve } from 'path';

export class SQLiteAdapter implements DatabaseAdapter {
  db;
  private sqlite: Database.Database;

  constructor(path: string) {
    mkdirSync(dirname(path), { recursive: true });
    this.sqlite = new Database(path);
    this.sqlite.pragma('journal_mode = WAL');
    this.sqlite.pragma('foreign_keys = ON');
    this.db = drizzle(this.sqlite, { schema });

    // Auto-run migrations (synchronous for SQLite)
    try {
      migrate(this.db, { migrationsFolder: resolve(process.cwd(), 'drizzle/migrations') });
    } catch (e) {
      console.error('[DB] SQLite migration failed:', e);
    }
  }

  async initialize(): Promise<void> {
    try {
      const columns = this.sqlite.prepare('PRAGMA table_info(users)').all() as Array<{ name?: string }>;
      if (columns.length > 0 && !columns.some((column) => column.name === 'ai_credits')) {
        this.sqlite.prepare('ALTER TABLE users ADD COLUMN ai_credits integer NOT NULL DEFAULT 20').run();
      }

      const jdAnalysisColumns = this.sqlite.prepare('PRAGMA table_info(jd_analyses)').all() as Array<{ name?: string }>;
      const ensureJdAnalysisColumn = (name: string, ddl: string) => {
        if (jdAnalysisColumns.length > 0 && !jdAnalysisColumns.some((column) => column.name === name)) {
          this.sqlite.prepare(ddl).run();
        }
      };
      ensureJdAnalysisColumn('status', "ALTER TABLE jd_analyses ADD COLUMN status text NOT NULL DEFAULT 'success'");
      ensureJdAnalysisColumn('error', 'ALTER TABLE jd_analyses ADD COLUMN error text');
      ensureJdAnalysisColumn('resume_version_id', 'ALTER TABLE jd_analyses ADD COLUMN resume_version_id text');
      ensureJdAnalysisColumn('resume_version_label', 'ALTER TABLE jd_analyses ADD COLUMN resume_version_label text');
      ensureJdAnalysisColumn('resume_title_snapshot', 'ALTER TABLE jd_analyses ADD COLUMN resume_title_snapshot text');
      ensureJdAnalysisColumn('target_company_snapshot', 'ALTER TABLE jd_analyses ADD COLUMN target_company_snapshot text');
      ensureJdAnalysisColumn('target_job_title_snapshot', 'ALTER TABLE jd_analyses ADD COLUMN target_job_title_snapshot text');
      ensureJdAnalysisColumn('jd_hash', 'ALTER TABLE jd_analyses ADD COLUMN jd_hash text');
      ensureJdAnalysisColumn('analysis_group_id', 'ALTER TABLE jd_analyses ADD COLUMN analysis_group_id text');

      this.sqlite.prepare(`CREATE TABLE IF NOT EXISTS resume_change_proposals (
        id text PRIMARY KEY,
        resume_id text NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
        user_id text REFERENCES users(id),
        source text NOT NULL DEFAULT 'ai',
        source_id text,
        share_id text,
        comment_id text,
        section_id text,
        section_type text NOT NULL,
        target_field text NOT NULL DEFAULT 'text',
        current text NOT NULL DEFAULT '',
        suggested text NOT NULL DEFAULT '',
        reason text NOT NULL DEFAULT '',
        evidence_required integer NOT NULL DEFAULT 0,
        status text NOT NULL DEFAULT 'pending',
        metadata text DEFAULT '{}',
        before_version_id text,
        applied_version_id text,
        undo_content text,
        created_at integer NOT NULL DEFAULT (unixepoch()),
        updated_at integer NOT NULL DEFAULT (unixepoch())
      )`).run();

      const aiReviewColumns = this.sqlite.prepare('PRAGMA table_info(resume_ai_reviews)').all() as Array<{ name?: string }>;
      if (aiReviewColumns.length > 0 && !aiReviewColumns.some((column) => column.name === 'status')) {
        this.sqlite.prepare("ALTER TABLE resume_ai_reviews ADD COLUMN status text NOT NULL DEFAULT 'success'").run();
      }
      if (aiReviewColumns.length > 0 && !aiReviewColumns.some((column) => column.name === 'error')) {
        this.sqlite.prepare('ALTER TABLE resume_ai_reviews ADD COLUMN error text').run();
      }

      const grammarColumns = this.sqlite.prepare('PRAGMA table_info(grammar_checks)').all() as Array<{ name?: string }>;
      if (grammarColumns.length > 0 && !grammarColumns.some((column) => column.name === 'status')) {
        this.sqlite.prepare("ALTER TABLE grammar_checks ADD COLUMN status text NOT NULL DEFAULT 'success'").run();
      }
      if (grammarColumns.length > 0 && !grammarColumns.some((column) => column.name === 'error')) {
        this.sqlite.prepare('ALTER TABLE grammar_checks ADD COLUMN error text').run();
      }

      const row = this.sqlite.prepare('SELECT count(*) as count FROM users').get() as { count?: number } | undefined;
      if (row?.count === 0) {
        const { seedDemoUser } = await import('../seed-demo');
        await seedDemoUser(this.db);
        console.log('[DB] SQLite auto-seed complete');
      }
      const { ensureAdminUser } = await import('../seed-admin');
      await ensureAdminUser(this.db);
    } catch (e) {
      console.error('[DB] SQLite auto-seed failed:', e);
    }
  }

  async close(): Promise<void> {
    this.sqlite.close();
  }
}
