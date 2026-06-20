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
  }

  async initialize(): Promise<void> {
    // Auto-run migrations (synchronous for SQLite)
    try {
      migrate(this.db, { migrationsFolder: resolve(process.cwd(), 'drizzle/migrations') });
    } catch (e) {
      console.error('[DB] SQLite migration failed:', e);
      throw e;
    }

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

      this.sqlite.prepare(`CREATE TABLE IF NOT EXISTS resume_analysis_jobs (
        id text PRIMARY KEY,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        resume_id text REFERENCES resumes(id) ON DELETE SET NULL,
        file_name text NOT NULL,
        file_type text NOT NULL,
        file_size integer NOT NULL DEFAULT 0,
        file_data text NOT NULL,
        template text NOT NULL DEFAULT 'touch-pure',
        language text NOT NULL DEFAULT 'zh',
        status text NOT NULL DEFAULT 'queued',
        attempts integer NOT NULL DEFAULT 0,
        max_attempts integer NOT NULL DEFAULT 3,
        progress integer NOT NULL DEFAULT 0,
        position integer NOT NULL DEFAULT 0,
        worker_id text,
        locked_at integer,
        last_heartbeat_at integer,
        next_run_at integer NOT NULL DEFAULT (unixepoch()),
        started_at integer,
        finished_at integer,
        error_code text,
        error_message text,
        logs text NOT NULL DEFAULT '[]',
        metadata text DEFAULT '{}',
        created_at integer NOT NULL DEFAULT (unixepoch()),
        updated_at integer NOT NULL DEFAULT (unixepoch())
      )`).run();
      this.sqlite.prepare('CREATE INDEX IF NOT EXISTS resume_analysis_jobs_user_status_idx ON resume_analysis_jobs(user_id, status)').run();
      this.sqlite.prepare('CREATE INDEX IF NOT EXISTS resume_analysis_jobs_status_next_run_idx ON resume_analysis_jobs(status, next_run_at)').run();
      this.sqlite.prepare('CREATE INDEX IF NOT EXISTS resume_analysis_jobs_worker_idx ON resume_analysis_jobs(worker_id)').run();

      this.sqlite.prepare(`CREATE TABLE IF NOT EXISTS admin_audit_logs (
        id text PRIMARY KEY,
        admin_user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_user_id text REFERENCES users(id) ON DELETE SET NULL,
        action text NOT NULL,
        target_type text NOT NULL DEFAULT 'user',
        before text DEFAULT '{}',
        after text DEFAULT '{}',
        reason text NOT NULL DEFAULT '',
        ip_address text,
        user_agent text,
        created_at integer NOT NULL DEFAULT (unixepoch())
      )`).run();
      this.sqlite.prepare('CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_created_idx ON admin_audit_logs(admin_user_id, created_at)').run();
      this.sqlite.prepare('CREATE INDEX IF NOT EXISTS admin_audit_logs_target_created_idx ON admin_audit_logs(target_user_id, created_at)').run();

      const grammarColumns = this.sqlite.prepare('PRAGMA table_info(grammar_checks)').all() as Array<{ name?: string }>;
      if (grammarColumns.length > 0 && !grammarColumns.some((column) => column.name === 'status')) {
        this.sqlite.prepare("ALTER TABLE grammar_checks ADD COLUMN status text NOT NULL DEFAULT 'success'").run();
      }
      if (grammarColumns.length > 0 && !grammarColumns.some((column) => column.name === 'error')) {
        this.sqlite.prepare('ALTER TABLE grammar_checks ADD COLUMN error text').run();
      }

      this.sqlite.prepare(`CREATE TABLE IF NOT EXISTS interview_question_favorites (
        id text PRIMARY KEY,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bank_id text NOT NULL REFERENCES interview_question_banks(id) ON DELETE CASCADE,
        question_id text NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
        source text NOT NULL DEFAULT 'manual',
        metadata text DEFAULT '{}',
        created_at integer NOT NULL DEFAULT (unixepoch())
      )`).run();
      this.sqlite.prepare(`CREATE TABLE IF NOT EXISTS interview_question_practice_attempts (
        id text PRIMARY KEY,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bank_id text NOT NULL REFERENCES interview_question_banks(id) ON DELETE CASCADE,
        question_id text NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
        answer text NOT NULL DEFAULT '',
        score integer NOT NULL DEFAULT 0,
        max_score integer NOT NULL DEFAULT 100,
        is_correct integer NOT NULL DEFAULT 0,
        feedback text NOT NULL DEFAULT '',
        rubric_result text DEFAULT '{}',
        metadata text DEFAULT '{}',
        created_at integer NOT NULL DEFAULT (unixepoch())
      )`).run();
      this.sqlite.prepare(`CREATE TABLE IF NOT EXISTS interview_question_stats (
        id text PRIMARY KEY,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bank_id text NOT NULL REFERENCES interview_question_banks(id) ON DELETE CASCADE,
        question_id text NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
        attempt_count integer NOT NULL DEFAULT 0,
        correct_count integer NOT NULL DEFAULT 0,
        wrong_count integer NOT NULL DEFAULT 0,
        best_score integer NOT NULL DEFAULT 0,
        last_score integer NOT NULL DEFAULT 0,
        mastered integer NOT NULL DEFAULT 0,
        last_attempt_at integer,
        created_at integer NOT NULL DEFAULT (unixepoch()),
        updated_at integer NOT NULL DEFAULT (unixepoch())
      )`).run();

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
      throw e;
    }
  }

  async close(): Promise<void> {
    this.sqlite.close();
  }
}
