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
      await this.db.execute(sql`ALTER TABLE jd_analyses ADD COLUMN IF NOT EXISTS resume_version_id text`);
      await this.db.execute(sql`ALTER TABLE jd_analyses ADD COLUMN IF NOT EXISTS resume_version_label text`);
      await this.db.execute(sql`ALTER TABLE jd_analyses ADD COLUMN IF NOT EXISTS resume_title_snapshot text`);
      await this.db.execute(sql`ALTER TABLE jd_analyses ADD COLUMN IF NOT EXISTS target_company_snapshot text`);
      await this.db.execute(sql`ALTER TABLE jd_analyses ADD COLUMN IF NOT EXISTS target_job_title_snapshot text`);
      await this.db.execute(sql`ALTER TABLE jd_analyses ADD COLUMN IF NOT EXISTS jd_hash text`);
      await this.db.execute(sql`ALTER TABLE jd_analyses ADD COLUMN IF NOT EXISTS analysis_group_id text`);
      await this.db.execute(sql`CREATE TABLE IF NOT EXISTS resume_change_proposals (
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
        created_at integer NOT NULL DEFAULT extract(epoch from now())::integer,
        updated_at integer NOT NULL DEFAULT extract(epoch from now())::integer
      )`);
      await this.db.execute(sql`ALTER TABLE resume_ai_reviews ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success'`);
      await this.db.execute(sql`ALTER TABLE resume_ai_reviews ADD COLUMN IF NOT EXISTS error text`);
      await this.db.execute(sql`CREATE TABLE IF NOT EXISTS resume_analysis_jobs (
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
        next_run_at integer NOT NULL DEFAULT extract(epoch from now())::integer,
        started_at integer,
        finished_at integer,
        error_code text,
        error_message text,
        logs text NOT NULL DEFAULT '[]',
        metadata text DEFAULT '{}',
        created_at integer NOT NULL DEFAULT extract(epoch from now())::integer,
        updated_at integer NOT NULL DEFAULT extract(epoch from now())::integer
      )`);
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS resume_analysis_jobs_user_status_idx ON resume_analysis_jobs(user_id, status)`);
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS resume_analysis_jobs_status_next_run_idx ON resume_analysis_jobs(status, next_run_at)`);
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS resume_analysis_jobs_worker_idx ON resume_analysis_jobs(worker_id)`);
      await this.db.execute(sql`CREATE TABLE IF NOT EXISTS admin_audit_logs (
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
        created_at integer NOT NULL DEFAULT extract(epoch from now())::integer
      )`);
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS admin_audit_logs_admin_created_idx ON admin_audit_logs(admin_user_id, created_at)`);
      await this.db.execute(sql`CREATE INDEX IF NOT EXISTS admin_audit_logs_target_created_idx ON admin_audit_logs(target_user_id, created_at)`);
      await this.db.execute(sql`ALTER TABLE grammar_checks ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'success'`);
      await this.db.execute(sql`ALTER TABLE grammar_checks ADD COLUMN IF NOT EXISTS error text`);
      await this.db.execute(sql`CREATE TABLE IF NOT EXISTS interview_question_favorites (
        id text PRIMARY KEY,
        user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        bank_id text NOT NULL REFERENCES interview_question_banks(id) ON DELETE CASCADE,
        question_id text NOT NULL REFERENCES interview_questions(id) ON DELETE CASCADE,
        source text NOT NULL DEFAULT 'manual',
        metadata text DEFAULT '{}',
        created_at integer NOT NULL DEFAULT extract(epoch from now())::integer
      )`);
      await this.db.execute(sql`CREATE TABLE IF NOT EXISTS interview_question_practice_attempts (
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
        created_at integer NOT NULL DEFAULT extract(epoch from now())::integer
      )`);
      await this.db.execute(sql`CREATE TABLE IF NOT EXISTS interview_question_stats (
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
        created_at integer NOT NULL DEFAULT extract(epoch from now())::integer,
        updated_at integer NOT NULL DEFAULT extract(epoch from now())::integer
      )`);

      console.log('[DB] PostgreSQL migrations applied');
    } catch (e) {
      console.error('[DB] PostgreSQL migration failed:', e);
      throw e;
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
      throw e;
    }
  }

  async close(): Promise<void> {
    await this.client.end();
  }
}
