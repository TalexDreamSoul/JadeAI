/**
 * PostgreSQL schema — mirrors schema.ts (SQLite) with PG-native types.
 * Used ONLY by drizzle-kit for PG migration generation.
 * Runtime code still imports table objects from schema.ts.
 */
import { pgTable, text, integer } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

const epochNow = sql`extract(epoch from now())::integer`;

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  email: text('email').unique(),
  passwordHash: text('password_hash'),
  name: text('name'),
  avatarUrl: text('avatar_url'),
  fingerprint: text('fingerprint').unique(),
  authType: text('auth_type').notNull(),
  role: text('role').notNull().default('user'),
  aiCredits: integer('ai_credits').notNull().default(20),
  settings: text('settings').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const authAccounts = pgTable('auth_accounts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  provider: text('provider').notNull(),
  providerAccountId: text('provider_account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  tokenType: text('token_type'),
  expiresAt: integer('expires_at'),
  scope: text('scope'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const resumes = pgTable('resumes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  title: text('title').notNull().default('未命名简历'),
  template: text('template').notNull().default('touch-pure'),
  themeConfig: text('theme_config').default('{}'),
  isDefault: integer('is_default').notNull().default(0),
  isBase: integer('is_base').notNull().default(0),
  cloudSyncEnabled: integer('cloud_sync_enabled').notNull().default(1),
  language: text('language').notNull().default('zh'),
  sourceResumeId: text('source_resume_id'),
  baseResumeId: text('base_resume_id'),
  targetCompany: text('target_company'),
  targetJobTitle: text('target_job_title'),
  jobDescription: text('job_description'),
  versionLabel: text('version_label').notNull().default('v1'),
  shareToken: text('share_token'),
  isPublic: integer('is_public').notNull().default(0),
  sharePassword: text('share_password'),
  viewCount: integer('view_count').notNull().default(0),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const resumeVersions = pgTable('resume_versions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull(),
  label: text('label').notNull(),
  snapshot: text('snapshot').notNull(),
  source: text('source').notNull().default('manual'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const resumeEvents = pgTable('resume_events', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull(),
  userId: text('user_id').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const resumeSections = pgTable('resume_sections', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  visible: integer('visible').notNull().default(1),
  content: text('content').notNull().default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const chatSessions = pgTable('chat_sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull(),
  title: text('title').notNull().default('新对话'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const chatMessages = pgTable('chat_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const userProfileMemories = pgTable('user_profile_memories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  type: text('type').notNull().default('profile'),
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  source: text('source').notNull().default('manual'),
  confidence: integer('confidence').notNull().default(80),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const jobTemplates = pgTable('job_templates', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerUserId: text('owner_user_id').notNull(),
  roleKey: text('role_key').notNull().unique(),
  title: text('title').notNull(),
  level: text('level').notNull().default('mid'),
  industry: text('industry').notNull().default(''),
  jd: text('jd').notNull().default(''),
  keywords: text('keywords').notNull().default('[]'),
  interviewQuestions: text('interview_questions').notNull().default('[]'),
  recommendedSections: text('recommended_sections').notNull().default('[]'),
  enabled: integer('enabled').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(1000),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const resumeShares = pgTable('resume_shares', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull(),
  token: text('token').notNull().unique(),
  label: text('label').notNull().default(''),
  password: text('password'),
  reviewEnabled: integer('review_enabled').notNull().default(0),
  downloadEnabled: integer('download_enabled').notNull().default(1),
  viewRequiresLogin: integer('view_requires_login').notNull().default(0),
  anonymousShare: integer('anonymous_share').notNull().default(0),
  hideSensitiveInfo: integer('hide_sensitive_info').notNull().default(0),
  viewCount: integer('view_count').notNull().default(0),
  isActive: integer('is_active').notNull().default(1),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const resumeReviewComments = pgTable('resume_review_comments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  shareId: text('share_id').notNull(),
  resumeId: text('resume_id').notNull(),
  parentCommentId: text('parent_comment_id'),
  authorUserId: text('author_user_id'),
  authorName: text('author_name').notNull().default('Reviewer'),
  authorEmail: text('author_email'),
  sectionId: text('section_id'),
  selectedText: text('selected_text'),
  anchor: text('anchor'),
  content: text('content').notNull(),
  status: text('status').notNull().default('open'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const resumeReviewPresence = pgTable('resume_review_presence', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  shareId: text('share_id').notNull(),
  resumeId: text('resume_id').notNull(),
  userId: text('user_id').notNull(),
  reviewerName: text('reviewer_name').notNull().default('Reviewer'),
  reviewerEmail: text('reviewer_email'),
  reviewerAvatarUrl: text('reviewer_avatar_url'),
  cursorX: integer('cursor_x').notNull().default(0),
  cursorY: integer('cursor_y').notNull().default(0),
  color: text('color').notNull().default('#10b981'),
  lastSeenAt: integer('last_seen_at').notNull().default(epochNow),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const resumeAiReviews = pgTable('resume_ai_reviews', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull(),
  userId: text('user_id').notNull(),
  result: text('result').notNull(),
  score: integer('score').notNull().default(0),
  status: text('status').notNull().default('success'),
  error: text('error'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const templateMarketItems = pgTable('template_market_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerUserId: text('owner_user_id').notNull(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  baseTemplate: text('base_template').notNull().default('touch-pure'),
  themeConfig: text('theme_config').notNull().default('{}'),
  customCss: text('custom_css').notNull().default(''),
  isPublic: integer('is_public').notNull().default(0),
  installCount: integer('install_count').notNull().default(0),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const aiChannels = pgTable('ai_channels', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  provider: text('provider').notNull(),
  apiKey: text('api_key').notNull(),
  baseUrl: text('base_url').notNull(),
  model: text('model').notNull(),
  openAIEndpoint: text('openai_endpoint').notNull().default('chat'),
  weight: integer('weight').notNull().default(1),
  enabled: integer('enabled').notNull().default(1),
  lastUsedAt: integer('last_used_at'),
  failureCount: integer('failure_count').notNull().default(0),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const knowledgeNodes = pgTable('knowledge_nodes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  resumeId: text('resume_id'),
  type: text('type').notNull(),
  label: text('label').notNull(),
  content: text('content').notNull().default(''),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const knowledgeEdges = pgTable('knowledge_edges', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  fromNodeId: text('from_node_id').notNull(),
  toNodeId: text('to_node_id').notNull(),
  relation: text('relation').notNull().default('related'),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const jdAnalyses = pgTable('jd_analyses', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull(),
  jobDescription: text('job_description').notNull(),
  result: text('result').notNull(),
  overallScore: integer('overall_score').notNull(),
  atsScore: integer('ats_score').notNull(),
  status: text('status').notNull().default('success'),
  error: text('error'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const grammarChecks = pgTable('grammar_checks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull(),
  result: text('result').notNull(),
  score: integer('score').notNull(),
  issueCount: integer('issue_count').notNull(),
  status: text('status').notNull().default('success'),
  error: text('error'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

// ── Interview simulation tables ──

export const interviewSessions = pgTable('interview_sessions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  resumeId: text('resume_id'),
  jobDescription: text('job_description').notNull(),
  jobTitle: text('job_title').notNull().default(''),
  selectedInterviewers: text('selected_interviewers').notNull().default('[]'),
  currentRound: integer('current_round').notNull().default(0),
  status: text('status').notNull().default('preparing'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const interviewRounds = pgTable('interview_rounds', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id').notNull(),
  interviewerType: text('interviewer_type').notNull(),
  interviewerConfig: text('interviewer_config').notNull(),
  sortOrder: integer('sort_order').notNull().default(0),
  status: text('status').notNull().default('pending'),
  questionCount: integer('question_count').notNull().default(0),
  maxQuestions: integer('max_questions').notNull().default(10),
  summary: text('summary'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const interviewMessages = pgTable('interview_messages', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  roundId: text('round_id').notNull(),
  role: text('role').notNull(),
  content: text('content').notNull(),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const interviewReports = pgTable('interview_reports', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  sessionId: text('session_id').notNull().unique(),
  overallScore: integer('overall_score').notNull(),
  dimensionScores: text('dimension_scores').notNull(),
  roundEvaluations: text('round_evaluations').notNull(),
  overallFeedback: text('overall_feedback').notNull(),
  improvementPlan: text('improvement_plan').notNull(),
  createdAt: integer('created_at').notNull().default(epochNow),
});
