import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  fingerprint: text('fingerprint').unique(),
  authType: text('auth_type', { enum: ['oauth', 'fingerprint', 'password'] }).notNull(),
  role: text('role', { enum: ['user', 'admin'] }).notNull().default('user'),
  aiCredits: integer('ai_credits').notNull().default(20),
  settings: text('settings', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const authAccounts = sqliteTable('auth_accounts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenType: text('token_type'),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  scope: text('scope'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const resumes = sqliteTable('resumes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  title: text('title').notNull().default('未命名简历'),
  template: text('template').notNull().default('touch-pure'),
  themeConfig: text('theme_config', { mode: 'json' }).default('{}'),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  isBase: integer('is_base', { mode: 'boolean' }).notNull().default(false),
  cloudSyncEnabled: integer('cloud_sync_enabled', { mode: 'boolean' }).notNull().default(true),
  language: text('language').notNull().default('zh'),
  sourceResumeId: text('source_resume_id'),
  baseResumeId: text('base_resume_id'),
  targetCompany: text('target_company'),
  targetJobTitle: text('target_job_title'),
  jobDescription: text('job_description'),
  versionLabel: text('version_label').notNull().default('v1'),
  shareToken: text('share_token'),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  sharePassword: text('share_password'),
  viewCount: integer('view_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const resumeVersions = sqliteTable('resume_versions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  snapshot: text('snapshot', { mode: 'json' }).notNull(),
  source: text('source').notNull().default('manual'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const resumeEvents = sqliteTable('resume_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  type: text('type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const resumeSections = sqliteTable('resume_sections', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  visible: integer('visible', { mode: 'boolean' }).notNull().default(true),
  content: text('content', { mode: 'json' }).notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const chatSessions = sqliteTable('chat_sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  title: text('title').notNull().default('新对话'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id').notNull().references(() => chatSessions.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['user', 'assistant', 'system'] }).notNull(),
  content: text('content').notNull(),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const resumeShares = sqliteTable('resume_shares', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  label: text('label').notNull().default(''),
  password: text('password'),
  reviewEnabled: integer('review_enabled', { mode: 'boolean' }).notNull().default(false),
  downloadEnabled: integer('download_enabled', { mode: 'boolean' }).notNull().default(true),
  viewRequiresLogin: integer('view_requires_login', { mode: 'boolean' }).notNull().default(false),
  anonymousShare: integer('anonymous_share', { mode: 'boolean' }).notNull().default(false),
  hideSensitiveInfo: integer('hide_sensitive_info', { mode: 'boolean' }).notNull().default(false),
  viewCount: integer('view_count').notNull().default(0),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const resumeReviewComments = sqliteTable('resume_review_comments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  shareId: text('share_id').notNull().references(() => resumeShares.id, { onDelete: 'cascade' }),
  resumeId: text('resume_id').notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  parentCommentId: text('parent_comment_id'),
  authorUserId: text('author_user_id').references(() => users.id),
  authorName: text('author_name').notNull().default('Reviewer'),
  authorEmail: text('author_email'),
  sectionId: text('section_id'),
  selectedText: text('selected_text'),
  anchor: text('anchor', { mode: 'json' }),
  content: text('content').notNull(),
  status: text('status').notNull().default('open'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const resumeReviewPresence = sqliteTable('resume_review_presence', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  shareId: text('share_id').notNull().references(() => resumeShares.id, { onDelete: 'cascade' }),
  resumeId: text('resume_id').notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reviewerName: text('reviewer_name').notNull().default('Reviewer'),
  reviewerEmail: text('reviewer_email'),
  reviewerAvatarUrl: text('reviewer_avatar_url'),
  cursorX: integer('cursor_x').notNull().default(0),
  cursorY: integer('cursor_y').notNull().default(0),
  color: text('color').notNull().default('#10b981'),
  lastSeenAt: integer('last_seen_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const resumeAiReviews = sqliteTable('resume_ai_reviews', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id),
  result: text('result', { mode: 'json' }).notNull(),
  score: integer('score').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const templateMarketItems = sqliteTable('template_market_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerUserId: text('owner_user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  baseTemplate: text('base_template').notNull().default('touch-pure'),
  themeConfig: text('theme_config', { mode: 'json' }).notNull().default('{}'),
  customCss: text('custom_css').notNull().default(''),
  isPublic: integer('is_public', { mode: 'boolean' }).notNull().default(false),
  installCount: integer('install_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const aiChannels = sqliteTable('ai_channels', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  provider: text('provider').notNull(),
  apiKey: text('api_key').notNull(),
  baseUrl: text('base_url').notNull(),
  model: text('model').notNull(),
  openAIEndpoint: text('openai_endpoint').notNull().default('chat'),
  weight: integer('weight').notNull().default(1),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  lastUsedAt: integer('last_used_at', { mode: 'timestamp' }),
  failureCount: integer('failure_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const knowledgeNodes = sqliteTable('knowledge_nodes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  resumeId: text('resume_id').references(() => resumes.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  label: text('label').notNull(),
  content: text('content').notNull().default(''),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const knowledgeEdges = sqliteTable('knowledge_edges', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id),
  fromNodeId: text('from_node_id').notNull().references(() => knowledgeNodes.id, { onDelete: 'cascade' }),
  toNodeId: text('to_node_id').notNull().references(() => knowledgeNodes.id, { onDelete: 'cascade' }),
  relation: text('relation').notNull().default('related'),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const jdAnalyses = sqliteTable('jd_analyses', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  jobDescription: text('job_description').notNull(),
  result: text('result', { mode: 'json' }).notNull(),
  overallScore: integer('overall_score').notNull(),
  atsScore: integer('ats_score').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const grammarChecks = sqliteTable('grammar_checks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  result: text('result', { mode: 'json' }).notNull(),
  score: integer('score').notNull(),
  issueCount: integer('issue_count').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export {
  interviewSessions,
  interviewRounds,
  interviewMessages,
  interviewReports,
} from './schema-interview';
