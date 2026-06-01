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

export const userProfileMemories = sqliteTable('user_profile_memories', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull().default('profile'),
  title: text('title').notNull(),
  content: text('content').notNull().default(''),
  source: text('source').notNull().default('manual'),
  confidence: integer('confidence').notNull().default(80),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const jobTemplates = sqliteTable('job_templates', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  ownerUserId: text('owner_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  roleKey: text('role_key').notNull().unique(),
  title: text('title').notNull(),
  level: text('level').notNull().default('mid'),
  industry: text('industry').notNull().default(''),
  jd: text('jd').notNull().default(''),
  keywords: text('keywords', { mode: 'json' }).notNull().default('[]'),
  interviewQuestions: text('interview_questions', { mode: 'json' }).notNull().default('[]'),
  recommendedSections: text('recommended_sections', { mode: 'json' }).notNull().default('[]'),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(1000),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
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
  status: text('status').notNull().default('success'),
  error: text('error'),
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
  resumeVersionId: text('resume_version_id'),
  resumeVersionLabel: text('resume_version_label'),
  resumeTitleSnapshot: text('resume_title_snapshot'),
  targetCompanySnapshot: text('target_company_snapshot'),
  targetJobTitleSnapshot: text('target_job_title_snapshot'),
  jdHash: text('jd_hash'),
  analysisGroupId: text('analysis_group_id'),
  jobDescription: text('job_description').notNull(),
  result: text('result', { mode: 'json' }).notNull(),
  overallScore: integer('overall_score').notNull(),
  atsScore: integer('ats_score').notNull(),
  status: text('status').notNull().default('success'),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const resumeChangeProposals = sqliteTable('resume_change_proposals', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => users.id),
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
  evidenceRequired: integer('evidence_required', { mode: 'boolean' }).notNull().default(false),
  status: text('status').notNull().default('pending'),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  beforeVersionId: text('before_version_id'),
  appliedVersionId: text('applied_version_id'),
  undoContent: text('undo_content', { mode: 'json' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const grammarChecks = sqliteTable('grammar_checks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  resumeId: text('resume_id').notNull().references(() => resumes.id, { onDelete: 'cascade' }),
  result: text('result', { mode: 'json' }).notNull(),
  score: integer('score').notNull(),
  issueCount: integer('issue_count').notNull(),
  status: text('status').notNull().default('success'),
  error: text('error'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const membershipPlans = sqliteTable('membership_plans', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  tier: integer('tier').notNull().default(0),
  priceCents: integer('price_cents').notNull().default(0),
  currency: text('currency').notNull().default('CNY'),
  billingCycle: text('billing_cycle').notNull().default('month'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const planEntitlements = sqliteTable('plan_entitlements', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  planId: text('plan_id').notNull().references(() => membershipPlans.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: text('value', { mode: 'json' }).notNull().default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const userMemberships = sqliteTable('user_memberships', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  planId: text('plan_id').notNull().references(() => membershipPlans.id),
  status: text('status').notNull().default('active'),
  source: text('source').notNull().default('system'),
  sourceId: text('source_id'),
  currentPeriodStart: integer('current_period_start', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  currentPeriodEnd: integer('current_period_end', { mode: 'timestamp' }),
  cancelAtPeriodEnd: integer('cancel_at_period_end', { mode: 'boolean' }).notNull().default(false),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const products = sqliteTable('products', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  type: text('type').notNull(),
  sku: text('sku').notNull().unique(),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  priceCents: integer('price_cents').notNull().default(0),
  currency: text('currency').notNull().default('CNY'),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const orders = sqliteTable('orders', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  orderNo: text('order_no').notNull().unique(),
  status: text('status').notNull().default('pending_payment'),
  totalCents: integer('total_cents').notNull().default(0),
  payableCents: integer('payable_cents').notNull().default(0),
  currency: text('currency').notNull().default('CNY'),
  source: text('source').notNull().default('web'),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  paidAt: integer('paid_at', { mode: 'timestamp' }),
  fulfilledAt: integer('fulfilled_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const orderItems = sqliteTable('order_items', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  productId: text('product_id').notNull().references(() => products.id),
  productType: text('product_type').notNull(),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull().default(1),
  unitPriceCents: integer('unit_price_cents').notNull().default(0),
  totalCents: integer('total_cents').notNull().default(0),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const payments = sqliteTable('payments', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  orderId: text('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull().default('mock'),
  providerTradeNo: text('provider_trade_no'),
  status: text('status').notNull().default('succeeded'),
  amountCents: integer('amount_cents').notNull().default(0),
  currency: text('currency').notNull().default('CNY'),
  rawPayload: text('raw_payload', { mode: 'json' }).default('{}'),
  paidAt: integer('paid_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const userEntitlements = sqliteTable('user_entitlements', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: text('value', { mode: 'json' }).notNull().default('{}'),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  source: text('source').notNull().default('system'),
  sourceId: text('source_id'),
  startsAt: integer('starts_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const walletAccounts = sqliteTable('wallet_accounts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  currency: text('currency').notNull(),
  balance: integer('balance').notNull().default(0),
  lockedBalance: integer('locked_balance').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const walletTransactions = sqliteTable('wallet_transactions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  accountId: text('account_id').notNull().references(() => walletAccounts.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  currency: text('currency').notNull(),
  direction: text('direction').notNull(),
  amount: integer('amount').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  source: text('source').notNull(),
  sourceId: text('source_id'),
  description: text('description').notNull().default(''),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const aiUsageLogs = sqliteTable('ai_usage_logs', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
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
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const notifications = sqliteTable('notifications', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  status: text('status').notNull().default('unread'),
  actionUrl: text('action_url'),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  readAt: integer('read_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const interviewQuestionBanks = sqliteTable('interview_question_banks', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  industry: text('industry').notNull().default(''),
  role: text('role').notNull().default(''),
  level: text('level').notNull().default('mid'),
  companyType: text('company_type').notNull().default(''),
  accessLevel: text('access_level').notNull().default('free'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const interviewQuestions = sqliteTable('interview_questions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  bankId: text('bank_id').notNull().references(() => interviewQuestionBanks.id, { onDelete: 'cascade' }),
  dimension: text('dimension').notNull().default('general'),
  difficulty: text('difficulty').notNull().default('medium'),
  questionType: text('question_type').notNull().default('open'),
  prompt: text('prompt').notNull(),
  referenceAnswer: text('reference_answer').notNull().default(''),
  rubric: text('rubric', { mode: 'json' }).notNull().default('{}'),
  keywords: text('keywords', { mode: 'json' }).notNull().default('[]'),
  followUpStrategy: text('follow_up_strategy', { mode: 'json' }).notNull().default('{}'),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const interviewQuestionFavorites = sqliteTable('interview_question_favorites', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bankId: text('bank_id').notNull().references(() => interviewQuestionBanks.id, { onDelete: 'cascade' }),
  questionId: text('question_id').notNull().references(() => interviewQuestions.id, { onDelete: 'cascade' }),
  source: text('source').notNull().default('manual'),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const interviewQuestionPracticeAttempts = sqliteTable('interview_question_practice_attempts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bankId: text('bank_id').notNull().references(() => interviewQuestionBanks.id, { onDelete: 'cascade' }),
  questionId: text('question_id').notNull().references(() => interviewQuestions.id, { onDelete: 'cascade' }),
  answer: text('answer').notNull().default(''),
  score: integer('score').notNull().default(0),
  maxScore: integer('max_score').notNull().default(100),
  isCorrect: integer('is_correct', { mode: 'boolean' }).notNull().default(false),
  feedback: text('feedback').notNull().default(''),
  rubricResult: text('rubric_result', { mode: 'json' }).default('{}'),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const interviewQuestionStats = sqliteTable('interview_question_stats', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  bankId: text('bank_id').notNull().references(() => interviewQuestionBanks.id, { onDelete: 'cascade' }),
  questionId: text('question_id').notNull().references(() => interviewQuestions.id, { onDelete: 'cascade' }),
  attemptCount: integer('attempt_count').notNull().default(0),
  correctCount: integer('correct_count').notNull().default(0),
  wrongCount: integer('wrong_count').notNull().default(0),
  bestScore: integer('best_score').notNull().default(0),
  lastScore: integer('last_score').notNull().default(0),
  mastered: integer('mastered', { mode: 'boolean' }).notNull().default(false),
  lastAttemptAt: integer('last_attempt_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const redeemCodes = sqliteTable('redeem_codes', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  code: text('code').notNull().unique(),
  type: text('type').notNull().default('benefit'),
  status: text('status').notNull().default('active'),
  maxClaims: integer('max_claims').notNull().default(1),
  claimedCount: integer('claimed_count').notNull().default(0),
  benefit: text('benefit', { mode: 'json' }).notNull().default('{}'),
  startsAt: integer('starts_at', { mode: 'timestamp' }),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const redeemCodeClaims = sqliteTable('redeem_code_claims', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  redeemCodeId: text('redeem_code_id').notNull().references(() => redeemCodes.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('success'),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const referralRelations = sqliteTable('referral_relations', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  inviterUserId: text('inviter_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  inviteeUserId: text('invitee_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  campaignKey: text('campaign_key').notNull().default('default'),
  status: text('status').notNull().default('pending'),
  rewardStatus: text('reward_status').notNull().default('pending'),
  metadata: text('metadata', { mode: 'json' }).default('{}'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const lotteryCampaigns = sqliteTable('lottery_campaigns', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  key: text('key').notNull().unique(),
  title: text('title').notNull(),
  status: text('status').notNull().default('draft'),
  rules: text('rules', { mode: 'json' }).notNull().default('{}'),
  startsAt: integer('starts_at', { mode: 'timestamp' }),
  endsAt: integer('ends_at', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const lotteryDraws = sqliteTable('lottery_draws', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  campaignId: text('campaign_id').notNull().references(() => lotteryCampaigns.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  prizeType: text('prize_type').notNull().default('none'),
  prizePayload: text('prize_payload', { mode: 'json' }).default('{}'),
  status: text('status').notNull().default('completed'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export {
  interviewSessions,
  interviewRounds,
  interviewMessages,
  interviewReports,
} from './schema-interview';
