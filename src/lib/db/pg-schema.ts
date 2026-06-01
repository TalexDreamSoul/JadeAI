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
  resumeVersionId: text('resume_version_id'),
  resumeVersionLabel: text('resume_version_label'),
  resumeTitleSnapshot: text('resume_title_snapshot'),
  targetCompanySnapshot: text('target_company_snapshot'),
  targetJobTitleSnapshot: text('target_job_title_snapshot'),
  jdHash: text('jd_hash'),
  analysisGroupId: text('analysis_group_id'),
  jobDescription: text('job_description').notNull(),
  result: text('result').notNull(),
  overallScore: integer('overall_score').notNull(),
  atsScore: integer('ats_score').notNull(),
  status: text('status').notNull().default('success'),
  error: text('error'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const resumeChangeProposals = pgTable('resume_change_proposals', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull(),
  userId: text('user_id'),
  source: text('source').notNull().default('ai'),
  sourceId: text('source_id'),
  shareId: text('share_id'),
  commentId: text('comment_id'),
  sectionId: text('section_id'),
  sectionType: text('section_type').notNull(),
  targetField: text('target_field').notNull().default('text'),
  current: text('current').notNull().default(''),
  suggested: text('suggested').notNull().default(''),
  reason: text('reason').notNull().default(''),
  evidenceRequired: integer('evidence_required').notNull().default(0),
  status: text('status').notNull().default('pending'),
  metadata: text('metadata').default('{}'),
  beforeVersionId: text('before_version_id'),
  appliedVersionId: text('applied_version_id'),
  undoContent: text('undo_content'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
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

export const membershipPlans = pgTable('membership_plans', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  tier: integer('tier').notNull().default(0),
  priceCents: integer('price_cents').notNull().default(0),
  currency: text('currency').notNull().default('CNY'),
  billingCycle: text('billing_cycle').notNull().default('month'),
  active: integer('active').notNull().default(1),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const planEntitlements = pgTable('plan_entitlements', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  planId: text('plan_id').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull().default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const userMemberships = pgTable('user_memberships', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  planId: text('plan_id').notNull(),
  status: text('status').notNull().default('active'),
  source: text('source').notNull().default('system'),
  sourceId: text('source_id'),
  currentPeriodStart: integer('current_period_start').notNull().default(epochNow),
  currentPeriodEnd: integer('current_period_end'),
  cancelAtPeriodEnd: integer('cancel_at_period_end').notNull().default(0),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const products = pgTable('products', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type').notNull(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  priceCents: integer('price_cents').notNull().default(0),
  currency: text('currency').notNull().default('CNY'),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  active: integer('active').notNull().default(1),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const orders = pgTable('orders', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  orderNo: text('order_no').notNull().unique(),
  status: text('status').notNull().default('pending_payment'),
  totalCents: integer('total_cents').notNull().default(0),
  payableCents: integer('payable_cents').notNull().default(0),
  currency: text('currency').notNull().default('CNY'),
  source: text('source').notNull().default('web'),
  metadata: text('metadata').default('{}'),
  paidAt: integer('paid_at'),
  fulfilledAt: integer('fulfilled_at'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const orderItems = pgTable('order_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('order_id').notNull(),
  productId: text('product_id').notNull(),
  productType: text('product_type').notNull(),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPriceCents: integer('unit_price_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull().default(0),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const payments = pgTable('payments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('order_id').notNull(),
  provider: text('provider').notNull().default('mock'),
  providerTradeNo: text('provider_trade_no'),
  status: text('status').notNull().default('succeeded'),
  amountCents: integer('amount_cents').notNull().default(0),
  currency: text('currency').notNull().default('CNY'),
  rawPayload: text('raw_payload').default('{}'),
  paidAt: integer('paid_at').notNull().default(epochNow),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const userEntitlements = pgTable('user_entitlements', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  key: text('key').notNull(),
  value: text('value').notNull().default('{}'),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  source: text('source').notNull().default('system'),
  sourceId: text('source_id'),
  startsAt: integer('starts_at').notNull().default(epochNow),
  expiresAt: integer('expires_at'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const walletAccounts = pgTable('wallet_accounts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  currency: text('currency').notNull(),
  balance: integer('balance').notNull().default(0),
  lockedBalance: integer('locked_balance').notNull().default(0),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const walletTransactions = pgTable('wallet_transactions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text('account_id').notNull(),
  userId: text('user_id').notNull(),
  currency: text('currency').notNull(),
  direction: text('direction').notNull(),
  amount: integer('amount').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  source: text('source').notNull(),
  sourceId: text('source_id'),
  description: text('description').notNull().default(''),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const aiUsageLogs = pgTable('ai_usage_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  feature: text('feature').notNull(),
  provider: text('provider'),
  model: text('model'),
  promptTokens: integer('prompt_tokens').notNull().default(0),
  completionTokens: integer('completion_tokens').notNull().default(0),
  totalTokens: integer('total_tokens').notNull().default(0),
  creditsCharged: integer('credits_charged').notNull().default(0),
  walletTransactionId: text('wallet_transaction_id'),
  status: text('status').notNull().default('success'),
  error: text('error'),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  type: text('type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  status: text('status').notNull().default('unread'),
  actionUrl: text('action_url'),
  metadata: text('metadata').default('{}'),
  readAt: integer('read_at'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const interviewQuestionBanks = pgTable('interview_question_banks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  industry: text('industry').notNull().default(''),
  role: text('role').notNull().default(''),
  level: text('level').notNull().default('mid'),
  companyType: text('company_type').notNull().default(''),
  accessLevel: text('access_level').notNull().default('free'),
  active: integer('active').notNull().default(1),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const interviewQuestions = pgTable('interview_questions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  bankId: text('bank_id').notNull(),
  dimension: text('dimension').notNull().default('general'),
  difficulty: text('difficulty').notNull().default('medium'),
  questionType: text('question_type').notNull().default('open'),
  prompt: text('prompt').notNull(),
  referenceAnswer: text('reference_answer').notNull().default(''),
  rubric: text('rubric').notNull().default('{}'),
  keywords: text('keywords').notNull().default('[]'),
  followUpStrategy: text('follow_up_strategy').notNull().default('{}'),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const interviewQuestionFavorites = pgTable('interview_question_favorites', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  bankId: text('bank_id').notNull(),
  questionId: text('question_id').notNull(),
  source: text('source').notNull().default('manual'),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const interviewQuestionPracticeAttempts = pgTable('interview_question_practice_attempts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  bankId: text('bank_id').notNull(),
  questionId: text('question_id').notNull(),
  answer: text('answer').notNull().default(''),
  score: integer('score').notNull().default(0),
  maxScore: integer('max_score').notNull().default(100),
  isCorrect: integer('is_correct').notNull().default(0),
  feedback: text('feedback').notNull().default(''),
  rubricResult: text('rubric_result').default('{}'),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const interviewQuestionStats = pgTable('interview_question_stats', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull(),
  bankId: text('bank_id').notNull(),
  questionId: text('question_id').notNull(),
  attemptCount: integer('attempt_count').notNull().default(0),
  correctCount: integer('correct_count').notNull().default(0),
  wrongCount: integer('wrong_count').notNull().default(0),
  bestScore: integer('best_score').notNull().default(0),
  lastScore: integer('last_score').notNull().default(0),
  mastered: integer('mastered').notNull().default(0),
  lastAttemptAt: integer('last_attempt_at'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const redeemCodes = pgTable('redeem_codes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text('code').notNull().unique(),
  type: text('type').notNull().default('benefit'),
  status: text('status').notNull().default('active'),
  maxClaims: integer('max_claims').notNull().default(1),
  claimedCount: integer('claimed_count').notNull().default(0),
  benefit: text('benefit').notNull().default('{}'),
  startsAt: integer('starts_at'),
  expiresAt: integer('expires_at'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const redeemCodeClaims = pgTable('redeem_code_claims', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  redeemCodeId: text('redeem_code_id').notNull(),
  userId: text('user_id').notNull(),
  status: text('status').notNull().default('success'),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
});

export const referralRelations = pgTable('referral_relations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  inviterUserId: text('inviter_user_id').notNull(),
  inviteeUserId: text('invitee_user_id').notNull(),
  campaignKey: text('campaign_key').notNull().default('default'),
  status: text('status').notNull().default('pending'),
  rewardStatus: text('reward_status').notNull().default('pending'),
  metadata: text('metadata').default('{}'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const lotteryCampaigns = pgTable('lottery_campaigns', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(),
  title: text('title').notNull(),
  status: text('status').notNull().default('draft'),
  rules: text('rules').notNull().default('{}'),
  startsAt: integer('starts_at'),
  endsAt: integer('ends_at'),
  createdAt: integer('created_at').notNull().default(epochNow),
  updatedAt: integer('updated_at').notNull().default(epochNow),
});

export const lotteryDraws = pgTable('lottery_draws', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  campaignId: text('campaign_id').notNull(),
  userId: text('user_id').notNull(),
  prizeType: text('prize_type').notNull().default('none'),
  prizePayload: text('prize_payload').default('{}'),
  status: text('status').notNull().default('completed'),
  createdAt: integer('created_at').notNull().default(epochNow),
});
