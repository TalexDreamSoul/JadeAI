'use client';

import { Suspense, type ReactNode, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Activity, Bot, Briefcase, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, Coins, Copy, Eye, FileClock, FileSliders, HardDrive, KeyRound, LayoutDashboard, ListChecks, MessageSquareText, Pencil, Plus, Radio, ReceiptText, RefreshCw, Save, Search, Settings2, ShieldCheck, TestTube2, Trash2, Users, XCircle, type LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useFingerprint } from '@/hooks/use-fingerprint';
import { TEMPLATES } from '@/lib/constants';
import { getTemplateLabel } from '@/lib/template-labels';
import { EmailAuthForm } from '@/components/auth/email-auth-form';
import { cn } from '@/lib/utils';
import type { Resume } from '@/types/resume';

interface AIChannel {
  id: string;
  name: string;
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  openAIEndpoint: string;
  weight: number;
  enabled: boolean;
}

type AIChannelHTTPRequestReport = {
  method: string;
  url: string;
  headers: Record<string, string>;
  bodyJson: unknown;
  timeoutMs: number;
};

type AIChannelHTTPResponseReport = {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  bodyText: string;
  bodyJson?: unknown;
  bodyJsonParseError?: string;
  bodyLength: number;
  bodyTruncated: boolean;
};

type AIChannelHTTPErrorReport = {
  name: string;
  message: string;
  cause?: string;
};

type AIChannelTestDiagnostics = {
  provider: string;
  inputBaseUrl: string;
  normalizedBaseUrl: string;
  preferredEndpoint: string;
  endpointOrder: string[];
  timeoutMs: number;
  bodyLimitChars: number;
  redaction: string;
};

type AIChannelTestAttempt = {
  endpoint: string;
  baseUrl: string;
  ok: boolean;
  message: string;
  elapsedMs: number;
  startedAt?: string;
  completedAt?: string;
  request?: AIChannelHTTPRequestReport;
  response?: AIChannelHTTPResponseReport;
  error?: AIChannelHTTPErrorReport;
  rawError?: string;
};

type AIChannelTestResult = {
  ok: boolean;
  provider: string;
  recommendedBaseUrl: string;
  recommendedEndpoint: string;
  model: string;
  message: string;
  diagnostics?: AIChannelTestDiagnostics;
  attempts: AIChannelTestAttempt[];
};

interface OAuthProviderForm {
  enabled: boolean;
  configured: boolean;
  clientId: string;
  issuer: string;
  name: string;
  source: string;
  callbackUrl: string;
  clientSecretSet?: boolean;
}

interface AuthSettings {
  authMode: string;
  passwordLoginEnabled: boolean;
  passwordRegisterEnabled: boolean;
  publicPasswordEnabled: boolean;
  adminPasswordEnabled: boolean;
  loginFooterText: string;
  loginFooterLinkText: string;
  loginFooterLinkUrl: string;
  providers: Record<string, OAuthProviderForm>;
}

interface QiniuStorageSettings {
  enabled: boolean;
  configured: boolean;
  accessKey: string;
  secretKey: string;
  secretKeySet: boolean;
  bucket: string;
  region: string;
  domain: string;
  protocol: 'https' | 'http';
  keyPrefix: string;
  publicRead: boolean;
  source: string;
  uploadBaseUrl: string;
}

interface StorageSettings {
  provider: 'qiniu';
  qiniu: QiniuStorageSettings;
}

interface AdminUser {
  id: string;
  email?: string | null;
  name?: string | null;
  authType: string;
  role: string;
  aiCredits: number;
  aiCreditBalance?: number;
  aiCreditsConsumed?: number;
  pointBalance?: number;
  isVip?: boolean;
  membership?: {
    status: string;
    planKey: string;
    planName: string;
    tier: number;
    currentPeriodStart?: string | number | Date | null;
    currentPeriodEnd?: string | number | Date | null;
    cancelAtPeriodEnd?: boolean;
  } | null;
  createdAt?: string | number | Date;
}

interface AdminAuditLog {
  id: string;
  adminUserId: string;
  targetUserId?: string | null;
  action: string;
  targetType: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt?: string | number | Date;
  admin?: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  } | null;
}

interface AdminAIUsageLog {
  id: string;
  userId: string;
  feature: string;
  provider?: string | null;
  model?: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  creditsCharged: number;
  status: string;
  error?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | number | Date;
  user?: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  } | null;
}

interface AdminWalletTransaction {
  id: string;
  accountId: string;
  userId: string;
  currency: string;
  direction: string;
  amount: number;
  balanceAfter: number;
  source: string;
  sourceId?: string | null;
  description: string;
  metadata?: Record<string, unknown> | null;
  createdAt?: string | number | Date;
  user?: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  } | null;
}

interface AdminReviewComment {
  id: string;
  shareId: string;
  resumeId: string;
  parentCommentId?: string | null;
  authorUserId?: string | null;
  authorName: string;
  authorEmail?: string | null;
  sectionId?: string | null;
  selectedText?: string | null;
  content: string;
  status: string;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
  share?: {
    id: string;
    token?: string | null;
    label?: string | null;
    reviewEnabled?: boolean | number | null;
    isActive?: boolean | number | null;
  } | null;
  resume?: {
    id: string;
    title?: string | null;
    targetCompany?: string | null;
    targetJobTitle?: string | null;
  } | null;
  authorUser?: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  } | null;
}

interface AdminReviewPresence {
  id: string;
  shareId: string;
  resumeId: string;
  userId: string;
  reviewerName: string;
  reviewerEmail?: string | null;
  reviewerAvatarUrl?: string | null;
  cursorX: number;
  cursorY: number;
  color: string;
  lastSeenAt?: string | number | Date;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
  share?: {
    id: string;
    token?: string | null;
    label?: string | null;
    reviewEnabled?: boolean | number | null;
    isActive?: boolean | number | null;
  } | null;
  resume?: {
    id: string;
    title?: string | null;
    targetCompany?: string | null;
    targetJobTitle?: string | null;
  } | null;
  user?: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  } | null;
}

interface AdminChangeProposal {
  id: string;
  resumeId: string;
  userId?: string | null;
  source?: string | null;
  sourceId?: string | null;
  shareId?: string | null;
  commentId?: string | null;
  sectionId?: string | null;
  sectionType: string;
  targetField: string;
  current: string;
  suggested: string;
  reason: string;
  evidenceRequired?: boolean | number | null;
  status: string;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
  resume?: {
    id: string;
    title?: string | null;
    targetCompany?: string | null;
    targetJobTitle?: string | null;
  } | null;
  user?: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  } | null;
  share?: {
    id: string;
    token?: string | null;
    label?: string | null;
  } | null;
  comment?: {
    id: string;
    authorName?: string | null;
    content?: string | null;
    status?: string | null;
  } | null;
}

interface TemplateItem {
  id: string;
  name: string;
  description: string;
  baseTemplate: string;
  themeConfig: Record<string, unknown>;
  customCss: string;
  isPublic: boolean;
  installCount: number;
}

type AdminJobTemplateLevel = 'intern' | 'junior' | 'mid' | 'senior';
type TemplateStatusFilter = 'all' | 'public' | 'private';
type JobTemplateLevelFilter = AdminJobTemplateLevel | 'all';
type JobTemplateSourceFilter = 'all' | 'builtin' | 'custom' | 'enabled' | 'disabled';
type ReviewCommentStatusFilter = 'all' | 'open' | 'resolved';
type ChangeProposalStatusFilter = 'all' | 'pending' | 'applied' | 'rejected';
type UserRoleFilter = 'all' | 'admin' | 'user';
type DashboardDetailKey = 'users' | 'ai' | 'storage' | 'commerce' | 'audit' | 'tasks';
type AuditPanelKey = 'admin' | 'wallet' | 'comments' | 'presence' | 'proposals';
type TemplatePanelKey = 'resume' | 'job';
type CommercePanelKey = 'products' | 'orders' | 'redeem' | 'growth';
type AdminTabKey =
  | 'dashboard'
  | 'users'
  | 'ai'
  | 'tasks'
  | 'audit'
  | 'templates'
  | 'commerce'
  | 'settings';

type AdminTabItem = {
  value: AdminTabKey;
  icon: LucideIcon;
  label: string;
};

interface AdminJobTemplate {
  id: string;
  roleKey: string;
  title: string;
  level: AdminJobTemplateLevel;
  industry: string;
  jd: string;
  keywords: string[];
  interviewQuestions: string[];
  recommendedSections: string[];
  enabled: boolean;
  builtin: boolean;
  sortOrder: number;
}

interface AdminResumeAnalysisJob {
  id: string;
  userId: string;
  resumeId?: string | null;
  fileName: string;
  fileType: string;
  fileSize: number;
  status: string;
  attempts: number;
  maxAttempts: number;
  progress: number;
  position: number;
  workerId?: string | null;
  lockedAt?: string | number | Date | null;
  lastHeartbeatAt?: string | number | Date | null;
  startedAt?: string | number | Date | null;
  finishedAt?: string | number | Date | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  logs?: Array<{ at: string; level: string; message: string; workerId?: string | null; attempt?: number; metadata?: Record<string, unknown> }> | string | null;
  metadata?: Record<string, unknown> | null;
  template?: string;
  language?: string;
  createdAt?: string | number | Date;
  updatedAt?: string | number | Date;
  user?: {
    id: string;
    email?: string | null;
    name?: string | null;
    role?: string | null;
  } | null;
}

type ResumeAnalysisAITrace = {
  stage?: string;
  provider?: string;
  model?: string;
  baseURL?: string;
  openAIEndpoint?: string;
  transportURL?: string;
  file?: {
    name?: string;
    type?: string;
    size?: number;
  };
  request?: {
    outputJson?: boolean;
    maxOutputTokens?: number;
    messageCount?: number;
    imageCount?: number;
    textPartCount?: number;
    textCharCount?: number;
    pdfTextExtracted?: boolean;
  };
  error?: {
    name?: string;
    message?: string;
    statusCode?: number;
    responseBody?: string;
    responseHeaders?: unknown;
    isRetryable?: boolean;
    cause?: unknown;
    rawKeys?: string[];
  };
  diagnosticProbe?: {
    ok?: boolean;
    message?: string;
    recommendedBaseUrl?: string;
    recommendedEndpoint?: string;
    attempts?: Array<{
      endpoint?: string;
      ok?: boolean;
      message?: string;
      response?: {
        status?: number;
        statusText?: string;
        bodyText?: string;
        bodyJson?: unknown;
      };
    }>;
  };
  hints?: string[];
};

type AdminResumeAnalysisJobDetail = {
  job: AdminResumeAnalysisJob;
  user: AdminResumeAnalysisJob['user'];
  resume: Resume | null;
};

interface AdminProduct {
  id: string;
  sku: string;
  type: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  resourceType?: string | null;
  resourceId?: string | null;
  active: boolean;
}

interface AdminOrder {
  id: string;
  orderNo: string;
  userId: string;
  status: string;
  payableCents: number;
  currency: string;
  source: string;
  createdAt?: string | number | Date;
  paidAt?: string | number | Date | null;
  fulfilledAt?: string | number | Date | null;
  items?: Array<{
    id: string;
    name: string;
    productType: string;
    resourceType?: string | null;
    resourceId?: string | null;
    quantity: number;
    totalCents: number;
  }>;
  payments?: Array<{
    id: string;
    provider: string;
    status: string;
    amountCents: number;
    currency: string;
    paidAt?: string | number | Date | null;
  }>;
}

interface AdminRedeemCode {
  id: string;
  code: string;
  type: string;
  status: string;
  maxClaims: number;
  claimedCount: number;
  benefit: unknown;
  expiresAt?: string | number | Date | null;
}

interface AdminGrowthState {
  referrals: Array<{ id: string; status: string; rewardStatus: string; createdAt?: string | number | Date }>;
  lottery: {
    campaigns: Array<{ id: string; title: string; status: string }>;
    draws: Array<{ id: string; prizeType: string; status: string; createdAt?: string | number | Date }>;
  };
}

const EMPTY_TEMPLATE_FORM = {
  id: '',
  name: '',
  description: '',
  baseTemplate: 'touch-pure',
  themeJson: '{\n  "primaryColor": "#1a1a1a",\n  "accentColor": "#3b82f6"\n}',
  customCss: '',
  isPublic: false,
};

const EMPTY_JOB_TEMPLATE_FORM: {
  id: string;
  roleKey: string;
  title: string;
  level: AdminJobTemplateLevel;
  industry: string;
  jd: string;
  keywordsText: string;
  interviewQuestionsText: string;
  recommendedSectionsText: string;
  enabled: boolean;
  sortOrder: number;
} = {
  id: '',
  roleKey: '',
  title: '',
  level: 'mid',
  industry: '',
  jd: '',
  keywordsText: '',
  interviewQuestionsText: '',
  recommendedSectionsText: '',
  enabled: true,
  sortOrder: 1000,
};

const EMPTY_REDEEM_FORM = {
  code: '',
  maxClaims: 1,
  benefitJson: '{\n  "items": [\n    { "type": "wallet", "currency": "AI_CREDIT", "amount": 20, "description": "运营兑换码" }\n  ]\n}',
};

const EMPTY_AI_CHANNEL_FORM = {
  name: '',
  provider: 'openai',
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o',
  openAIEndpoint: 'chat',
  weight: 1,
};

const EMPTY_USER_EDIT_FORM = {
  role: 'user' as 'user' | 'admin',
  aiCreditBalance: 0,
  reason: '',
};

const DEFAULT_STORAGE_SETTINGS: StorageSettings = {
  provider: 'qiniu',
  qiniu: {
    enabled: false,
    configured: false,
    accessKey: '',
    secretKey: '',
    secretKeySet: false,
    bucket: '',
    region: 'z0',
    domain: '',
    protocol: 'https',
    keyPrefix: '',
    publicRead: true,
    source: 'none',
    uploadBaseUrl: '',
  },
};

const QINIU_REGION_OPTIONS = ['z0', 'z1', 'z2', 'na0', 'as0', 'cn-east-2'];

const ORDER_STATUS_OPTIONS = ['all', 'pending_payment', 'paid', 'fulfilled', 'canceled'];
const USER_ROLE_OPTIONS: UserRoleFilter[] = ['all', 'admin', 'user'];
const AI_CHANNEL_STATUS_OPTIONS = ['all', 'enabled', 'disabled'] as const;
const AI_USAGE_STATUS_OPTIONS = ['all', 'success', 'reserved', 'failed_refunded', 'insufficient_credits'];
const RESUME_ANALYSIS_STATUS_OPTIONS = ['all', 'queued', 'running', 'retrying', 'succeeded', 'failed'];
const WALLET_TRANSACTION_DIRECTION_OPTIONS = ['all', 'credit', 'debit'];
const REVIEW_COMMENT_STATUS_OPTIONS: ReviewCommentStatusFilter[] = ['all', 'open', 'resolved'];
const CHANGE_PROPOSAL_STATUS_OPTIONS: ChangeProposalStatusFilter[] = ['all', 'pending', 'applied', 'rejected'];
const DASHBOARD_DETAIL_ITEMS: Array<{ value: DashboardDetailKey; label: string; icon: LucideIcon }> = [
  { value: 'users', label: '用户', icon: Users },
  { value: 'ai', label: 'AI', icon: Bot },
  { value: 'storage', label: '存储', icon: HardDrive },
  { value: 'commerce', label: '商业', icon: ReceiptText },
  { value: 'audit', label: '审计', icon: ClipboardCheck },
  { value: 'tasks', label: '任务', icon: FileClock },
];
const AUDIT_PANEL_ITEMS: Array<{ value: AuditPanelKey; label: string; icon: LucideIcon }> = [
  { value: 'admin', label: '管理操作', icon: ShieldCheck },
  { value: 'wallet', label: '额度流水', icon: Coins },
  { value: 'comments', label: 'Review 评论', icon: MessageSquareText },
  { value: 'presence', label: '实时审阅', icon: Radio },
  { value: 'proposals', label: '审批提案', icon: ClipboardCheck },
];
const TEMPLATE_PANEL_ITEMS: Array<{ value: TemplatePanelKey; label: string; icon: LucideIcon }> = [
  { value: 'resume', label: '简历模板', icon: FileSliders },
  { value: 'job', label: '岗位模板', icon: Briefcase },
];
const COMMERCE_PANEL_ITEMS: Array<{ value: CommercePanelKey; label: string; icon: LucideIcon }> = [
  { value: 'products', label: '产品', icon: ReceiptText },
  { value: 'orders', label: '订单', icon: ListChecks },
  { value: 'redeem', label: '兑换码', icon: KeyRound },
  { value: 'growth', label: '增长', icon: Activity },
];
const ADMIN_TAB_TRIGGER_CLASS = 'h-9 flex-none shrink-0 justify-start gap-2 px-3 text-left max-lg:!w-auto lg:w-full';
const PAGE_SIZE_OPTIONS = [10, 20, 50];

type AdminTableColumn<T> = {
  key: string;
  header: ReactNode;
  className?: string;
  cell: (row: T) => ReactNode;
};

type AdminDataTableProps<T> = {
  title: string;
  description?: string;
  icon?: LucideIcon;
  rows: T[];
  columns: Array<AdminTableColumn<T>>;
  emptyText: string;
  toolbar?: ReactNode;
  metrics?: ReactNode;
  actions?: ReactNode;
  selectedIds?: Set<string>;
  onSelectedIdsChange?: (ids: Set<string>) => void;
  getRowId: (row: T) => string;
  renderRowActions?: (row: T) => ReactNode;
  pageSize?: number;
  minWidth?: string;
};

function getHeaders() {
  const fingerprint = typeof window !== 'undefined' ? localStorage.getItem('touchresume_fingerprint') : null;
  return {
    'Content-Type': 'application/json',
    ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
  };
}

function formatDate(value?: string | number | Date) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleDateString() : '-';
}

function formatDateTime(value?: string | number | Date | null) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : '-';
}

function formatMembershipExpiry(user: AdminUser) {
  if (!user.isVip || !user.membership) return '非会员';
  if (!user.membership.currentPeriodEnd) return '长期有效';
  return formatDate(user.membership.currentPeriodEnd);
}

function formatBytes(value?: number | null) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function shortId(value?: string | null) {
  if (!value) return '-';
  return value.length > 10 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
}

function money(cents: number, currency = 'CNY') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(Number(cents || 0) / 100);
}

function stringifyReport(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function responseStatusLabel(response?: AIChannelHTTPResponseReport) {
  if (!response) return 'no response';
  return `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
}

function normalizeJobLogs(logs: AdminResumeAnalysisJob['logs']) {
  if (!logs) return [];
  if (Array.isArray(logs)) return logs;
  if (typeof logs !== 'string') return [];
  try {
    const parsed = JSON.parse(logs);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function asPlainRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function getResumeAnalysisTrace(job: AdminResumeAnalysisJob): ResumeAnalysisAITrace | null {
  const logs = normalizeJobLogs(job.logs);
  for (const log of logs.slice().reverse()) {
    const metadata = asPlainRecord(log.metadata);
    const trace = asPlainRecord(metadata?.aiTrace);
    if (trace) return trace as ResumeAnalysisAITrace;
  }
  return null;
}

function firstProbeFailure(trace: ResumeAnalysisAITrace | null) {
  return trace?.diagnosticProbe?.attempts?.find((attempt) => !attempt.ok) || null;
}

function valueLabel(value: unknown) {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function summarizeSectionContent(content: unknown) {
  if (!content || typeof content !== 'object') return '-';
  const entries = Object.entries(content as Record<string, unknown>);
  if (entries.length === 0) return '-';
  return entries.slice(0, 5).map(([key, value]) => {
    if (Array.isArray(value)) return `${key}: ${value.length} 项`;
    if (value && typeof value === 'object') return `${key}: ${Object.keys(value).length} 字段`;
    return `${key}: ${valueLabel(value)}`;
  }).join(' · ');
}

function auditValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function MetricStrip({ items }: { items: Array<{ label: ReactNode; value: ReactNode; tone?: 'default' | 'good' | 'warn' | 'danger' }> }) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <div
          key={`${String(item.label)}-${index}`}
          className={cn(
            'rounded-lg border bg-zinc-50 px-3 py-2 dark:bg-zinc-900/60',
            item.tone === 'good' && 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20',
            item.tone === 'warn' && 'border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20',
            item.tone === 'danger' && 'border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/20',
          )}
        >
          <div className="text-xs text-zinc-500">{item.label}</div>
          <div className="mt-1 truncate text-lg font-semibold text-zinc-950 dark:text-zinc-50">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function TableSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="relative block min-w-0">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="pl-9" />
    </label>
  );
}

function AdminDataTable<T>({
  title,
  description,
  icon: Icon,
  rows,
  columns,
  emptyText,
  toolbar,
  metrics,
  actions,
  selectedIds,
  onSelectedIdsChange,
  getRowId,
  renderRowActions,
  pageSize = 10,
  minWidth = '900px',
}: AdminDataTableProps<T>) {
  const [page, setPage] = useState(1);
  const [currentPageSize, setCurrentPageSize] = useState(pageSize);
  const pageCount = Math.max(1, Math.ceil(rows.length / currentPageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = rows.slice((safePage - 1) * currentPageSize, safePage * currentPageSize);
  const canSelect = !!selectedIds && !!onSelectedIdsChange;
  const selectedCount = selectedIds?.size ?? 0;
  const pageIds = pageRows.map(getRowId);
  const allPageSelected = canSelect && pageIds.length > 0 && pageIds.every((id) => selectedIds?.has(id));

  const toggleAllPage = () => {
    if (!canSelect || !selectedIds || !onSelectedIdsChange) return;
    const next = new Set(selectedIds);
    if (allPageSelected) {
      pageIds.forEach((id) => next.delete(id));
    } else {
      pageIds.forEach((id) => next.add(id));
    }
    onSelectedIdsChange(next);
  };

  const toggleRow = (id: string) => {
    if (!canSelect || !selectedIds || !onSelectedIdsChange) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectedIdsChange(next);
  };

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="space-y-3 border-b p-4 dark:border-zinc-800">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-base font-semibold text-zinc-950 dark:text-zinc-50">
              {Icon && <Icon className="h-4 w-4 text-zinc-500" />}
              <span>{title}</span>
              <Badge variant="outline">{rows.length}</Badge>
            </div>
            {description && <p className="mt-1 text-xs text-zinc-500">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {metrics}
        {toolbar && <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">{toolbar}</div>}
        {canSelect && selectedCount > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
            <span>已选择 {selectedCount} 行</span>
            <Button type="button" variant="ghost" size="xs" onClick={() => onSelectedIdsChange?.(new Set())}>
              清空选择
            </Button>
          </div>
        )}
      </div>

      <div className="max-h-[520px] overflow-auto">
        <table className="w-full border-collapse text-left text-sm" style={{ minWidth }}>
          <thead className="sticky top-0 z-10 bg-zinc-50 text-xs font-medium text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
            <tr className="border-b dark:border-zinc-800">
              {canSelect && (
                <th className="w-10 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={Boolean(allPageSelected)}
                    onChange={toggleAllPage}
                    aria-label="选择当前页"
                    className="h-4 w-4 rounded border-zinc-300"
                  />
                </th>
              )}
              {columns.map((column) => (
                <th key={column.key} className={cn('px-3 py-2', column.className)}>{column.header}</th>
              ))}
              {renderRowActions && (
                <th className="sticky right-0 w-36 border-l bg-zinc-50 px-3 py-2 text-right dark:border-zinc-800 dark:bg-zinc-900">
                  操作
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (canSelect ? 1 : 0) + (renderRowActions ? 1 : 0)} className="px-3 py-10 text-center text-sm text-zinc-400">
                  {emptyText}
                </td>
              </tr>
            ) : pageRows.map((row) => {
              const rowId = getRowId(row);
              return (
                <tr key={rowId} className="border-b last:border-b-0 hover:bg-zinc-50/80 dark:border-zinc-800 dark:hover:bg-zinc-900/70">
                  {canSelect && (
                    <td className="px-3 py-2 align-middle">
                      <input
                        type="checkbox"
                        checked={Boolean(selectedIds?.has(rowId))}
                        onChange={() => toggleRow(rowId)}
                        aria-label={`选择 ${rowId}`}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={`${rowId}-${column.key}`} className={cn('px-3 py-2 align-middle', column.className)}>
                      {column.cell(row)}
                    </td>
                  ))}
                  {renderRowActions && (
                    <td className="sticky right-0 border-l bg-white px-3 py-2 align-middle dark:border-zinc-800 dark:bg-zinc-950">
                      <div className="flex justify-end gap-1.5">{renderRowActions(row)}</div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 border-t px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 sm:flex-row sm:items-center sm:justify-between">
        <div>
          第 {safePage} / {pageCount} 页 · 共 {rows.length} 行
        </div>
        <div className="flex items-center gap-2">
          <select
            value={currentPageSize}
            onChange={(event) => setCurrentPageSize(Number(event.target.value) || pageSize)}
            className="h-8 rounded-md border bg-background px-2 text-xs"
            aria-label="每页行数"
          >
            {PAGE_SIZE_OPTIONS.map((option) => <option key={option} value={option}>{option} / 页</option>)}
          </select>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={safePage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => setPage((value) => Math.min(pageCount, value + 1))} disabled={safePage >= pageCount}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function normalizeQiniuStorageSettings(raw: unknown): QiniuStorageSettings {
  const qiniu = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  return {
    enabled: Boolean(qiniu.enabled),
    configured: Boolean(qiniu.configured),
    accessKey: String(qiniu.accessKey || ''),
    secretKey: '',
    secretKeySet: Boolean(qiniu.secretKeySet),
    bucket: String(qiniu.bucket || ''),
    region: String(qiniu.region || 'z0'),
    domain: String(qiniu.domain || ''),
    protocol: qiniu.protocol === 'http' ? 'http' : 'https',
    keyPrefix: String(qiniu.keyPrefix || ''),
    publicRead: qiniu.publicRead !== false,
    source: String(qiniu.source || 'none'),
    uploadBaseUrl: String(qiniu.uploadBaseUrl || ''),
  };
}

function normalizeStorageSettings(raw: unknown): StorageSettings {
  const storage = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? raw as Record<string, unknown>
    : {};
  return {
    provider: 'qiniu',
    qiniu: normalizeQiniuStorageSettings(storage.qiniu),
  };
}

export default function AdminPage() {
  const t = useTranslations('admin');
  const tDashboard = useTranslations('dashboard');
  const { status, data: session } = useSession();
  const { isLoading } = useFingerprint();
  const [channels, setChannels] = useState<AIChannel[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<UserRoleFilter>('all');
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [userEditForm, setUserEditForm] = useState(EMPTY_USER_EDIT_FORM);
  const [confirmingUserEdit, setConfirmingUserEdit] = useState(false);
  const [savingUserEdit, setSavingUserEdit] = useState(false);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [jobTemplates, setJobTemplates] = useState<AdminJobTemplate[]>([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<Set<string>>(new Set());
  const [selectedJobTemplateIds, setSelectedJobTemplateIds] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [commercePanel, setCommercePanel] = useState<CommercePanelKey>('products');
  const [productQuery, setProductQuery] = useState('');
  const [orderQuery, setOrderQuery] = useState('');
  const [redeemCodeQuery, setRedeemCodeQuery] = useState('');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [selectedOrderIds, setSelectedOrderIds] = useState<Set<string>>(new Set());
  const [selectedRedeemCodeIds, setSelectedRedeemCodeIds] = useState<Set<string>>(new Set());
  const [aiUsage, setAiUsage] = useState<AdminAIUsageLog[]>([]);
  const [aiUsageStatusFilter, setAiUsageStatusFilter] = useState('all');
  const [aiUsageQuery, setAiUsageQuery] = useState('');
  const [aiChannelQuery, setAiChannelQuery] = useState('');
  const [aiChannelStatusFilter, setAiChannelStatusFilter] = useState<(typeof AI_CHANNEL_STATUS_OPTIONS)[number]>('all');
  const [selectedAIChannelIds, setSelectedAIChannelIds] = useState<Set<string>>(new Set());
  const [selectedAIUsageIds, setSelectedAIUsageIds] = useState<Set<string>>(new Set());
  const [resumeAnalysisJobs, setResumeAnalysisJobs] = useState<AdminResumeAnalysisJob[]>([]);
  const [resumeAnalysisStatusFilter, setResumeAnalysisStatusFilter] = useState('all');
  const [resumeAnalysisQuery, setResumeAnalysisQuery] = useState('');
  const [selectedResumeAnalysisJobIds, setSelectedResumeAnalysisJobIds] = useState<Set<string>>(new Set());
  const [resumeAnalysisJobDetail, setResumeAnalysisJobDetail] = useState<AdminResumeAnalysisJobDetail | null>(null);
  const [resumeAnalysisDetailMode, setResumeAnalysisDetailMode] = useState<'detail' | 'preview'>('detail');
  const [loadingResumeAnalysisJobId, setLoadingResumeAnalysisJobId] = useState<string | null>(null);
  const [walletTransactions, setWalletTransactions] = useState<AdminWalletTransaction[]>([]);
  const [adminAuditLogs, setAdminAuditLogs] = useState<AdminAuditLog[]>([]);
  const [adminAuditQuery, setAdminAuditQuery] = useState('');
  const [selectedAdminAuditLogIds, setSelectedAdminAuditLogIds] = useState<Set<string>>(new Set());
  const [walletDirectionFilter, setWalletDirectionFilter] = useState('all');
  const [walletTransactionQuery, setWalletTransactionQuery] = useState('');
  const [selectedWalletTransactionIds, setSelectedWalletTransactionIds] = useState<Set<string>>(new Set());
  const [reviewComments, setReviewComments] = useState<AdminReviewComment[]>([]);
  const [reviewCommentStatusFilter, setReviewCommentStatusFilter] = useState<ReviewCommentStatusFilter>('all');
  const [reviewCommentQuery, setReviewCommentQuery] = useState('');
  const [selectedReviewCommentIds, setSelectedReviewCommentIds] = useState<Set<string>>(new Set());
  const [reviewPresence, setReviewPresence] = useState<AdminReviewPresence[]>([]);
  const [reviewPresenceQuery, setReviewPresenceQuery] = useState('');
  const [selectedReviewPresenceIds, setSelectedReviewPresenceIds] = useState<Set<string>>(new Set());
  const [changeProposals, setChangeProposals] = useState<AdminChangeProposal[]>([]);
  const [changeProposalStatusFilter, setChangeProposalStatusFilter] = useState<ChangeProposalStatusFilter>('all');
  const [changeProposalQuery, setChangeProposalQuery] = useState('');
  const [selectedChangeProposalIds, setSelectedChangeProposalIds] = useState<Set<string>>(new Set());
  const [redeemCodes, setRedeemCodes] = useState<AdminRedeemCode[]>([]);
  const [growth, setGrowth] = useState<AdminGrowthState | null>(null);
  const [dashboardDetail, setDashboardDetail] = useState<DashboardDetailKey>('storage');
  const [auditPanel, setAuditPanel] = useState<AuditPanelKey>('admin');
  const [templatePanel, setTemplatePanel] = useState<TemplatePanelKey>('resume');
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY_AI_CHANNEL_FORM);
  const [aiChannelDialogOpen, setAiChannelDialogOpen] = useState(false);
  const [aiTestResultOpen, setAiTestResultOpen] = useState(false);
  const [viewingAIChannel, setViewingAIChannel] = useState<AIChannel | null>(null);
  const [aiActionChannel, setAiActionChannel] = useState<AIChannel | null>(null);
  const [aiActionType, setAiActionType] = useState<'toggle' | 'delete' | null>(null);
  const [savingAIChannel, setSavingAIChannel] = useState(false);
  const [deletingChannelId, setDeletingChannelId] = useState<string | null>(null);
  const [togglingChannelId, setTogglingChannelId] = useState<string | null>(null);
  const [aiTestResult, setAiTestResult] = useState<AIChannelTestResult | null>(null);
  const [testingChannelId, setTestingChannelId] = useState<string | null>(null);
  const [aiTestTargetChannelId, setAiTestTargetChannelId] = useState<string | null>(null);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [authSettings, setAuthSettings] = useState<AuthSettings>({
    authMode: 'local',
    passwordLoginEnabled: true,
    passwordRegisterEnabled: true,
    publicPasswordEnabled: true,
    adminPasswordEnabled: false,
    loginFooterText: '',
    loginFooterLinkText: '',
    loginFooterLinkUrl: '',
    providers: {},
  });
  const [storageSettings, setStorageSettings] = useState<StorageSettings>(DEFAULT_STORAGE_SETTINGS);
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE_FORM);
  const [templateQuery, setTemplateQuery] = useState('');
  const [templateStatusFilter, setTemplateStatusFilter] = useState<TemplateStatusFilter>('all');
  const [jobTemplateForm, setJobTemplateForm] = useState(EMPTY_JOB_TEMPLATE_FORM);
  const [jobTemplateQuery, setJobTemplateQuery] = useState('');
  const [jobTemplateLevelFilter, setJobTemplateLevelFilter] = useState<JobTemplateLevelFilter>('all');
  const [jobTemplateSourceFilter, setJobTemplateSourceFilter] = useState<JobTemplateSourceFilter>('all');
  const [redeemForm, setRedeemForm] = useState(EMPTY_REDEEM_FORM);

  const isLoggedIn = status === 'authenticated' && !!session?.user?.email;
  const isAdmin = session?.user?.role === 'admin';

  const templateOptions = useMemo(() => TEMPLATES.map((template) => ({
    value: template,
    label: getTemplateLabel(template, tDashboard),
  })), [tDashboard]);

  const adminTabs = useMemo<AdminTabItem[]>(() => [
    { value: 'dashboard', icon: LayoutDashboard, label: '仪表盘' },
    { value: 'users', icon: Users, label: t('users') },
    { value: 'ai', icon: Bot, label: 'AI 管理' },
    { value: 'tasks', icon: FileClock, label: '任务队列' },
    { value: 'audit', icon: ClipboardCheck, label: '审计' },
    { value: 'templates', icon: FileSliders, label: '模板' },
    { value: 'commerce', icon: ReceiptText, label: t('commerce') },
    { value: 'settings', icon: Settings2, label: '设置' },
  ], [t]);

  const userStats = useMemo(() => ({
    total: users.length,
    admins: users.filter((user) => user.role === 'admin').length,
    password: users.filter((user) => ['password', 'credentials', 'email'].includes(user.authType)).length,
    credits: users.reduce((total, user) => total + Number(user.aiCreditBalance ?? user.aiCredits ?? 0), 0),
    consumed: users.reduce((total, user) => total + Number(user.aiCreditsConsumed || 0), 0),
    vip: users.filter((user) => user.isVip).length,
    anonymous: users.filter((user) => user.authType === 'fingerprint' && !user.email && user.name === 'Anonymous User').length,
  }), [users]);

  const filteredUsers = useMemo(() => {
    const query = userQuery.trim().toLowerCase();
    return users.filter((user) => {
      if (userRoleFilter !== 'all' && user.role !== userRoleFilter) return false;
      if (!query) return true;
      return [
        user.id,
        user.email,
        user.name,
        user.authType,
        user.role,
        user.membership?.planName,
        user.membership?.planKey,
        user.isVip ? 'vip' : 'non-vip',
        user.aiCreditBalance,
        user.aiCreditsConsumed,
        user.pointBalance,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [userQuery, userRoleFilter, users]);

  const filteredAdminAuditLogs = useMemo(() => {
    const query = adminAuditQuery.trim().toLowerCase();
    if (!query) return adminAuditLogs;
    return adminAuditLogs.filter((log) => [
      log.id,
      log.action,
      log.targetType,
      log.targetUserId,
      log.reason,
      log.admin?.email,
      log.admin?.name,
      JSON.stringify(log.before || {}),
      JSON.stringify(log.after || {}),
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [adminAuditLogs, adminAuditQuery]);

  const aiChannelStats = useMemo(() => ({
    total: channels.length,
    enabled: channels.filter((channel) => channel.enabled).length,
    disabled: channels.filter((channel) => !channel.enabled).length,
    providers: new Set(channels.map((channel) => channel.provider).filter(Boolean)).size,
  }), [channels]);

  const filteredAIChannels = useMemo(() => {
    const query = aiChannelQuery.trim().toLowerCase();
    return channels.filter((channel) => {
      if (aiChannelStatusFilter === 'enabled' && !channel.enabled) return false;
      if (aiChannelStatusFilter === 'disabled' && channel.enabled) return false;
      if (!query) return true;
      return [
        channel.name,
        channel.provider,
        channel.model,
        channel.baseUrl,
        channel.openAIEndpoint,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [aiChannelQuery, aiChannelStatusFilter, channels]);

  const templateStats = useMemo(() => ({
    total: templates.length,
    public: templates.filter((template) => template.isPublic).length,
    private: templates.filter((template) => !template.isPublic).length,
    installs: templates.reduce((total, template) => total + Number(template.installCount || 0), 0),
  }), [templates]);

  const filteredTemplates = useMemo(() => {
    const query = templateQuery.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesQuery = !query || [
        template.name,
        template.description,
        template.baseTemplate,
      ].some((value) => String(value || '').toLowerCase().includes(query));
      const matchesStatus =
        templateStatusFilter === 'all' ||
        (templateStatusFilter === 'public' && template.isPublic) ||
        (templateStatusFilter === 'private' && !template.isPublic);
      return matchesQuery && matchesStatus;
    });
  }, [templateQuery, templates, templateStatusFilter]);

  const jobTemplateStats = useMemo(() => ({
    total: jobTemplates.length,
    custom: jobTemplates.filter((template) => !template.builtin).length,
    enabled: jobTemplates.filter((template) => template.enabled).length,
    disabled: jobTemplates.filter((template) => !template.enabled).length,
  }), [jobTemplates]);

  const filteredJobTemplates = useMemo(() => {
    const query = jobTemplateQuery.trim().toLowerCase();
    return jobTemplates.filter((template) => {
      const matchesQuery = !query || [
        template.roleKey,
        template.title,
        template.industry,
        template.jd,
        ...template.keywords,
      ].some((value) => value.toLowerCase().includes(query));
      const matchesLevel = jobTemplateLevelFilter === 'all' || template.level === jobTemplateLevelFilter;
      const matchesSource =
        jobTemplateSourceFilter === 'all' ||
        (jobTemplateSourceFilter === 'builtin' && template.builtin) ||
        (jobTemplateSourceFilter === 'custom' && !template.builtin) ||
        (jobTemplateSourceFilter === 'enabled' && template.enabled) ||
        (jobTemplateSourceFilter === 'disabled' && !template.enabled);
      return matchesQuery && matchesLevel && matchesSource;
    });
  }, [jobTemplateLevelFilter, jobTemplateQuery, jobTemplateSourceFilter, jobTemplates]);

  const aiUsageStats = useMemo(() => ({
    total: aiUsage.length,
    charged: aiUsage.reduce((total, item) => total + Number(item.creditsCharged || 0), 0),
    failed: aiUsage.filter((item) => item.status !== 'success' && item.status !== 'reserved').length,
    tokens: aiUsage.reduce((total, item) => total + Number(item.totalTokens || 0), 0),
  }), [aiUsage]);

  const filteredAiUsage = useMemo(() => {
    const query = aiUsageQuery.trim().toLowerCase();
    return aiUsage.filter((item) => {
      if (aiUsageStatusFilter !== 'all' && item.status !== aiUsageStatusFilter) return false;
      if (!query) return true;
      return [
        item.feature,
        item.provider,
        item.model,
        item.status,
        item.user?.email,
        item.user?.name,
        item.userId,
        item.error,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [aiUsage, aiUsageQuery, aiUsageStatusFilter]);

  const resumeAnalysisStats = useMemo(() => ({
    total: resumeAnalysisJobs.length,
    active: resumeAnalysisJobs.filter((job) => ['queued', 'running', 'retrying'].includes(job.status)).length,
    succeeded: resumeAnalysisJobs.filter((job) => job.status === 'succeeded').length,
    failed: resumeAnalysisJobs.filter((job) => job.status === 'failed').length,
  }), [resumeAnalysisJobs]);

  const filteredResumeAnalysisJobs = useMemo(() => {
    const query = resumeAnalysisQuery.trim().toLowerCase();
    return resumeAnalysisJobs.filter((job) => {
      if (resumeAnalysisStatusFilter !== 'all' && job.status !== resumeAnalysisStatusFilter) return false;
      if (!query) return true;
      return [
        job.id,
        job.userId,
        job.resumeId,
        job.fileName,
        job.fileType,
        job.status,
        job.workerId,
        job.errorCode,
        job.errorMessage,
        job.user?.email,
        job.user?.name,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [resumeAnalysisJobs, resumeAnalysisQuery, resumeAnalysisStatusFilter]);

  const walletTransactionStats = useMemo(() => ({
    total: walletTransactions.length,
    credited: walletTransactions
      .filter((transaction) => transaction.direction === 'credit')
      .reduce((total, transaction) => total + Number(transaction.amount || 0), 0),
    debited: walletTransactions
      .filter((transaction) => transaction.direction === 'debit')
      .reduce((total, transaction) => total + Number(transaction.amount || 0), 0),
    users: new Set(walletTransactions.map((transaction) => transaction.userId)).size,
  }), [walletTransactions]);

  const filteredWalletTransactions = useMemo(() => {
    const query = walletTransactionQuery.trim().toLowerCase();
    return walletTransactions.filter((transaction) => {
      if (walletDirectionFilter !== 'all' && transaction.direction !== walletDirectionFilter) return false;
      if (!query) return true;
      return [
        transaction.currency,
        transaction.direction,
        transaction.source,
        transaction.sourceId,
        transaction.description,
        transaction.user?.email,
        transaction.user?.name,
        transaction.userId,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [walletDirectionFilter, walletTransactionQuery, walletTransactions]);

  const reviewCommentStats = useMemo(() => ({
    total: reviewComments.length,
    open: reviewComments.filter((comment) => comment.status === 'open').length,
    resolved: reviewComments.filter((comment) => comment.status === 'resolved').length,
    shares: new Set(reviewComments.map((comment) => comment.shareId)).size,
  }), [reviewComments]);

  const filteredReviewComments = useMemo(() => {
    const query = reviewCommentQuery.trim().toLowerCase();
    return reviewComments.filter((comment) => {
      if (reviewCommentStatusFilter !== 'all' && comment.status !== reviewCommentStatusFilter) return false;
      if (!query) return true;
      return [
        comment.authorName,
        comment.authorEmail,
        comment.content,
        comment.selectedText,
        comment.status,
        comment.resume?.title,
        comment.resume?.targetCompany,
        comment.resume?.targetJobTitle,
        comment.share?.label,
        comment.share?.token,
        comment.authorUser?.email,
        comment.authorUser?.name,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [reviewCommentQuery, reviewComments, reviewCommentStatusFilter]);

  const reviewPresenceStats = useMemo(() => {
    const activeSince = Date.now() - 2 * 60 * 1000;
    return {
      total: reviewPresence.length,
      active: reviewPresence.filter((presence) => {
        const lastSeen = presence.lastSeenAt ? new Date(presence.lastSeenAt).getTime() : 0;
        return Number.isFinite(lastSeen) && lastSeen >= activeSince;
      }).length,
      shares: new Set(reviewPresence.map((presence) => presence.shareId)).size,
      resumes: new Set(reviewPresence.map((presence) => presence.resumeId)).size,
    };
  }, [reviewPresence]);

  const filteredReviewPresence = useMemo(() => {
    const query = reviewPresenceQuery.trim().toLowerCase();
    if (!query) return reviewPresence;
    return reviewPresence.filter((presence) => [
      presence.reviewerName,
      presence.reviewerEmail,
      presence.user?.email,
      presence.user?.name,
      presence.userId,
      presence.resume?.title,
      presence.resume?.targetCompany,
      presence.resume?.targetJobTitle,
      presence.share?.label,
      presence.share?.token,
      presence.shareId,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [reviewPresence, reviewPresenceQuery]);

  const changeProposalStats = useMemo(() => ({
    total: changeProposals.length,
    pending: changeProposals.filter((proposal) => proposal.status === 'pending').length,
    applied: changeProposals.filter((proposal) => proposal.status === 'applied').length,
    rejected: changeProposals.filter((proposal) => proposal.status === 'rejected').length,
  }), [changeProposals]);

  const filteredChangeProposals = useMemo(() => {
    const query = changeProposalQuery.trim().toLowerCase();
    return changeProposals.filter((proposal) => {
      if (changeProposalStatusFilter !== 'all' && proposal.status !== changeProposalStatusFilter) return false;
      if (!query) return true;
      return [
        proposal.status,
        proposal.source,
        proposal.sectionType,
        proposal.targetField,
        proposal.current,
        proposal.suggested,
        proposal.reason,
        proposal.resume?.title,
        proposal.resume?.targetCompany,
        proposal.resume?.targetJobTitle,
        proposal.user?.email,
        proposal.user?.name,
        proposal.share?.label,
        proposal.share?.token,
        proposal.comment?.content,
      ].some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [changeProposalQuery, changeProposals, changeProposalStatusFilter]);

  const productStats = useMemo(() => ({
    total: products.length,
    active: products.filter((product) => product.active).length,
    inactive: products.filter((product) => !product.active).length,
    revenuePreview: products.reduce((total, product) => total + Number(product.priceCents || 0), 0),
  }), [products]);

  const filteredProducts = useMemo(() => {
    const query = productQuery.trim().toLowerCase();
    if (!query) return products;
    return products.filter((product) => [
      product.id,
      product.sku,
      product.type,
      product.name,
      product.description,
      product.resourceType,
      product.resourceId,
      product.currency,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [productQuery, products]);

  const orderStats = useMemo(() => ({
    total: orders.length,
    paid: orders.filter((order) => order.status === 'paid').length,
    fulfilled: orders.filter((order) => order.status === 'fulfilled').length,
    payable: orders.reduce((total, order) => total + Number(order.payableCents || 0), 0),
  }), [orders]);

  const filteredOrders = useMemo(() => {
    const query = orderQuery.trim().toLowerCase();
    if (!query) return orders;
    return orders.filter((order) => [
      order.id,
      order.orderNo,
      order.userId,
      order.status,
      order.source,
      order.currency,
      ...(order.items || []).map((item) => item.name),
      ...(order.payments || []).map((payment) => payment.provider),
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [orderQuery, orders]);

  const redeemCodeStats = useMemo(() => ({
    total: redeemCodes.length,
    active: redeemCodes.filter((code) => code.status === 'active').length,
    claimed: redeemCodes.reduce((total, code) => total + Number(code.claimedCount || 0), 0),
    maxClaims: redeemCodes.reduce((total, code) => total + Number(code.maxClaims || 0), 0),
  }), [redeemCodes]);

  const filteredRedeemCodes = useMemo(() => {
    const query = redeemCodeQuery.trim().toLowerCase();
    if (!query) return redeemCodes;
    return redeemCodes.filter((code) => [
      code.id,
      code.code,
      code.type,
      code.status,
      JSON.stringify(code.benefit || {}),
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [redeemCodeQuery, redeemCodes]);

  const dashboardStats = useMemo(() => ({
    users: users.length,
    admins: userStats.admins,
    aiChannels: aiChannelStats.enabled,
    aiCalls: aiUsageStats.total,
    aiTokens: aiUsageStats.tokens,
    storageConfigured: storageSettings.qiniu.configured,
    storageEnabled: storageSettings.qiniu.enabled,
    tasksActive: resumeAnalysisStats.active,
    tasksFailed: resumeAnalysisStats.failed,
    auditPending: reviewCommentStats.open + changeProposalStats.pending,
    walletRows: walletTransactionStats.total,
    commerceOrders: orders.length,
    commerceRevenue: orderStats.payable,
  }), [
    aiChannelStats.enabled,
    aiUsageStats.tokens,
    aiUsageStats.total,
    changeProposalStats.pending,
    orderStats.payable,
    orders.length,
    resumeAnalysisStats.active,
    resumeAnalysisStats.failed,
    reviewCommentStats.open,
    storageSettings.qiniu.configured,
    storageSettings.qiniu.enabled,
    userStats.admins,
    users.length,
    walletTransactionStats.total,
  ]);

  const load = async () => {
    try {
      const [channelsRes, authRes, storageRes, usersRes, templatesRes, jobTemplatesRes, productsRes, ordersRes, aiUsageRes, resumeAnalysisRes, walletTransactionsRes, adminAuditRes, reviewCommentsRes, reviewPresenceRes, changeProposalsRes, redeemRes, growthRes] = await Promise.all([
        fetch('/api/admin/ai-channels', { headers: getHeaders() }),
        fetch('/api/admin/auth-settings', { headers: getHeaders() }),
        fetch('/api/admin/storage-settings', { headers: getHeaders() }),
        fetch('/api/admin/users', { headers: getHeaders() }),
        fetch('/api/templates', { headers: getHeaders() }),
        fetch('/api/admin/job-templates', { headers: getHeaders() }),
        fetch('/api/admin/products?activeOnly=0', { headers: getHeaders() }),
        fetch(`/api/admin/orders?limit=50&status=${orderStatusFilter}`, { headers: getHeaders() }),
        fetch(`/api/admin/ai-usage?limit=100&status=${aiUsageStatusFilter}`, { headers: getHeaders() }),
        fetch(`/api/admin/resume-analysis-jobs?limit=100&status=${resumeAnalysisStatusFilter}`, { headers: getHeaders() }),
        fetch(`/api/admin/wallet-transactions?limit=100&direction=${walletDirectionFilter}`, { headers: getHeaders() }),
        fetch('/api/admin/audit-logs?limit=100', { headers: getHeaders() }),
        fetch(`/api/admin/review-comments?limit=100&status=${reviewCommentStatusFilter}`, { headers: getHeaders() }),
        fetch('/api/admin/review-presence?limit=100&minutes=30', { headers: getHeaders() }),
        fetch(`/api/admin/change-proposals?limit=100&status=${changeProposalStatusFilter}`, { headers: getHeaders() }),
        fetch('/api/admin/redeem-codes?limit=50', { headers: getHeaders() }),
        fetch('/api/admin/growth?limit=50', { headers: getHeaders() }),
      ]);

      if (!channelsRes.ok || !authRes.ok || !storageRes.ok || !usersRes.ok || !templatesRes.ok || !jobTemplatesRes.ok || !productsRes.ok || !ordersRes.ok || !aiUsageRes.ok || !resumeAnalysisRes.ok || !walletTransactionsRes.ok || !adminAuditRes.ok || !reviewCommentsRes.ok || !reviewPresenceRes.ok || !changeProposalsRes.ok || !redeemRes.ok || !growthRes.ok) {
        const forbidden = [channelsRes, authRes, storageRes, usersRes, jobTemplatesRes, productsRes, ordersRes, aiUsageRes, resumeAnalysisRes, walletTransactionsRes, adminAuditRes, reviewCommentsRes, reviewPresenceRes, changeProposalsRes, redeemRes, growthRes].some((res) => res.status === 403);
        setError(forbidden ? t('forbidden') : t('loadFailed'));
        return;
      }

      setChannels(await channelsRes.json());
      setUsers(await usersRes.json());
      setTemplates(await templatesRes.json());
      setStorageSettings(normalizeStorageSettings(await storageRes.json()));
      const loadedJobTemplates = await jobTemplatesRes.json();
      setJobTemplates([...(loadedJobTemplates.builtin || []), ...(loadedJobTemplates.custom || [])]);
      const loadedProducts = await productsRes.json();
      const loadedOrders = await ordersRes.json();
      const loadedAiUsage = await aiUsageRes.json();
      const loadedResumeAnalysis = await resumeAnalysisRes.json();
      const loadedWalletTransactions = await walletTransactionsRes.json();
      const loadedAdminAudit = await adminAuditRes.json();
      const loadedReviewComments = await reviewCommentsRes.json();
      const loadedReviewPresence = await reviewPresenceRes.json();
      const loadedChangeProposals = await changeProposalsRes.json();
      const loadedRedeemCodes = await redeemRes.json();
      const loadedGrowth = await growthRes.json();
      setProducts(Array.isArray(loadedProducts.products) ? loadedProducts.products : []);
      setOrders(Array.isArray(loadedOrders.orders) ? loadedOrders.orders : []);
      setAiUsage(Array.isArray(loadedAiUsage.usage) ? loadedAiUsage.usage : []);
      setResumeAnalysisJobs(Array.isArray(loadedResumeAnalysis.jobs) ? loadedResumeAnalysis.jobs : []);
      setWalletTransactions(Array.isArray(loadedWalletTransactions.transactions) ? loadedWalletTransactions.transactions : []);
      setAdminAuditLogs(Array.isArray(loadedAdminAudit.logs) ? loadedAdminAudit.logs : []);
      setReviewComments(Array.isArray(loadedReviewComments.comments) ? loadedReviewComments.comments : []);
      setReviewPresence(Array.isArray(loadedReviewPresence.presence) ? loadedReviewPresence.presence : []);
      setChangeProposals(Array.isArray(loadedChangeProposals.proposals) ? loadedChangeProposals.proposals : []);
      setRedeemCodes(Array.isArray(loadedRedeemCodes.redeemCodes) ? loadedRedeemCodes.redeemCodes : []);
      setGrowth(loadedGrowth && typeof loadedGrowth === 'object' ? loadedGrowth : null);
      const loadedAuth = await authRes.json();
      const loadedProviders: Record<string, OAuthProviderForm> = {};
      if (loadedAuth.providers && typeof loadedAuth.providers === 'object') {
        for (const [pid, pconf] of Object.entries(loadedAuth.providers as Record<string, Record<string, unknown>>)) {
          loadedProviders[pid] = {
            enabled: Boolean(pconf.enabled),
            configured: Boolean(pconf.configured),
            clientId: String(pconf.clientId || ''),
            issuer: String(pconf.issuer || ''),
            name: String(pconf.name || 'OIDC'),
            source: String(pconf.source || 'env'),
            callbackUrl: String(pconf.callbackUrl || ''),
            clientSecretSet: Boolean(pconf.clientSecretSet),
          };
        }
      }
      setAuthSettings({
        authMode: String(loadedAuth.authMode || 'local'),
        passwordLoginEnabled: Boolean(loadedAuth.passwordLoginEnabled),
        passwordRegisterEnabled: Boolean(loadedAuth.passwordRegisterEnabled),
        publicPasswordEnabled: Boolean(loadedAuth.publicPasswordEnabled),
        adminPasswordEnabled: Boolean(loadedAuth.adminPasswordEnabled),
        loginFooterText: String(loadedAuth.loginFooterText || ''),
        loginFooterLinkText: String(loadedAuth.loginFooterLinkText || ''),
        loginFooterLinkUrl: String(loadedAuth.loginFooterLinkUrl || ''),
        providers: loadedProviders,
      });
      setError('');
    } catch (error) {
      console.error('Admin load failed:', error);
      setError(t('loadFailed'));
    }
  };

  useEffect(() => {
    if (isLoading || status === 'loading') return;
    if (!isAdmin) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, status, isAdmin, orderStatusFilter, aiUsageStatusFilter, resumeAnalysisStatusFilter, walletDirectionFilter, reviewCommentStatusFilter, changeProposalStatusFilter]);

  const openCreateAIChannelDialog = () => {
    setEditingChannelId(null);
    setForm(EMPTY_AI_CHANNEL_FORM);
    setAiTestResult(null);
    setAiTestTargetChannelId(null);
    setAiChannelDialogOpen(true);
  };

  const openEditAIChannelDialog = (channel: AIChannel) => {
    setEditingChannelId(channel.id);
    setAiTestResult(null);
    setAiTestTargetChannelId(channel.id);
    setForm({
      name: channel.name,
      provider: channel.provider || 'openai',
      apiKey: '',
      baseUrl: channel.baseUrl,
      model: channel.model,
      openAIEndpoint: channel.openAIEndpoint || 'chat',
      weight: Number(channel.weight || 1),
    });
    setAiChannelDialogOpen(true);
  };

  const closeAIChannelDialog = () => {
    if (savingAIChannel || testingChannelId === (editingChannelId || 'new')) return;
    setAiChannelDialogOpen(false);
    setEditingChannelId(null);
    setForm(EMPTY_AI_CHANNEL_FORM);
    setAiTestTargetChannelId(null);
  };

  const testAIChannel = async (channel?: AIChannel) => {
    const targetId = channel?.id || editingChannelId || 'new';
    setTestingChannelId(targetId);
    setAiTestTargetChannelId(channel?.id || editingChannelId || null);
    setAiTestResult(null);
    setAiTestResultOpen(false);
    try {
      const payload = channel
        ? { id: channel.id, apiKey: channel.apiKey, provider: channel.provider, baseUrl: channel.baseUrl, model: channel.model, openAIEndpoint: channel.openAIEndpoint }
        : { ...(editingChannelId ? { id: editingChannelId } : {}), ...form };
      const res = await fetch('/api/admin/ai-channels/test', {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(payload),
      });
      const result = await res.json().catch(() => ({}));
      setAiTestResult(result as AIChannelTestResult);
      setAiTestResultOpen(true);
    } finally {
      setTestingChannelId(null);
    }
  };

  const copyAIChannelTestReport = async () => {
    if (!aiTestResult || typeof navigator === 'undefined' || !navigator.clipboard) return;
    await navigator.clipboard.writeText(stringifyReport(aiTestResult));
  };

  const applyAIChannelRecommendation = async () => {
    if (!aiTestResult) return;
    if (aiTestTargetChannelId) {
      await fetch(`/api/admin/ai-channels/${aiTestTargetChannelId}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({
          baseUrl: aiTestResult.recommendedBaseUrl,
          openAIEndpoint: aiTestResult.recommendedEndpoint,
          model: aiTestResult.model,
        }),
      });
      setAiTestResultOpen(false);
      await load();
      return;
    }
    setForm((current) => ({
      ...current,
      baseUrl: aiTestResult.recommendedBaseUrl || current.baseUrl,
      openAIEndpoint: aiTestResult.recommendedEndpoint || current.openAIEndpoint,
      model: aiTestResult.model || current.model,
    }));
    setAiTestResultOpen(false);
  };

  const openResumeAnalysisJobDetail = async (job: AdminResumeAnalysisJob, mode: 'detail' | 'preview') => {
    if (mode === 'preview' && (job.status !== 'succeeded' || !job.resumeId)) return;
    setLoadingResumeAnalysisJobId(`${mode}:${job.id}`);
    try {
      const res = await fetch(`/api/admin/resume-analysis-jobs/${job.id}`, { headers: getHeaders() });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(String(payload.error || '任务详情加载失败'));
        return;
      }
      setResumeAnalysisJobDetail(payload as AdminResumeAnalysisJobDetail);
      setResumeAnalysisDetailMode(mode);
      setError('');
    } catch (error) {
      console.error('Load resume analysis job detail failed:', error);
      setError('任务详情加载失败');
    } finally {
      setLoadingResumeAnalysisJobId(null);
    }
  };

  const saveAIChannel = async () => {
    setSavingAIChannel(true);
    const { apiKey, ...rest } = form;
    const payload = {
      ...rest,
      ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
    };
    const res = await fetch(editingChannelId ? `/api/admin/ai-channels/${editingChannelId}` : '/api/admin/ai-channels', {
      method: editingChannelId ? 'PATCH' : 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    setSavingAIChannel(false);
    if (!res.ok) {
      setError(t('loadFailed'));
      return;
    }
    setAiChannelDialogOpen(false);
    setEditingChannelId(null);
    setForm(EMPTY_AI_CHANNEL_FORM);
    setError('');
    await load();
  };

  const openAIChannelActionDialog = (channel: AIChannel, action: 'toggle' | 'delete') => {
    setAiActionChannel(channel);
    setAiActionType(action);
  };

  const closeAIChannelActionDialog = () => {
    if (deletingChannelId || togglingChannelId) return;
    setAiActionChannel(null);
    setAiActionType(null);
  };

  const confirmAIChannelAction = async () => {
    if (!aiActionChannel || !aiActionType) return;
    if (aiActionType === 'delete') {
      setDeletingChannelId(aiActionChannel.id);
      const res = await fetch(`/api/admin/ai-channels/${aiActionChannel.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      setDeletingChannelId(null);
      if (!res.ok) {
        setError(t('loadFailed'));
        return;
      }
    } else {
      setTogglingChannelId(aiActionChannel.id);
      const res = await fetch(`/api/admin/ai-channels/${aiActionChannel.id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ enabled: !aiActionChannel.enabled }),
      });
      setTogglingChannelId(null);
      if (!res.ok) {
        setError(t('loadFailed'));
        return;
      }
    }
    closeAIChannelActionDialog();
    setError('');
    await load();
  };

  const markDangerousCleanupPending = (target = '选中的测试数据') => {
    setError(`${target} 清理属于真实数据删除，需要老板明确确认后再接入执行。当前只保留选择和操作入口。`);
  };

  const openEditUserDialog = (user: AdminUser) => {
    setEditingUser(user);
    setUserEditForm({
      role: user.role === 'admin' ? 'admin' : 'user',
      aiCreditBalance: Math.max(0, Math.floor(Number(user.aiCreditBalance ?? user.aiCredits ?? 0))),
      reason: '',
    });
    setConfirmingUserEdit(false);
  };

  const closeEditUserDialog = () => {
    if (savingUserEdit) return;
    setEditingUser(null);
    setUserEditForm(EMPTY_USER_EDIT_FORM);
    setConfirmingUserEdit(false);
  };

  const userEditChanges = useMemo(() => {
    if (!editingUser) return [];
    const currentBalance = Math.max(0, Math.floor(Number(editingUser.aiCreditBalance ?? editingUser.aiCredits ?? 0)));
    const nextBalance = Math.max(0, Math.floor(Number(userEditForm.aiCreditBalance || 0)));
    const changes: Array<{ label: string; before: ReactNode; after: ReactNode }> = [];
    if (editingUser.role !== userEditForm.role) {
      changes.push({ label: '身份', before: editingUser.role, after: userEditForm.role });
    }
    if (currentBalance !== nextBalance) {
      changes.push({ label: 'AI 余额', before: currentBalance, after: nextBalance });
    }
    return changes;
  }, [editingUser, userEditForm.aiCreditBalance, userEditForm.role]);

  const requestUserEditConfirm = () => {
    if (!editingUser) return;
    if (userEditChanges.length === 0) {
      setError('没有检测到用户资料变更。');
      return;
    }
    if (!userEditForm.reason.trim()) {
      setError('请填写修改原因，所有用户变更都会进入审计日志。');
      return;
    }
    setError('');
    setConfirmingUserEdit(true);
  };

  const saveUserEdit = async () => {
    if (!editingUser) return;
    setSavingUserEdit(true);
    const res = await fetch(`/api/admin/users/${editingUser.id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({
        role: userEditForm.role,
        aiCreditBalance: Math.max(0, Math.floor(Number(userEditForm.aiCreditBalance) || 0)),
        reason: userEditForm.reason.trim(),
        confirmed: true,
      }),
    });
    setSavingUserEdit(false);
    if (!res.ok) {
      setError(t('loadFailed'));
      return;
    }
    const updated = await res.json();
    setUsers((prev) => prev.map((user) => user.id === editingUser.id ? { ...user, ...updated } : user));
    closeEditUserDialog();
    await load();
    setError('');
  };

  const saveAuthSettings = async () => {
    const payload = {
      authMode: authSettings.authMode,
      publicPasswordEnabled: authSettings.publicPasswordEnabled,
      adminPasswordEnabled: authSettings.adminPasswordEnabled,
      passwordRegisterEnabled: authSettings.passwordRegisterEnabled,
      loginFooterText: authSettings.loginFooterText,
      loginFooterLinkText: authSettings.loginFooterLinkText,
      loginFooterLinkUrl: authSettings.loginFooterLinkUrl,
    };
    const res = await fetch('/api/admin/auth-settings', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setError(t('loadFailed'));
      return;
    }
    const updated = await res.json();
    const updatedProviders: Record<string, OAuthProviderForm> = {};
    if (updated.providers && typeof updated.providers === 'object') {
      for (const [pid, pconf] of Object.entries(updated.providers as Record<string, Record<string, unknown>>)) {
        updatedProviders[pid] = {
          enabled: Boolean(pconf.enabled),
          configured: Boolean(pconf.configured),
          clientId: String(pconf.clientId || ''),
          issuer: String(pconf.issuer || ''),
          name: String(pconf.name || 'OIDC'),
          source: String(pconf.source || 'env'),
          callbackUrl: String(pconf.callbackUrl || ''),
          clientSecretSet: Boolean(pconf.clientSecretSet),
        };
      }
    }
    setAuthSettings({
      authMode: String(updated.authMode || authSettings.authMode),
      passwordLoginEnabled: Boolean(updated.passwordLoginEnabled),
      passwordRegisterEnabled: Boolean(updated.passwordRegisterEnabled),
      publicPasswordEnabled: Boolean(updated.publicPasswordEnabled),
      adminPasswordEnabled: Boolean(updated.adminPasswordEnabled),
      loginFooterText: String(updated.loginFooterText || ''),
      loginFooterLinkText: String(updated.loginFooterLinkText || ''),
      loginFooterLinkUrl: String(updated.loginFooterLinkUrl || ''),
      providers: updatedProviders,
    });
    setError('');
  };

  const saveStorageSettings = async () => {
    const res = await fetch('/api/admin/storage-settings', {
      method: 'PUT',
      headers: getHeaders(),
      body: JSON.stringify({ qiniu: storageSettings.qiniu }),
    });
    if (!res.ok) {
      setError(t('loadFailed'));
      return;
    }
    setStorageSettings(normalizeStorageSettings(await res.json()));
    setError('');
  };

  const editTemplate = (template: TemplateItem) => {
    setTemplateForm({
      id: template.id,
      name: template.name,
      description: template.description || '',
      baseTemplate: template.baseTemplate,
      themeJson: JSON.stringify(template.themeConfig || {}, null, 2),
      customCss: template.customCss || '',
      isPublic: !!template.isPublic,
    });
  };

  const copyTemplate = (template: TemplateItem) => {
    setTemplateForm({
      id: '',
      name: t('templateCopyName', { name: template.name }),
      description: template.description || '',
      baseTemplate: template.baseTemplate,
      themeJson: JSON.stringify(template.themeConfig || {}, null, 2),
      customCss: template.customCss || '',
      isPublic: false,
    });
  };

  const saveTemplate = async () => {
    let themeConfig: Record<string, unknown> = {};
    try {
      themeConfig = templateForm.themeJson.trim() ? JSON.parse(templateForm.themeJson) : {};
    } catch {
      setError(t('templateJsonInvalid'));
      return;
    }

    const payload = {
      name: templateForm.name,
      description: templateForm.description,
      baseTemplate: templateForm.baseTemplate,
      themeConfig,
      customCss: templateForm.customCss,
      isPublic: templateForm.isPublic,
    };

    const res = await fetch(templateForm.id ? `/api/templates/${templateForm.id}` : '/api/templates', {
      method: templateForm.id ? 'PATCH' : 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      setError(t('loadFailed'));
      return;
    }
    setTemplateForm(EMPTY_TEMPLATE_FORM);
    await load();
  };

  const parseLines = (value: string) => value
    .split(/[,，、;；\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  const editJobTemplate = (template: AdminJobTemplate) => {
    if (template.builtin) return;
    setJobTemplateForm({
      id: template.id,
      roleKey: template.roleKey,
      title: template.title,
      level: template.level,
      industry: template.industry,
      jd: template.jd,
      keywordsText: template.keywords.join('\n'),
      interviewQuestionsText: template.interviewQuestions.join('\n'),
      recommendedSectionsText: template.recommendedSections.join('\n'),
      enabled: template.enabled,
      sortOrder: template.sortOrder,
    });
  };

  const copyJobTemplate = (template: AdminJobTemplate) => {
    const nextSortOrder = Math.max(1000, ...jobTemplates.filter((item) => !item.builtin).map((item) => item.sortOrder)) + 10;
    const existingKeys = new Set(jobTemplates.map((item) => item.roleKey));
    let nextRoleKey = `${template.roleKey}-custom`;
    let suffix = 2;
    while (existingKeys.has(nextRoleKey)) {
      nextRoleKey = `${template.roleKey}-custom-${suffix}`;
      suffix += 1;
    }
    setJobTemplateForm({
      id: '',
      roleKey: nextRoleKey,
      title: t('jobTemplateCopyTitle', { title: template.title }),
      level: template.level,
      industry: template.industry,
      jd: template.jd,
      keywordsText: template.keywords.join('\n'),
      interviewQuestionsText: template.interviewQuestions.join('\n'),
      recommendedSectionsText: template.recommendedSections.join('\n'),
      enabled: true,
      sortOrder: nextSortOrder,
    });
  };

  const saveJobTemplate = async () => {
    const payload = {
      roleKey: jobTemplateForm.roleKey.trim(),
      title: jobTemplateForm.title.trim(),
      level: jobTemplateForm.level,
      industry: jobTemplateForm.industry.trim(),
      jd: jobTemplateForm.jd.trim(),
      keywords: parseLines(jobTemplateForm.keywordsText),
      interviewQuestions: parseLines(jobTemplateForm.interviewQuestionsText),
      recommendedSections: parseLines(jobTemplateForm.recommendedSectionsText),
      enabled: jobTemplateForm.enabled,
      sortOrder: Number(jobTemplateForm.sortOrder) || 1000,
    };
    const res = await fetch(jobTemplateForm.id ? `/api/admin/job-templates/${jobTemplateForm.id}` : '/api/admin/job-templates', {
      method: jobTemplateForm.id ? 'PATCH' : 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      if (res.status === 409 && data?.code === 'duplicate_role_key') {
        setError(t('jobTemplateRoleKeyDuplicate'));
        return;
      }
      if (res.status === 409 && data?.code === 'reserved_role_key') {
        setError(t('jobTemplateRoleKeyReserved'));
        return;
      }
      setError(t('loadFailed'));
      return;
    }
    setJobTemplateForm(EMPTY_JOB_TEMPLATE_FORM);
    await load();
  };

  const toggleJobTemplate = async (template: AdminJobTemplate) => {
    if (template.builtin) return;
    const res = await fetch(`/api/admin/job-templates/${template.id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ enabled: !template.enabled }),
    });
    if (!res.ok) {
      setError(t('loadFailed'));
      return;
    }
    await load();
  };

  const updateProduct = async (product: AdminProduct, patch: Partial<Pick<AdminProduct, 'priceCents' | 'active' | 'name' | 'description'>>) => {
    const res = await fetch(`/api/admin/products/${product.id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setError(t('loadFailed'));
      return;
    }
    const updated = await res.json();
    setProducts((prev) => prev.map((item) => item.id === product.id ? { ...item, ...updated } : item));
    setError('');
  };

  const createRedeemCode = async () => {
    let benefit: Record<string, unknown>;
    try {
      benefit = JSON.parse(redeemForm.benefitJson);
    } catch {
      setError(t('redeemJsonInvalid'));
      return;
    }

    const res = await fetch('/api/admin/redeem-codes', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        code: redeemForm.code,
        maxClaims: Number(redeemForm.maxClaims) || 1,
        benefit,
      }),
    });
    if (!res.ok) {
      setError(t('loadFailed'));
      return;
    }
    setRedeemForm(EMPTY_REDEEM_FORM);
    await load();
  };

  if (status === 'loading' || isLoading) {
    return <div className="rounded-xl border bg-white p-6 text-sm text-zinc-500">{t('loadFailed')}...</div>;
  }

  if (!isLoggedIn || error === t('forbidden') || !isAdmin) {
    return (
      <div className="mx-auto max-w-md rounded-xl border bg-white p-6 text-sm text-zinc-500 shadow-sm dark:bg-zinc-900">
        <div className="mb-4 flex items-center gap-2 text-base font-semibold text-zinc-900 dark:text-zinc-100">
          <ShieldCheck className="h-5 w-5 text-brand" />
          {t('adminLoginTitle')}
        </div>
        <p className="mb-4 text-sm text-zinc-500">{t('adminLoginDescription')}</p>
        <Suspense fallback={null}>
          <EmailAuthForm
            allowLogin
            allowRegister={false}
            callbackUrl={typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/admin'}
          />
        </Suspense>
        {isLoggedIn && <p className="mt-3 text-xs text-red-500">{t('forbidden')}</p>}
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t('subtitle')}</p>
      </div>

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <Tabs
        defaultValue="dashboard"
        orientation="vertical"
        className="flex-col gap-5 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]"
      >
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl border bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 max-lg:!flex-row max-lg:whitespace-nowrap lg:flex-col lg:overflow-visible">
            {adminTabs.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger key={item.value} value={item.value} className={ADMIN_TAB_TRIGGER_CLASS}>
                  <Icon className="h-4 w-4" />
                  <span className="truncate">{item.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </aside>

        <section className="min-w-0">
          <TabsContent value="dashboard" className="mt-0 space-y-4">
            <MetricStrip
              items={[
                { label: '用户 / 管理员', value: `${dashboardStats.users} / ${dashboardStats.admins}` },
                { label: 'AI 调用 / Token', value: `${dashboardStats.aiCalls} / ${dashboardStats.aiTokens.toLocaleString()}` },
                { label: '活跃任务 / 失败', value: `${dashboardStats.tasksActive} / ${dashboardStats.tasksFailed}`, tone: dashboardStats.tasksFailed > 0 ? 'warn' : 'default' },
                { label: '订单 / 金额', value: `${dashboardStats.commerceOrders} / ${money(dashboardStats.commerceRevenue)}` },
              ]}
            />

            <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)]">
              <div className="rounded-xl border bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                {DASHBOARD_DETAIL_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setDashboardDetail(item.value)}
                      className={cn(
                        'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-zinc-600 transition hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900',
                        dashboardDetail === item.value && 'bg-zinc-100 font-medium text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                {dashboardDetail === 'storage' && (
                  <div className="space-y-4">
                    <div>
                      <h2 className="text-base font-semibold">存储详情</h2>
                      <p className="mt-1 text-xs text-zinc-500">当前接口没有返回对象级占用，先展示真实配置状态和上传入口。</p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {[
                        ['Provider', 'Qiniu Cloud'],
                        ['状态', storageSettings.qiniu.enabled ? '启用' : '停用'],
                        ['配置', storageSettings.qiniu.configured ? '已配置' : '未配置'],
                        ['Bucket', storageSettings.qiniu.bucket || '-'],
                        ['Region', storageSettings.qiniu.region || '-'],
                        ['Public Read', storageSettings.qiniu.publicRead ? '是' : '否'],
                        ['Domain', storageSettings.qiniu.domain || '-'],
                        ['Upload Base URL', storageSettings.qiniu.uploadBaseUrl || '-'],
                      ].map(([label, value]) => (
                        <div key={label} className="rounded-lg border bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                          <div className="text-xs text-zinc-500">{label}</div>
                          <div className="mt-1 break-all font-medium">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {dashboardDetail === 'users' && (
                  <MetricStrip
                    items={[
                      { label: '用户总数', value: userStats.total },
                      { label: '管理员', value: userStats.admins },
                      { label: '密码登录用户', value: userStats.password },
                      { label: 'AI 额度余额', value: userStats.credits },
                    ]}
                  />
                )}
                {dashboardDetail === 'ai' && (
                  <MetricStrip
                    items={[
                      { label: '启用渠道', value: aiChannelStats.enabled },
                      { label: '渠道供应商', value: aiChannelStats.providers },
                      { label: '消耗额度', value: aiUsageStats.charged },
                      { label: '失败/退款', value: aiUsageStats.failed, tone: aiUsageStats.failed > 0 ? 'warn' : 'default' },
                    ]}
                  />
                )}
                {dashboardDetail === 'tasks' && (
                  <MetricStrip
                    items={[
                      { label: '总任务', value: resumeAnalysisStats.total },
                      { label: '活跃任务', value: resumeAnalysisStats.active },
                      { label: '成功', value: resumeAnalysisStats.succeeded, tone: 'good' },
                      { label: '失败', value: resumeAnalysisStats.failed, tone: resumeAnalysisStats.failed > 0 ? 'danger' : 'default' },
                    ]}
                  />
                )}
                {dashboardDetail === 'audit' && (
                  <MetricStrip
                    items={[
                      { label: '额度流水', value: walletTransactionStats.total },
                      { label: '开放评论', value: reviewCommentStats.open },
                      { label: '在线审阅', value: reviewPresenceStats.active },
                      { label: '待处理提案', value: changeProposalStats.pending, tone: changeProposalStats.pending > 0 ? 'warn' : 'default' },
                    ]}
                  />
                )}
                {dashboardDetail === 'commerce' && (
                  <MetricStrip
                    items={[
                      { label: '产品', value: productStats.total },
                      { label: '启用产品', value: productStats.active },
                      { label: '订单', value: orderStats.total },
                      { label: '兑换码领取', value: `${redeemCodeStats.claimed}/${redeemCodeStats.maxClaims}` },
                    ]}
                  />
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="users" className="mt-0">
            <AdminDataTable
              title={t('users')}
              description="列表只读展示；身份和余额必须进入编辑弹框确认，所有修改写入审计日志。"
              icon={Users}
              rows={filteredUsers}
              getRowId={(user) => user.id}
              selectedIds={selectedUserIds}
              onSelectedIdsChange={setSelectedUserIds}
              emptyText={users.length === 0 ? t('noUsers') : '没有匹配的用户'}
              metrics={(
                <MetricStrip
                  items={[
                    { label: '总用户', value: userStats.total },
                    { label: '管理员', value: userStats.admins },
                    { label: 'VIP', value: userStats.vip },
                    { label: '匿名用户', value: userStats.anonymous, tone: userStats.anonymous > 0 ? 'warn' : 'default' },
                    { label: 'AI 余额', value: userStats.credits },
                    { label: 'AI 消耗', value: userStats.consumed },
                  ]}
                />
              )}
              toolbar={(
                <>
                  <TableSearch value={userQuery} onChange={setUserQuery} placeholder="搜索用户、邮箱、ID、登录方式、会员状态" />
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={userRoleFilter}
                      onChange={(event) => setUserRoleFilter(event.target.value as UserRoleFilter)}
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                      aria-label="用户角色筛选"
                    >
                      {USER_ROLE_OPTIONS.map((role) => <option key={role} value={role}>{role === 'all' ? '全部角色' : role}</option>)}
                    </select>
                    <Button type="button" variant="outline" size="sm" onClick={load} className="gap-2">
                      <RefreshCw className="h-4 w-4" />刷新
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => markDangerousCleanupPending(`选中的 ${selectedUserIds.size} 个用户`)}
                      disabled={selectedUserIds.size === 0}
                      className="gap-2 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />清理
                    </Button>
                  </div>
                </>
              )}
              columns={[
                {
                  key: 'user',
                  header: '用户',
                  cell: (user) => (
                    <div className="min-w-0">
                      <p className="truncate font-medium">{user.name || user.email || shortId(user.id)}</p>
                      <p className="truncate text-xs text-zinc-500">{user.email || user.id}</p>
                    </div>
                  ),
                },
                { key: 'auth', header: '登录方式', cell: (user) => <Badge variant="secondary">{user.authType}</Badge> },
                {
                  key: 'role',
                  header: '身份',
                  cell: (user) => (
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={user.role === 'admin' ? 'secondary' : 'outline'}>{user.role}</Badge>
                      {user.isVip && <Badge variant="secondary">VIP</Badge>}
                    </div>
                  ),
                },
                {
                  key: 'wallet',
                  header: '余额 / 消耗',
                  cell: (user) => (
                    <div className="text-xs">
                      <div className="font-medium">AI {Number(user.aiCreditBalance ?? user.aiCredits ?? 0)}</div>
                      <div className="text-zinc-500">已消耗 {Number(user.aiCreditsConsumed || 0)}</div>
                      <div className="text-zinc-500">积分 {Number(user.pointBalance || 0)}</div>
                    </div>
                  ),
                },
                {
                  key: 'membership',
                  header: '会员',
                  cell: (user) => (
                    <div className="text-xs">
                      <div className="font-medium">{user.membership?.planName || (user.isVip ? 'VIP' : '非会员')}</div>
                      <div className="text-zinc-500">到期 {formatMembershipExpiry(user)}</div>
                      {user.membership?.cancelAtPeriodEnd && <Badge variant="outline" className="mt-1">到期取消</Badge>}
                    </div>
                  ),
                },
                { key: 'createdAt', header: '创建时间', cell: (user) => <span className="text-xs text-zinc-500">{formatDate(user.createdAt)}</span> },
              ]}
              renderRowActions={(user) => (
                <>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="预览用户" onClick={() => setError(`用户 ${user.email || user.id} 详情预览后续接入。`)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="编辑用户" onClick={() => openEditUserDialog(user)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="删除用户" onClick={() => markDangerousCleanupPending(user.email || user.id)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            />

            <Dialog open={!!editingUser} onOpenChange={(open) => { if (!open) closeEditUserDialog(); }}>
              <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                  <DialogTitle>编辑用户</DialogTitle>
                  <DialogDescription>
                    身份和余额修改会进入审计日志；请填写清晰原因后再提交。
                  </DialogDescription>
                </DialogHeader>
                {editingUser && (
                  <div className="space-y-4">
                    <div className="rounded-lg border bg-zinc-50 p-3 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                      <div className="font-medium">{editingUser.name || editingUser.email || shortId(editingUser.id)}</div>
                      <div className="mt-1 text-xs text-zinc-500">{editingUser.email || editingUser.id}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="secondary">{editingUser.authType}</Badge>
                        <Badge variant={editingUser.isVip ? 'secondary' : 'outline'}>{editingUser.membership?.planName || (editingUser.isVip ? 'VIP' : '非会员')}</Badge>
                        <Badge variant="outline">到期 {formatMembershipExpiry(editingUser)}</Badge>
                      </div>
                    </div>

                    <label className="grid gap-1 text-sm">
                      <span className="text-zinc-500">身份</span>
                      <select
                        value={userEditForm.role}
                        onChange={(event) => setUserEditForm((current) => ({ ...current, role: event.target.value === 'admin' ? 'admin' : 'user' }))}
                        className="h-10 rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </label>

                    <label className="grid gap-1 text-sm">
                      <span className="text-zinc-500">AI 余额</span>
                      <Input
                        type="number"
                        min={0}
                        value={userEditForm.aiCreditBalance}
                        onChange={(event) => setUserEditForm((current) => ({
                          ...current,
                          aiCreditBalance: Math.max(0, Math.floor(Number(event.target.value) || 0)),
                        }))}
                      />
                    </label>

                    <label className="grid gap-1 text-sm">
                      <span className="text-zinc-500">修改原因</span>
                      <Textarea
                        value={userEditForm.reason}
                        onChange={(event) => setUserEditForm((current) => ({ ...current, reason: event.target.value }))}
                        placeholder="例如：客服工单 #1234 调整额度 / 授权管理员"
                        className="min-h-24"
                      />
                    </label>
                  </div>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={closeEditUserDialog} disabled={savingUserEdit}>取消</Button>
                  <Button type="button" onClick={requestUserEditConfirm} disabled={!editingUser || savingUserEdit || userEditChanges.length === 0} className="gap-2">
                    <Save className="h-4 w-4" />提交修改
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <AlertDialog open={confirmingUserEdit} onOpenChange={(open) => { if (!open && !savingUserEdit) setConfirmingUserEdit(false); }}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>确认修改用户资料？</AlertDialogTitle>
                  <AlertDialogDescription>
                    此操作会立即生效，并写入管理审计日志。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="space-y-2 text-sm">
                  {userEditChanges.map((change) => (
                    <div key={change.label} className="grid grid-cols-[80px_1fr] gap-2 rounded-lg border bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/60">
                      <span className="text-zinc-500">{change.label}</span>
                      <span className="font-medium">{change.before} → {change.after}</span>
                    </div>
                  ))}
                  <div className="rounded-lg border bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60">
                    原因：{userEditForm.reason.trim()}
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={savingUserEdit}>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={saveUserEdit} disabled={savingUserEdit}>
                    {savingUserEdit ? '保存中' : '确认保存'}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

        <TabsContent value="auth" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" />{t('authSettings')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-500">{t('oauthHint')}</p>
              <div className="space-y-3 rounded-lg border bg-zinc-50 p-3 text-sm dark:bg-zinc-900/60">
                <label className="grid gap-1 text-sm">
                  <span className="text-zinc-500">{t('authMode')}</span>
                  <select
                    value={authSettings.authMode}
                    onChange={(event) => setAuthSettings((s) => ({ ...s, authMode: event.target.value }))}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="local">local</option>
                    <option value="oidc-only">oidc-only</option>
                    <option value="oidc-with-admin-password">oidc-with-admin-password</option>
                  </select>
                </label>
                <div className="grid gap-3 md:grid-cols-3">
                  <label className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
                    <span>{t('adminPasswordLogin')}</span>
                    <Switch checked={authSettings.adminPasswordEnabled} onCheckedChange={(checked) => setAuthSettings((s) => ({ ...s, adminPasswordEnabled: checked }))} />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
                    <span>{t('publicPasswordLogin')}</span>
                    <Switch checked={authSettings.publicPasswordEnabled} onCheckedChange={(checked) => setAuthSettings((s) => ({ ...s, publicPasswordEnabled: checked, passwordLoginEnabled: checked }))} />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
                    <span>{t('passwordRegister')}</span>
                    <Switch checked={authSettings.passwordRegisterEnabled} onCheckedChange={(checked) => setAuthSettings((s) => ({ ...s, passwordRegisterEnabled: checked }))} />
                  </label>
                </div>
              </div>

              {Object.keys(authSettings.providers).length > 0 && (
                <>
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('oidcProvider')}</h3>
                  {Object.entries(authSettings.providers).map(([providerId, providerConfig]) => (
                    <div key={providerId} className="space-y-3 rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{providerConfig.name || 'OIDC'}</p>
                          <p className="text-xs text-zinc-500">{t('oidcEnvOnly')}</p>
                        </div>
                        <Badge variant={providerConfig.configured ? 'secondary' : 'outline'}>
                          {providerConfig.configured ? t('configured') : t('notConfigured')}
                        </Badge>
                      </div>
                      <div className="grid gap-2 md:grid-cols-2">
                        <Input value={providerConfig.issuer || '-'} readOnly className="bg-zinc-50" aria-label={t('oidcIssuer')} />
                        <Input value={providerConfig.clientId || '-'} readOnly className="bg-zinc-50" aria-label={t('oauthClientId', { provider: providerConfig.name || 'OIDC' })} />
                        <Input value={providerConfig.clientSecretSet ? '••••••••' : '-'} readOnly className="bg-zinc-50" aria-label={t('oauthClientSecret', { provider: providerConfig.name || 'OIDC' })} />
                        <Input value={providerConfig.source || 'env'} readOnly className="bg-zinc-50" aria-label="source" />
                      </div>
                      <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">
                        <p className="font-medium">{t('oidcCallbackUrl')}</p>
                        <code className="break-all">{providerConfig.callbackUrl || '/api/auth/callback/oidc'}</code>
                      </div>
                    </div>
                  ))}
                </>
              )}

              <div className="space-y-2 rounded-lg border p-3">
                <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('loginFooter')}</h3>
                <Input value={authSettings.loginFooterText} onChange={(e) => setAuthSettings((s) => ({ ...s, loginFooterText: e.target.value }))} placeholder={t('loginFooterText')} />
                <div className="grid gap-2 md:grid-cols-2">
                  <Input value={authSettings.loginFooterLinkText} onChange={(e) => setAuthSettings((s) => ({ ...s, loginFooterLinkText: e.target.value }))} placeholder={t('loginFooterLinkText')} />
                  <Input value={authSettings.loginFooterLinkUrl} onChange={(e) => setAuthSettings((s) => ({ ...s, loginFooterLinkUrl: e.target.value }))} placeholder={t('loginFooterLinkUrl')} />
                </div>
              </div>

              <Button onClick={saveAuthSettings} className="cursor-pointer gap-2 bg-brand hover:bg-brand-hover"><Save className="h-4 w-4" />{t('save')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tasks" className="mt-0">
          <AdminDataTable
            title="简历分析任务"
            description="查看后台队列、worker、重试日志和失败原因。"
            icon={FileClock}
            rows={filteredResumeAnalysisJobs}
            getRowId={(job) => job.id}
            selectedIds={selectedResumeAnalysisJobIds}
            onSelectedIdsChange={setSelectedResumeAnalysisJobIds}
            emptyText={resumeAnalysisJobs.length === 0 ? '暂无简历分析任务' : '没有匹配的任务'}
            minWidth="1180px"
            metrics={(
              <MetricStrip
                items={[
                  { label: '总任务', value: resumeAnalysisStats.total },
                  { label: '活跃任务', value: resumeAnalysisStats.active },
                  { label: '成功', value: resumeAnalysisStats.succeeded, tone: 'good' },
                  { label: '失败', value: resumeAnalysisStats.failed, tone: resumeAnalysisStats.failed > 0 ? 'danger' : 'default' },
                ]}
              />
            )}
            toolbar={(
              <>
                <TableSearch value={resumeAnalysisQuery} onChange={setResumeAnalysisQuery} placeholder="搜索用户、文件、worker、错误信息" />
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={resumeAnalysisStatusFilter}
                    onChange={(event) => setResumeAnalysisStatusFilter(event.target.value)}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                  >
                    {RESUME_ANALYSIS_STATUS_OPTIONS.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>{statusOption === 'all' ? '全部状态' : statusOption}</option>
                    ))}
                  </select>
                  <Button type="button" variant="outline" size="sm" onClick={load} className="gap-2">
                    <RefreshCw className="h-4 w-4" />刷新
                  </Button>
                </div>
              </>
            )}
            columns={[
              {
                key: 'file',
                header: '文件 / 用户',
                cell: (job) => (
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-medium">{job.fileName}</span>
                      <Badge variant={job.status === 'succeeded' ? 'secondary' : job.status === 'failed' ? 'destructive' : 'outline'}>{job.status}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-zinc-500">{job.user?.email || job.user?.name || job.userId}</p>
                  </div>
                ),
              },
              {
                key: 'progress',
                header: '进度',
                cell: (job) => (
                  <div className="text-xs text-zinc-500">
                    <div className="font-medium text-zinc-950 dark:text-zinc-50">{job.progress}% · {job.attempts}/{job.maxAttempts}</div>
                    <div>位置 {job.position || '-'} · {formatBytes(job.fileSize)}</div>
                  </div>
                ),
              },
              {
                key: 'worker',
                header: 'Worker',
                cell: (job) => (
                  <div className="max-w-64 text-xs text-zinc-500">
                    <div className="truncate font-medium text-zinc-950 dark:text-zinc-50">{job.workerId || '-'}</div>
                    <div>心跳 {formatDateTime(job.lastHeartbeatAt)}</div>
                    {job.errorMessage && <div className="mt-1 line-clamp-2 text-red-600 dark:text-red-400">{job.errorCode || 'error'}：{job.errorMessage}</div>}
                  </div>
                ),
              },
              { key: 'createdAt', header: '创建时间', cell: (job) => <span className="text-xs text-zinc-500">{formatDateTime(job.createdAt)}</span> },
            ]}
            renderRowActions={(job) => (
              <>
                <Button type="button" variant="ghost" size="icon-xs" aria-label="查看任务详情" onClick={() => openResumeAnalysisJobDetail(job, 'detail')} disabled={loadingResumeAnalysisJobId === `detail:${job.id}`}>
                  <ListChecks className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="预览解析结果"
                  title={job.status === 'succeeded' && job.resumeId ? '预览解析结果' : '任务未成功，不允许预览'}
                  onClick={() => openResumeAnalysisJobDetail(job, 'preview')}
                  disabled={loadingResumeAnalysisJobId === `preview:${job.id}` || job.status !== 'succeeded' || !job.resumeId}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
              </>
            )}
          />

          <Dialog open={!!resumeAnalysisJobDetail} onOpenChange={(open) => { if (!open) setResumeAnalysisJobDetail(null); }}>
            <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-6xl">
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  简历分析任务详情
                  {resumeAnalysisJobDetail?.job && (
                    <Badge variant={resumeAnalysisJobDetail.job.status === 'succeeded' ? 'secondary' : resumeAnalysisJobDetail.job.status === 'failed' ? 'destructive' : 'outline'}>
                      {resumeAnalysisJobDetail.job.status}
                    </Badge>
                  )}
                </DialogTitle>
                <DialogDescription className="break-words">
                  {resumeAnalysisJobDetail?.job.fileName || '查看任务解析过程、结果和错误上下文。'}
                </DialogDescription>
              </DialogHeader>

              {resumeAnalysisJobDetail && (() => {
                const { job, user, resume } = resumeAnalysisJobDetail;
                const logs = normalizeJobLogs(job.logs);
                const aiTrace = getResumeAnalysisTrace(job);
                const probeFailure = firstProbeFailure(aiTrace);
                const defaultTab = resumeAnalysisDetailMode === 'preview' && resume ? 'result' : 'overview';
                return (
                  <Tabs defaultValue={defaultTab} className="space-y-4">
                    <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg border bg-white p-1 dark:border-zinc-800 dark:bg-zinc-950">
                      <TabsTrigger value="overview">概览</TabsTrigger>
                      <TabsTrigger value="result" disabled={!resume}>解析结果</TabsTrigger>
                      <TabsTrigger value="logs">过程日志</TabsTrigger>
                      <TabsTrigger value="raw">原始数据</TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="mt-0 space-y-4">
                      <div className={cn(
                        'rounded-lg border px-3 py-2 text-sm',
                        job.status === 'failed'
                          ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'
                          : 'bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-200',
                      )}>
                        <div className="font-medium">{job.status === 'failed' ? '任务失败，不允许预览解析结果' : '任务状态'}</div>
                        <div className="mt-1 break-words text-xs">
                          {job.errorMessage ? `${job.errorCode || 'error'}：${job.errorMessage}` : `进度 ${job.progress}% · 尝试 ${job.attempts}/${job.maxAttempts}`}
                        </div>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        {[
                          ['任务 ID', job.id],
                          ['用户', user?.email || user?.name || job.userId],
                          ['文件', `${job.fileName} · ${job.fileType}`],
                          ['大小', formatBytes(job.fileSize)],
                          ['模板 / 语言', `${job.template || '-'} / ${job.language || '-'}`],
                          ['Worker', job.workerId || '-'],
                          ['生成简历', job.resumeId || '-'],
                          ['队列位置', job.position || '-'],
                          ['创建时间', formatDateTime(job.createdAt)],
                          ['开始时间', formatDateTime(job.startedAt)],
                          ['心跳时间', formatDateTime(job.lastHeartbeatAt)],
                          ['完成时间', formatDateTime(job.finishedAt)],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-lg border bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                            <div className="text-xs text-zinc-500">{label}</div>
                            <div className="mt-1 break-all font-medium text-zinc-950 dark:text-zinc-50">{value}</div>
                          </div>
                        ))}
                      </div>

                      {aiTrace && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium">AI 调用诊断 trace</div>
                            <Badge variant="outline">{aiTrace.stage || 'unknown-stage'}</Badge>
                            <Badge variant={aiTrace.diagnosticProbe?.ok ? 'secondary' : 'destructive'}>
                              探针 {aiTrace.diagnosticProbe?.ok ? '通过' : '失败'}
                            </Badge>
                          </div>
                          <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {[
                              ['渠道', `${aiTrace.provider || '-'} · ${aiTrace.openAIEndpoint || '-'}`],
                              ['模型', aiTrace.model || '-'],
                              ['请求地址', aiTrace.transportURL || aiTrace.baseURL || '-'],
                              ['文件输入', `${aiTrace.file?.type || '-'} · ${formatBytes(aiTrace.file?.size)}`],
                              ['消息结构', `${aiTrace.request?.messageCount || 0} msg · ${aiTrace.request?.imageCount || 0} image · ${aiTrace.request?.textCharCount || 0} chars`],
                              ['JSON 输出', aiTrace.request?.outputJson ? '开启' : '关闭'],
                              ['错误', `${aiTrace.error?.name || '-'}：${aiTrace.error?.message || '-'}`],
                              ['探针建议', `${aiTrace.diagnosticProbe?.recommendedEndpoint || '-'} · ${aiTrace.diagnosticProbe?.recommendedBaseUrl || '-'}`],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-md border border-amber-200/80 bg-white/70 px-3 py-2 dark:border-amber-900/60 dark:bg-zinc-950/40">
                                <div className="text-xs text-amber-700 dark:text-amber-300">{label}</div>
                                <div className="mt-1 break-all font-medium">{value}</div>
                              </div>
                            ))}
                          </div>
                          {probeFailure && (
                            <div className="mt-3 rounded-md border border-amber-200/80 bg-white/70 px-3 py-2 text-xs dark:border-amber-900/60 dark:bg-zinc-950/40">
                              <div className="font-medium">首个失败探针</div>
                              <div className="mt-1 break-words">{probeFailure.endpoint || '-'}：{probeFailure.message || '-'}</div>
                              {probeFailure.response?.bodyText && <pre className="mt-2 max-h-32 overflow-auto rounded bg-zinc-950 p-2 text-zinc-100">{probeFailure.response.bodyText}</pre>}
                            </div>
                          )}
                          {aiTrace.hints && aiTrace.hints.length > 0 && (
                            <div className="mt-3 space-y-1 text-xs">
                              {aiTrace.hints.map((hint) => <div key={hint}>- {hint}</div>)}
                            </div>
                          )}
                        </div>
                      )}

                      {job.metadata && (
                        <details open className="rounded-lg border p-3 dark:border-zinc-800">
                          <summary className="cursor-pointer text-sm font-medium">任务 metadata</summary>
                          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100">{stringifyReport(job.metadata)}</pre>
                        </details>
                      )}
                    </TabsContent>

                    <TabsContent value="result" className="mt-0 space-y-4">
                      {resume ? (
                        <>
                          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            {[
                              ['简历标题', resume.title],
                              ['简历 ID', resume.id],
                              ['模板 / 语言', `${resume.template} / ${resume.language}`],
                              ['章节数', resume.sections?.length || 0],
                              ['创建时间', formatDateTime(resume.createdAt)],
                              ['更新时间', formatDateTime(resume.updatedAt)],
                            ].map(([label, value]) => (
                              <div key={label} className="rounded-lg border bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900/60">
                                <div className="text-xs text-zinc-500">{label}</div>
                                <div className="mt-1 break-all font-medium text-zinc-950 dark:text-zinc-50">{value}</div>
                              </div>
                            ))}
                          </div>
                          <div className="overflow-auto rounded-lg border dark:border-zinc-800">
                            <table className="w-full min-w-[760px] text-left text-sm">
                              <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">
                                <tr>
                                  <th className="px-3 py-2">章节</th>
                                  <th className="px-3 py-2">类型</th>
                                  <th className="px-3 py-2">可见</th>
                                  <th className="px-3 py-2">解析摘要</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(resume.sections || []).map((section) => (
                                  <tr key={section.id} className="border-t dark:border-zinc-800">
                                    <td className="px-3 py-2 font-medium">{section.title}</td>
                                    <td className="px-3 py-2 text-xs text-zinc-500">{section.type}</td>
                                    <td className="px-3 py-2"><Badge variant={section.visible ? 'secondary' : 'outline'}>{section.visible ? '显示' : '隐藏'}</Badge></td>
                                    <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-300">{summarizeSectionContent(section.content)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </>
                      ) : (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                          当前任务未成功生成简历，不能预览解析结果。请在“概览”和“过程日志”中查看失败原因。
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="logs" className="mt-0 space-y-3">
                      {logs.length === 0 ? (
                        <p className="text-sm text-zinc-400">暂无过程日志</p>
                      ) : logs.map((log, index) => (
                        <div key={`${log.at}-${index}`} className="rounded-lg border p-3 text-sm dark:border-zinc-800">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={log.level === 'error' ? 'destructive' : log.level === 'warn' ? 'outline' : 'secondary'}>{log.level}</Badge>
                            <span className="font-medium">{log.message}</span>
                            <span className="text-xs text-zinc-500">{formatDateTime(log.at)}</span>
                          </div>
                          <div className="mt-1 text-xs text-zinc-500">worker {log.workerId || '-'} · attempt {log.attempt || '-'}</div>
                          {log.metadata && (
                            <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100">{stringifyReport(log.metadata)}</pre>
                          )}
                        </div>
                      ))}
                    </TabsContent>

                    <TabsContent value="raw" className="mt-0 space-y-3">
                      <details open className="rounded-lg border p-3 dark:border-zinc-800">
                        <summary className="cursor-pointer text-sm font-medium">任务 JSON</summary>
                        <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100">{stringifyReport(job)}</pre>
                      </details>
                      {resume && (
                        <details className="rounded-lg border p-3 dark:border-zinc-800">
                          <summary className="cursor-pointer text-sm font-medium">解析后简历 JSON</summary>
                          <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100">{stringifyReport(resume)}</pre>
                        </details>
                      )}
                    </TabsContent>
                  </Tabs>
                );
              })()}

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setResumeAnalysisJobDetail(null)}>关闭</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="audit" className="mt-0">
          <div className="space-y-4">
            <MetricStrip
              items={[
                { label: '管理操作', value: adminAuditLogs.length },
                { label: '额度流水', value: walletTransactionStats.total },
                { label: '开放评论', value: reviewCommentStats.open },
                { label: '在线审阅', value: reviewPresenceStats.active },
                { label: '待处理提案', value: changeProposalStats.pending, tone: changeProposalStats.pending > 0 ? 'warn' : 'default' },
              ]}
            />
            <div className="flex gap-2 overflow-x-auto rounded-xl border bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              {AUDIT_PANEL_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setAuditPanel(item.value)}
                    className={cn(
                      'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm text-zinc-600 transition hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900',
                      auditPanel === item.value && 'bg-zinc-100 font-medium text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {auditPanel === 'admin' && (
              <AdminDataTable
                title="管理操作"
                description="记录后台对用户身份、余额等关键字段的修改。"
                icon={ShieldCheck}
                rows={filteredAdminAuditLogs}
                getRowId={(log) => log.id}
                selectedIds={selectedAdminAuditLogIds}
                onSelectedIdsChange={setSelectedAdminAuditLogIds}
                emptyText={adminAuditLogs.length === 0 ? '暂无管理操作审计' : '没有匹配的管理操作'}
                minWidth="1100px"
                toolbar={(
                  <>
                    <TableSearch value={adminAuditQuery} onChange={setAdminAuditQuery} placeholder="搜索操作人、目标用户、原因、变更内容" />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="h-4 w-4" />刷新</Button>
                    </div>
                  </>
                )}
                columns={[
                  {
                    key: 'action',
                    header: '操作',
                    cell: (log) => (
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{log.action}</span>
                          <Badge variant="outline">{log.targetType}</Badge>
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-500">{log.reason || '-'}</p>
                      </div>
                    ),
                  },
                  { key: 'admin', header: '操作人', cell: (log) => <div className="min-w-0"><p className="truncate font-medium">{log.admin?.name || log.admin?.email || log.adminUserId}</p><p className="truncate text-xs text-zinc-500">{log.admin?.email || log.admin?.role || '-'}</p></div> },
                  { key: 'target', header: '目标用户', cell: (log) => <span className="text-xs text-zinc-500">{log.targetUserId || '-'}</span> },
                  {
                    key: 'changes',
                    header: '变更',
                    cell: (log) => (
                      <div className="max-w-[360px] space-y-1 text-xs">
                        {Object.keys(log.after || {}).length === 0 ? '-' : Object.entries(log.after || {}).map(([key, value]) => (
                          <div key={key} className="truncate">
                            <span className="text-zinc-500">{key}: </span>
                            <span>{auditValue(log.before?.[key])} → {auditValue(value)}</span>
                          </div>
                        ))}
                      </div>
                    ),
                  },
                  { key: 'createdAt', header: '时间', cell: (log) => <span className="text-xs text-zinc-500">{formatDateTime(log.createdAt)}</span> },
                ]}
                renderRowActions={(log) => (
                  <>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="预览审计" onClick={() => setError(`审计 ${log.id}: ${JSON.stringify({ before: log.before, after: log.after })}`)}><Eye className="h-3.5 w-3.5" /></Button>
                  </>
                )}
              />
            )}

            {auditPanel === 'wallet' && (
              <AdminDataTable
                title={t('walletTransactions')}
                description={t('walletTransactionsHint')}
                icon={Coins}
                rows={filteredWalletTransactions}
                getRowId={(transaction) => transaction.id}
                selectedIds={selectedWalletTransactionIds}
                onSelectedIdsChange={setSelectedWalletTransactionIds}
                emptyText={walletTransactions.length === 0 ? t('noWalletTransactions') : t('noWalletTransactionMatches')}
                minWidth="1100px"
                toolbar={(
                  <>
                    <TableSearch value={walletTransactionQuery} onChange={setWalletTransactionQuery} placeholder={t('walletTransactionSearchPlaceholder')} />
                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={walletDirectionFilter}
                        onChange={(event) => setWalletDirectionFilter(event.target.value)}
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                      >
                        {WALLET_TRANSACTION_DIRECTION_OPTIONS.map((direction) => (
                          <option key={direction} value={direction}>{direction === 'all' ? t('allWalletTransactionDirections') : direction}</option>
                        ))}
                      </select>
                      <Button type="button" variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="h-4 w-4" />刷新</Button>
                    </div>
                  </>
                )}
                columns={[
                  {
                    key: 'source',
                    header: '来源',
                    cell: (transaction) => (
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{transaction.source}</span>
                          <Badge variant={transaction.direction === 'credit' ? 'secondary' : 'outline'}>{transaction.direction}</Badge>
                          <Badge variant="outline">{transaction.currency}</Badge>
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-500">{transaction.description || transaction.sourceId || '-'}</p>
                      </div>
                    ),
                  },
                  { key: 'user', header: '用户', cell: (transaction) => <div className="min-w-0"><p className="truncate font-medium">{transaction.user?.name || transaction.user?.email || transaction.userId}</p><p className="truncate text-xs text-zinc-500">{transaction.user?.email || transaction.user?.role || '-'}</p></div> },
                  { key: 'amount', header: '金额', cell: (transaction) => <div className="text-xs"><div className="font-medium">{transaction.direction === 'credit' ? '+' : '-'}{Number(transaction.amount || 0)}</div><div className="text-zinc-500">{t('walletBalanceAfter')}: {Number(transaction.balanceAfter || 0)}</div></div> },
                  { key: 'createdAt', header: '时间', cell: (transaction) => <span className="text-xs text-zinc-500">{formatDateTime(transaction.createdAt)}</span> },
                ]}
                renderRowActions={(transaction) => (
                  <>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="预览流水" onClick={() => setError(`流水 ${transaction.id} 详情预览后续接入。`)}><Eye className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="编辑流水" onClick={() => setError('额度流水为审计记录，默认不提供编辑。')}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="删除流水" onClick={() => markDangerousCleanupPending(`流水 ${transaction.id}`)} className="text-red-600 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </>
                )}
              />
            )}

            {auditPanel === 'comments' && (
              <AdminDataTable
                title={t('reviewComments')}
                description={t('reviewCommentsHint')}
                icon={MessageSquareText}
                rows={filteredReviewComments}
                getRowId={(comment) => comment.id}
                selectedIds={selectedReviewCommentIds}
                onSelectedIdsChange={setSelectedReviewCommentIds}
                emptyText={reviewComments.length === 0 ? t('noReviewComments') : t('noReviewCommentMatches')}
                minWidth="1120px"
                toolbar={(
                  <>
                    <TableSearch value={reviewCommentQuery} onChange={setReviewCommentQuery} placeholder={t('reviewCommentSearchPlaceholder')} />
                    <select value={reviewCommentStatusFilter} onChange={(event) => setReviewCommentStatusFilter(event.target.value as ReviewCommentStatusFilter)} className="h-9 rounded-md border bg-background px-3 text-sm">
                      {REVIEW_COMMENT_STATUS_OPTIONS.map((statusOption) => <option key={statusOption} value={statusOption}>{statusOption === 'all' ? t('allReviewCommentStatuses') : statusOption}</option>)}
                    </select>
                  </>
                )}
                columns={[
                  { key: 'content', header: '内容', cell: (comment) => <div className="max-w-md"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{comment.resume?.title || comment.resumeId}</span><Badge variant={comment.status === 'resolved' ? 'secondary' : 'outline'}>{comment.status}</Badge></div><p className="mt-1 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-200">{comment.content}</p></div> },
                  { key: 'author', header: '作者', cell: (comment) => <div className="min-w-0 text-xs"><p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{comment.authorUser?.name || comment.authorName || '-'}</p><p className="truncate text-zinc-500">{comment.authorUser?.email || comment.authorEmail || '-'}</p></div> },
                  { key: 'share', header: '分享', cell: (comment) => <span className="text-xs text-zinc-500">{comment.share?.label || comment.share?.token || shortId(comment.shareId)}</span> },
                  { key: 'createdAt', header: '时间', cell: (comment) => <span className="text-xs text-zinc-500">{formatDate(comment.createdAt)}</span> },
                ]}
                renderRowActions={(comment) => (
                  <>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="预览评论" onClick={() => setError(`评论 ${comment.id} 详情预览后续接入。`)}><Eye className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="编辑评论" onClick={() => setError('评论状态编辑后续接入。')}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="删除评论" onClick={() => markDangerousCleanupPending(`评论 ${comment.id}`)} className="text-red-600 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </>
                )}
              />
            )}

            {auditPanel === 'presence' && (
              <AdminDataTable
                title={t('reviewPresence')}
                description={t('reviewPresenceHint')}
                icon={Radio}
                rows={filteredReviewPresence}
                getRowId={(presence) => presence.id}
                selectedIds={selectedReviewPresenceIds}
                onSelectedIdsChange={setSelectedReviewPresenceIds}
                emptyText={reviewPresence.length === 0 ? t('noReviewPresence') : t('noReviewPresenceMatches')}
                minWidth="980px"
                toolbar={<TableSearch value={reviewPresenceQuery} onChange={setReviewPresenceQuery} placeholder={t('reviewPresenceSearchPlaceholder')} />}
                columns={[
                  { key: 'reviewer', header: '审阅人', cell: (presence) => <div className="min-w-0"><div className="flex items-center gap-2"><span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: presence.color || '#10b981' }} /><span className="truncate font-medium">{presence.user?.name || presence.reviewerName || presence.user?.email || presence.userId}</span></div><p className="mt-1 truncate text-xs text-zinc-500">{presence.user?.email || presence.reviewerEmail || '-'}</p></div> },
                  { key: 'resume', header: '简历', cell: (presence) => <div className="min-w-0 text-xs"><p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{presence.resume?.title || presence.resumeId}</p><p className="truncate text-zinc-500">{presence.share?.label || presence.share?.token || presence.shareId}</p></div> },
                  { key: 'cursor', header: '光标', cell: (presence) => <span className="text-xs text-zinc-500">{Math.round(presence.cursorX)}%, {Math.round(presence.cursorY)}%</span> },
                  { key: 'lastSeen', header: '最后在线', cell: (presence) => <span className="text-xs text-zinc-500">{formatDateTime(presence.lastSeenAt)}</span> },
                ]}
                renderRowActions={(presence) => (
                  <>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="预览实时审阅" onClick={() => setError(`实时审阅 ${presence.id} 详情预览后续接入。`)}><Eye className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="编辑实时审阅" onClick={() => setError('实时审阅记录默认不提供编辑。')}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="清理实时审阅" onClick={() => markDangerousCleanupPending(`实时审阅 ${presence.id}`)} className="text-red-600 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </>
                )}
              />
            )}

            {auditPanel === 'proposals' && (
              <AdminDataTable
                title={t('changeProposals')}
                description={t('changeProposalsHint')}
                icon={ClipboardCheck}
                rows={filteredChangeProposals}
                getRowId={(proposal) => proposal.id}
                selectedIds={selectedChangeProposalIds}
                onSelectedIdsChange={setSelectedChangeProposalIds}
                emptyText={changeProposals.length === 0 ? t('noChangeProposals') : t('noChangeProposalMatches')}
                minWidth="1160px"
                toolbar={(
                  <>
                    <TableSearch value={changeProposalQuery} onChange={setChangeProposalQuery} placeholder={t('changeProposalSearchPlaceholder')} />
                    <select value={changeProposalStatusFilter} onChange={(event) => setChangeProposalStatusFilter(event.target.value as ChangeProposalStatusFilter)} className="h-9 rounded-md border bg-background px-3 text-sm">
                      {CHANGE_PROPOSAL_STATUS_OPTIONS.map((statusOption) => <option key={statusOption} value={statusOption}>{statusOption === 'all' ? t('allChangeProposalStatuses') : statusOption}</option>)}
                    </select>
                  </>
                )}
                columns={[
                  { key: 'proposal', header: '提案', cell: (proposal) => <div className="max-w-md"><div className="flex flex-wrap items-center gap-2"><span className="font-medium">{proposal.resume?.title || proposal.resumeId}</span><Badge variant={proposal.status === 'pending' ? 'outline' : proposal.status === 'applied' ? 'secondary' : 'destructive'}>{proposal.status}</Badge><Badge variant="secondary">{proposal.sectionType}</Badge></div><p className="mt-1 line-clamp-2 text-sm text-zinc-700 dark:text-zinc-200">{proposal.suggested}</p></div> },
                  { key: 'user', header: '用户', cell: (proposal) => <span className="text-xs text-zinc-500">{proposal.user?.name || proposal.user?.email || proposal.userId || '-'}</span> },
                  { key: 'field', header: '字段', cell: (proposal) => <span className="text-xs text-zinc-500">{proposal.targetField}</span> },
                  { key: 'createdAt', header: '时间', cell: (proposal) => <span className="text-xs text-zinc-500">{formatDate(proposal.createdAt)}</span> },
                ]}
                renderRowActions={(proposal) => (
                  <>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="预览提案" onClick={() => setError(`提案 ${proposal.id} 详情预览后续接入。`)}><Eye className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="编辑提案" onClick={() => setError('提案审批操作后续接入。')}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button type="button" variant="ghost" size="icon-xs" aria-label="删除提案" onClick={() => markDangerousCleanupPending(`提案 ${proposal.id}`)} className="text-red-600 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </>
                )}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="storage" className="mt-0">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><HardDrive className="h-4 w-4" />{t('storageSettings')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-zinc-500">{t('storageSettingsHint')}</p>
              <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-zinc-50 p-3 text-sm dark:bg-zinc-900/60">
                <Badge variant="secondary">Qiniu Cloud</Badge>
                <Badge variant={storageSettings.qiniu.configured ? 'secondary' : 'outline'}>
                  {storageSettings.qiniu.configured ? t('configured') : t('notConfigured')}
                </Badge>
                <Badge variant="outline">{t('storageSource')}: {storageSettings.qiniu.source || 'none'}</Badge>
                {storageSettings.qiniu.uploadBaseUrl && (
                  <code className="break-all text-xs text-zinc-500">{storageSettings.qiniu.uploadBaseUrl}</code>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
                  <span>{t('storageEnabled')}</span>
                  <Switch checked={storageSettings.qiniu.enabled} onCheckedChange={(checked) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, enabled: checked } }))} />
                </label>
                <label className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
                  <span>{t('qiniuPublicRead')}</span>
                  <Switch checked={storageSettings.qiniu.publicRead} onCheckedChange={(checked) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, publicRead: checked } }))} />
                </label>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={storageSettings.qiniu.accessKey} onChange={(e) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, accessKey: e.target.value } }))} placeholder={t('qiniuAccessKey')} />
                <Input value={storageSettings.qiniu.secretKey} onChange={(e) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, secretKey: e.target.value } }))} placeholder={storageSettings.qiniu.secretKeySet ? t('qiniuSecretKeySet') : t('qiniuSecretKey')} type="password" />
                <Input value={storageSettings.qiniu.bucket} onChange={(e) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, bucket: e.target.value } }))} placeholder={t('qiniuBucket')} />
                <select
                  value={storageSettings.qiniu.region}
                  onChange={(event) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, region: event.target.value } }))}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  aria-label={t('qiniuRegion')}
                >
                  {QINIU_REGION_OPTIONS.map((region) => <option key={region} value={region}>{region}</option>)}
                </select>
                <Input value={storageSettings.qiniu.domain} onChange={(e) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, domain: e.target.value } }))} placeholder={t('qiniuDomain')} />
                <select
                  value={storageSettings.qiniu.protocol}
                  onChange={(event) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, protocol: event.target.value === 'http' ? 'http' : 'https' } }))}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  aria-label={t('qiniuProtocol')}
                >
                  <option value="https">https</option>
                  <option value="http">http</option>
                </select>
                <Input value={storageSettings.qiniu.keyPrefix} onChange={(e) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, keyPrefix: e.target.value } }))} placeholder={t('qiniuKeyPrefix')} />
              </div>
              <p className="text-xs text-zinc-500">{t('qiniuSecretHint')}</p>
              <Button onClick={saveStorageSettings} className="cursor-pointer gap-2 bg-brand hover:bg-brand-hover"><Save className="h-4 w-4" />{t('save')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-0">
          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" />{t('authSettings')}</CardTitle>
                <p className="text-xs text-zinc-500">{t('oauthHint')}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <label className="grid gap-1 text-sm">
                  <span className="text-zinc-500">{t('authMode')}</span>
                  <select
                    value={authSettings.authMode}
                    onChange={(event) => setAuthSettings((s) => ({ ...s, authMode: event.target.value }))}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                  >
                    <option value="local">local</option>
                    <option value="oidc-only">oidc-only</option>
                    <option value="oidc-with-admin-password">oidc-with-admin-password</option>
                  </select>
                </label>
                <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
                  <label className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
                    <span>{t('adminPasswordLogin')}</span>
                    <Switch checked={authSettings.adminPasswordEnabled} onCheckedChange={(checked) => setAuthSettings((s) => ({ ...s, adminPasswordEnabled: checked }))} />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
                    <span>{t('publicPasswordLogin')}</span>
                    <Switch checked={authSettings.publicPasswordEnabled} onCheckedChange={(checked) => setAuthSettings((s) => ({ ...s, publicPasswordEnabled: checked, passwordLoginEnabled: checked }))} />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
                    <span>{t('passwordRegister')}</span>
                    <Switch checked={authSettings.passwordRegisterEnabled} onCheckedChange={(checked) => setAuthSettings((s) => ({ ...s, passwordRegisterEnabled: checked }))} />
                  </label>
                </div>

                {Object.entries(authSettings.providers).map(([providerId, providerConfig]) => (
                  <div key={providerId} className="space-y-3 rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{providerConfig.name || 'OIDC'}</p>
                        <p className="text-xs text-zinc-500">{t('oidcEnvOnly')}</p>
                      </div>
                      <Badge variant={providerConfig.configured ? 'secondary' : 'outline'}>
                        {providerConfig.configured ? t('configured') : t('notConfigured')}
                      </Badge>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input value={providerConfig.issuer || '-'} readOnly className="bg-zinc-50" aria-label={t('oidcIssuer')} />
                      <Input value={providerConfig.clientId || '-'} readOnly className="bg-zinc-50" aria-label={t('oauthClientId', { provider: providerConfig.name || 'OIDC' })} />
                      <Input value={providerConfig.clientSecretSet ? '••••••••' : '-'} readOnly className="bg-zinc-50" aria-label={t('oauthClientSecret', { provider: providerConfig.name || 'OIDC' })} />
                      <Input value={providerConfig.source || 'env'} readOnly className="bg-zinc-50" aria-label="source" />
                    </div>
                  </div>
                ))}

                <div className="space-y-2 rounded-lg border p-3">
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">{t('loginFooter')}</h3>
                  <Input value={authSettings.loginFooterText} onChange={(e) => setAuthSettings((s) => ({ ...s, loginFooterText: e.target.value }))} placeholder={t('loginFooterText')} />
                  <div className="grid gap-2 md:grid-cols-2">
                    <Input value={authSettings.loginFooterLinkText} onChange={(e) => setAuthSettings((s) => ({ ...s, loginFooterLinkText: e.target.value }))} placeholder={t('loginFooterLinkText')} />
                    <Input value={authSettings.loginFooterLinkUrl} onChange={(e) => setAuthSettings((s) => ({ ...s, loginFooterLinkUrl: e.target.value }))} placeholder={t('loginFooterLinkUrl')} />
                  </div>
                </div>
                <Button onClick={saveAuthSettings} className="cursor-pointer gap-2 bg-brand hover:bg-brand-hover"><Save className="h-4 w-4" />{t('save')}</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><HardDrive className="h-4 w-4" />{t('storageSettings')}</CardTitle>
                <p className="text-xs text-zinc-500">{t('storageSettingsHint')}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-zinc-50 p-3 text-sm dark:bg-zinc-900/60">
                  <Badge variant="secondary">Qiniu Cloud</Badge>
                  <Badge variant={storageSettings.qiniu.configured ? 'secondary' : 'outline'}>
                    {storageSettings.qiniu.configured ? t('configured') : t('notConfigured')}
                  </Badge>
                  <Badge variant="outline">{t('storageSource')}: {storageSettings.qiniu.source || 'none'}</Badge>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
                    <span>{t('storageEnabled')}</span>
                    <Switch checked={storageSettings.qiniu.enabled} onCheckedChange={(checked) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, enabled: checked } }))} />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border bg-background px-3 py-2 text-sm">
                    <span>{t('qiniuPublicRead')}</span>
                    <Switch checked={storageSettings.qiniu.publicRead} onCheckedChange={(checked) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, publicRead: checked } }))} />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <Input value={storageSettings.qiniu.accessKey} onChange={(e) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, accessKey: e.target.value } }))} placeholder={t('qiniuAccessKey')} />
                  <Input value={storageSettings.qiniu.secretKey} onChange={(e) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, secretKey: e.target.value } }))} placeholder={storageSettings.qiniu.secretKeySet ? t('qiniuSecretKeySet') : t('qiniuSecretKey')} type="password" />
                  <Input value={storageSettings.qiniu.bucket} onChange={(e) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, bucket: e.target.value } }))} placeholder={t('qiniuBucket')} />
                  <select
                    value={storageSettings.qiniu.region}
                    onChange={(event) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, region: event.target.value } }))}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    aria-label={t('qiniuRegion')}
                  >
                    {QINIU_REGION_OPTIONS.map((region) => <option key={region} value={region}>{region}</option>)}
                  </select>
                  <Input value={storageSettings.qiniu.domain} onChange={(e) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, domain: e.target.value } }))} placeholder={t('qiniuDomain')} />
                  <select
                    value={storageSettings.qiniu.protocol}
                    onChange={(event) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, protocol: event.target.value === 'http' ? 'http' : 'https' } }))}
                    className="h-9 rounded-md border bg-background px-2 text-sm"
                    aria-label={t('qiniuProtocol')}
                  >
                    <option value="https">https</option>
                    <option value="http">http</option>
                  </select>
                  <Input value={storageSettings.qiniu.keyPrefix} onChange={(e) => setStorageSettings((s) => ({ ...s, qiniu: { ...s.qiniu, keyPrefix: e.target.value } }))} placeholder={t('qiniuKeyPrefix')} />
                </div>
                {storageSettings.qiniu.uploadBaseUrl && (
                  <code className="block break-all rounded-md bg-zinc-100 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-300">{storageSettings.qiniu.uploadBaseUrl}</code>
                )}
                <p className="text-xs text-zinc-500">{t('qiniuSecretHint')}</p>
                <Button onClick={saveStorageSettings} className="cursor-pointer gap-2 bg-brand hover:bg-brand-hover"><Save className="h-4 w-4" />{t('save')}</Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-0">
          <div className="space-y-4">
            <AdminDataTable
              title={t('aiChannels')}
              description="统一管理 AI 渠道、供应商、端点、权重和启停状态。"
              icon={Bot}
              rows={filteredAIChannels}
              getRowId={(channel) => channel.id}
              selectedIds={selectedAIChannelIds}
              onSelectedIdsChange={setSelectedAIChannelIds}
              emptyText={channels.length === 0 ? '暂无 AI 渠道。' : '没有匹配的 AI 渠道'}
              minWidth="1060px"
              metrics={(
                <MetricStrip
                  items={[
                    { label: '渠道总数', value: aiChannelStats.total },
                    { label: '启用', value: aiChannelStats.enabled, tone: 'good' },
                    { label: '停用', value: aiChannelStats.disabled },
                    { label: '供应商', value: aiChannelStats.providers },
                  ]}
                />
              )}
              actions={(
                <Button type="button" onClick={openCreateAIChannelDialog} className="cursor-pointer gap-2 bg-brand hover:bg-brand-hover">
                  <Plus className="h-4 w-4" />{t('add')}
                </Button>
              )}
              toolbar={(
                <>
                  <TableSearch value={aiChannelQuery} onChange={setAiChannelQuery} placeholder="搜索渠道、供应商、模型、Base URL" />
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={aiChannelStatusFilter}
                      onChange={(event) => setAiChannelStatusFilter(event.target.value as (typeof AI_CHANNEL_STATUS_OPTIONS)[number])}
                      className="h-9 rounded-md border bg-background px-3 text-sm"
                    >
                      {AI_CHANNEL_STATUS_OPTIONS.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>{statusOption === 'all' ? '全部状态' : statusOption === 'enabled' ? '启用' : '停用'}</option>
                      ))}
                    </select>
                    <Button type="button" variant="outline" size="sm" onClick={load} className="gap-2"><RefreshCw className="h-4 w-4" />刷新</Button>
                  </div>
                </>
              )}
              columns={[
                {
                  key: 'channel',
                  header: '渠道',
                  cell: (channel) => (
                    <button type="button" onClick={() => setViewingAIChannel(channel)} className="min-w-0 text-left">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{channel.name}</span>
                        <Badge variant="secondary">{channel.provider}</Badge>
                        {!channel.enabled && <Badge variant="destructive">停用</Badge>}
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-500">{channel.baseUrl}</p>
                    </button>
                  ),
                },
                { key: 'model', header: '模型', cell: (channel) => <span className="text-xs text-zinc-500">{channel.model}</span> },
                { key: 'endpoint', header: '端点', cell: (channel) => <Badge variant="outline">{channel.openAIEndpoint || 'chat'}</Badge> },
                { key: 'weight', header: '权重', cell: (channel) => <span className="text-xs text-zinc-500">w{channel.weight}</span> },
                {
                  key: 'enabled',
                  header: '启停',
                  cell: (channel) => (
                    <Switch checked={channel.enabled} disabled={togglingChannelId === channel.id} onCheckedChange={() => openAIChannelActionDialog(channel, 'toggle')} />
                  ),
                },
              ]}
              renderRowActions={(channel) => (
                <>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="预览渠道" onClick={() => setViewingAIChannel(channel)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="编辑渠道" onClick={() => openEditAIChannelDialog(channel)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="测试渠道" onClick={() => testAIChannel(channel)} disabled={testingChannelId === channel.id}>
                    <TestTube2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="删除渠道" onClick={() => openAIChannelActionDialog(channel, 'delete')} disabled={deletingChannelId === channel.id} className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            />

            <AdminDataTable
              title={t('aiUsage')}
              description={t('aiUsageHint')}
              icon={Activity}
              rows={filteredAiUsage}
              getRowId={(item) => item.id}
              selectedIds={selectedAIUsageIds}
              onSelectedIdsChange={setSelectedAIUsageIds}
              emptyText={aiUsage.length === 0 ? t('noAiUsage') : t('noAiUsageMatches')}
              minWidth="1120px"
              metrics={(
                <MetricStrip
                  items={[
                    { label: t('aiUsageMetricTotal'), value: aiUsageStats.total },
                    { label: t('aiUsageMetricCharged'), value: aiUsageStats.charged },
                    { label: t('aiUsageMetricFailed'), value: aiUsageStats.failed, tone: aiUsageStats.failed > 0 ? 'warn' : 'default' },
                    { label: t('aiUsageMetricTokens'), value: aiUsageStats.tokens.toLocaleString() },
                  ]}
                />
              )}
              toolbar={(
                <>
                  <TableSearch value={aiUsageQuery} onChange={setAiUsageQuery} placeholder={t('aiUsageSearchPlaceholder')} />
                  <select value={aiUsageStatusFilter} onChange={(event) => setAiUsageStatusFilter(event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                    {AI_USAGE_STATUS_OPTIONS.map((statusOption) => (
                      <option key={statusOption} value={statusOption}>{statusOption === 'all' ? t('allAiUsageStatuses') : statusOption}</option>
                    ))}
                  </select>
                </>
              )}
              columns={[
                {
                  key: 'feature',
                  header: '功能 / 模型',
                  cell: (item) => (
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{item.feature}</span>
                        <Badge variant={item.status === 'success' ? 'secondary' : item.status === 'reserved' ? 'outline' : 'destructive'}>{item.status}</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-500">{[item.provider, item.model].filter(Boolean).join(' · ') || '-'}</p>
                      {item.error && <p className="mt-1 line-clamp-2 text-xs text-red-600 dark:text-red-400">{item.error}</p>}
                    </div>
                  ),
                },
                { key: 'user', header: '用户', cell: (item) => <div className="min-w-0"><p className="truncate font-medium">{item.user?.name || item.user?.email || item.userId}</p><p className="truncate text-xs text-zinc-500">{item.user?.email || item.user?.role || '-'}</p></div> },
                { key: 'credits', header: '额度', cell: (item) => <div className="text-xs"><div className="font-medium">{item.creditsCharged} {t('aiUsageCreditsUnit')}</div><div className="text-zinc-500">{Number(item.totalTokens || 0).toLocaleString()} tokens</div></div> },
                { key: 'createdAt', header: '时间', cell: (item) => <span className="text-xs text-zinc-500">{formatDate(item.createdAt)}</span> },
              ]}
              renderRowActions={(item) => (
                <>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="预览用量" onClick={() => setError(`AI 用量 ${item.id} 详情预览后续接入。`)}>
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="编辑用量" onClick={() => setError('AI 用量为审计记录，默认不提供编辑。')}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon-xs" aria-label="删除用量" onClick={() => markDangerousCleanupPending(`AI 用量 ${item.id}`)} className="text-red-600 hover:text-red-700">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            />
          </div>

          <Dialog open={aiChannelDialogOpen} onOpenChange={(open) => { if (open) setAiChannelDialogOpen(true); else closeAIChannelDialog(); }}>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>{editingChannelId ? '编辑 AI 渠道' : '新增 AI 渠道'}</DialogTitle>
                <DialogDescription>{editingChannelId ? 'API Key 留空会保留原密钥。' : '配置供应商、模型、端点和密钥后保存。'}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-3 md:grid-cols-2">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('name')} />
                <Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder={t('provider')} />
                <Input className="md:col-span-2" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder={t('baseUrl')} />
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder={t('model')} />
                <select
                  value={form.openAIEndpoint}
                  onChange={(event) => setForm({ ...form, openAIEndpoint: event.target.value })}
                  className="h-9 rounded-md border bg-background px-2 text-sm"
                  aria-label="OpenAI endpoint"
                >
                  <option value="chat">chat</option>
                  <option value="responses">responses</option>
                </select>
                <Input value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={editingChannelId ? 'API Key（留空保留原值）' : t('apiKey')} type="password" />
                <Input value={String(form.weight)} onChange={(e) => setForm({ ...form, weight: Number(e.target.value) || 1 })} placeholder="权重" type="number" min={1} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={closeAIChannelDialog} disabled={savingAIChannel || testingChannelId === 'new' || testingChannelId === editingChannelId}>取消</Button>
                <Button type="button" variant="outline" onClick={() => testAIChannel()} disabled={savingAIChannel || testingChannelId === 'new' || testingChannelId === editingChannelId} className="cursor-pointer gap-2">
                  <TestTube2 className="h-4 w-4" />{testingChannelId === 'new' || testingChannelId === editingChannelId ? '测试中' : '测试'}
                </Button>
                <Button type="button" onClick={saveAIChannel} disabled={savingAIChannel} className="cursor-pointer gap-2 bg-brand hover:bg-brand-hover">
                  {editingChannelId ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {savingAIChannel ? '保存中' : editingChannelId ? '保存' : t('add')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={!!viewingAIChannel} onOpenChange={(open) => { if (!open) setViewingAIChannel(null); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{viewingAIChannel?.name || 'AI 渠道详情'}</DialogTitle>
                <DialogDescription>查看当前 AI 渠道配置摘要。</DialogDescription>
              </DialogHeader>
              {viewingAIChannel && (
                <div className="space-y-3 text-sm">
                  <div className="flex flex-wrap gap-2"><Badge variant="secondary">{viewingAIChannel.provider}</Badge><Badge variant="outline">{viewingAIChannel.openAIEndpoint || 'chat'}</Badge><Badge variant="outline">w{viewingAIChannel.weight}</Badge><Badge variant={viewingAIChannel.enabled ? 'secondary' : 'destructive'}>{viewingAIChannel.enabled ? '启用' : '停用'}</Badge></div>
                  <div><div className="text-xs text-zinc-500">模型</div><div className="break-all font-medium">{viewingAIChannel.model}</div></div>
                  <div><div className="text-xs text-zinc-500">Base URL</div><div className="break-all font-medium">{viewingAIChannel.baseUrl}</div></div>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setViewingAIChannel(null)}>关闭</Button>
                {viewingAIChannel && <Button type="button" onClick={() => { const channel = viewingAIChannel; setViewingAIChannel(null); openEditAIChannelDialog(channel); }} className="gap-2"><Pencil className="h-4 w-4" />编辑</Button>}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={aiTestResultOpen} onOpenChange={setAiTestResultOpen}>
            <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-5xl">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {aiTestResult?.ok ? <CheckCircle2 className="h-5 w-5 text-emerald-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                  AI 渠道测试 HTTP 报告
                </DialogTitle>
                <DialogDescription className="break-words">{aiTestResult?.message || 'AI 渠道测试失败，请检查配置。'}</DialogDescription>
              </DialogHeader>
              {aiTestResult && (
                <div className="space-y-3 text-sm">
                  <div className={`rounded-lg border px-3 py-2 ${aiTestResult.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200' : 'border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200'}`}>
                    <div className="grid gap-2 text-xs md:grid-cols-2">
                      <div><span className="opacity-70">provider：</span><span className="font-medium">{aiTestResult.provider}</span></div>
                      <div><span className="opacity-70">model：</span><span className="font-medium break-all">{aiTestResult.model || '-'}</span></div>
                      <div><span className="opacity-70">recommendedBaseUrl：</span><span className="font-medium break-all">{aiTestResult.recommendedBaseUrl || '-'}</span></div>
                      <div><span className="opacity-70">recommendedEndpoint：</span><span className="font-medium">{aiTestResult.recommendedEndpoint || '-'}</span></div>
                    </div>
                  </div>

                  {aiTestResult.diagnostics && (
                    <details open className="rounded-lg border bg-muted/20 p-3">
                      <summary className="cursor-pointer text-sm font-medium">Diagnostics / 测试计划</summary>
                      <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100">{stringifyReport(aiTestResult.diagnostics)}</pre>
                    </details>
                  )}

                  <div className="space-y-3">
                    {aiTestResult.attempts?.map((attempt, index) => (
                      <details key={`${attempt.endpoint}-${attempt.startedAt || attempt.elapsedMs}-${index}`} open className={`rounded-lg border p-3 ${attempt.ok ? 'border-emerald-200 dark:border-emerald-900/60' : 'border-red-200 dark:border-red-900/60'}`}>
                        <summary className="cursor-pointer text-sm font-semibold">
                          {attempt.ok ? '✅' : '❌'} Attempt {index + 1}: {attempt.endpoint} · {attempt.elapsedMs}ms · {responseStatusLabel(attempt.response)}
                        </summary>
                        <div className="mt-3 space-y-3">
                          <div className="rounded-md bg-muted/30 p-2 text-xs">
                            <div className="break-words font-medium">message: {attempt.message}</div>
                            <div className="mt-1 grid gap-1 text-zinc-500 md:grid-cols-2">
                              <div>baseUrl: <span className="break-all">{attempt.baseUrl}</span></div>
                              <div>startedAt: {attempt.startedAt || '-'}</div>
                              <div>completedAt: {attempt.completedAt || '-'}</div>
                              <div>rawError: <span className="break-all">{attempt.rawError || '-'}</span></div>
                            </div>
                          </div>
                          {attempt.request && (
                            <details open>
                              <summary className="cursor-pointer text-xs font-medium">Request JSON</summary>
                              <pre className="mt-2 max-h-80 overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100">{stringifyReport(attempt.request)}</pre>
                            </details>
                          )}
                          {attempt.response && (
                            <details open>
                              <summary className="cursor-pointer text-xs font-medium">Response JSON / Headers / Body</summary>
                              <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100">{stringifyReport(attempt.response)}</pre>
                            </details>
                          )}
                          {attempt.error && (
                            <details open>
                              <summary className="cursor-pointer text-xs font-medium">Transport Error</summary>
                              <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100">{stringifyReport(attempt.error)}</pre>
                            </details>
                          )}
                        </div>
                      </details>
                    ))}
                  </div>

                  <details className="rounded-lg border bg-muted/20 p-3">
                    <summary className="cursor-pointer text-sm font-medium">完整脱敏报告 JSON</summary>
                    <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-zinc-950 p-3 text-xs leading-relaxed text-zinc-100">{stringifyReport(aiTestResult)}</pre>
                  </details>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAiTestResultOpen(false)}>关闭</Button>
                {aiTestResult && <Button type="button" variant="outline" onClick={copyAIChannelTestReport} className="cursor-pointer gap-2"><Copy className="h-4 w-4" />复制完整报告</Button>}
                {aiTestResult && <Button type="button" variant="outline" onClick={applyAIChannelRecommendation} className="cursor-pointer">采用推荐配置</Button>}
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <AlertDialog open={!!aiActionChannel && !!aiActionType} onOpenChange={(open) => { if (!open) closeAIChannelActionDialog(); }}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{aiActionType === 'delete' ? '删除 AI 渠道？' : `${aiActionChannel?.enabled ? '停用' : '启用'} AI 渠道？`}</AlertDialogTitle>
                <AlertDialogDescription>
                  {aiActionType === 'delete'
                    ? `将删除「${aiActionChannel?.name || ''}」，此操作不可撤销。`
                    : `将${aiActionChannel?.enabled ? '停用' : '启用'}「${aiActionChannel?.name || ''}」。`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={!!deletingChannelId || !!togglingChannelId}>取消</AlertDialogCancel>
                <AlertDialogAction
                  variant={aiActionType === 'delete' ? 'destructive' : 'default'}
                  disabled={!!deletingChannelId || !!togglingChannelId}
                  onClick={(event) => {
                    event.preventDefault();
                    void confirmAIChannelAction();
                  }}
                >
                  {deletingChannelId || togglingChannelId ? '处理中' : aiActionType === 'delete' ? '确认删除' : '确认'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </TabsContent>

        <TabsContent value="aiUsage" className="mt-0">
          <Card>
            <CardHeader className="space-y-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" />{t('aiUsage')}</CardTitle>
                <p className="mt-1 text-xs text-zinc-500">{t('aiUsageHint')}</p>
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                {[
                  { label: t('aiUsageMetricTotal'), value: aiUsageStats.total },
                  { label: t('aiUsageMetricCharged'), value: aiUsageStats.charged },
                  { label: t('aiUsageMetricFailed'), value: aiUsageStats.failed },
                  { label: t('aiUsageMetricTokens'), value: aiUsageStats.tokens.toLocaleString() },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border bg-zinc-50 px-3 py-2 dark:bg-zinc-900/60">
                    <div className="text-xs text-zinc-500">{item.label}</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_220px]">
                <Input
                  value={aiUsageQuery}
                  onChange={(event) => setAiUsageQuery(event.target.value)}
                  placeholder={t('aiUsageSearchPlaceholder')}
                />
                <select
                  value={aiUsageStatusFilter}
                  onChange={(event) => setAiUsageStatusFilter(event.target.value)}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  {AI_USAGE_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status === 'all' ? t('allAiUsageStatuses') : status}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {aiUsage.length === 0 ? <p className="text-sm text-zinc-400">{t('noAiUsage')}</p> : filteredAiUsage.length === 0 ? <p className="text-sm text-zinc-400">{t('noAiUsageMatches')}</p> : filteredAiUsage.map((item) => (
                <div key={item.id} className="grid gap-3 rounded-lg border px-3 py-2 text-sm lg:grid-cols-[1.1fr_1fr_120px_120px] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{item.feature}</span>
                      <Badge variant={item.status === 'success' ? 'secondary' : item.status === 'reserved' ? 'outline' : 'destructive'}>{item.status}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-zinc-500">{[item.provider, item.model].filter(Boolean).join(' · ') || '-'}</p>
                    {item.error && <p className="mt-1 line-clamp-2 text-xs text-red-600 dark:text-red-400">{item.error}</p>}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.user?.name || item.user?.email || item.userId}</p>
                    <p className="truncate text-xs text-zinc-500">{item.user?.email || item.user?.role || '-'}</p>
                  </div>
                  <div className="text-xs text-zinc-500">
                    <div className="font-medium text-zinc-950 dark:text-zinc-50">{item.creditsCharged} {t('aiUsageCreditsUnit')}</div>
                    <div>{Number(item.totalTokens || 0).toLocaleString()} tokens</div>
                  </div>
                  <span className="text-xs text-zinc-500">{formatDate(item.createdAt)}</span>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={load} className="cursor-pointer gap-2"><RefreshCw className="h-4 w-4" />{t('refresh')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resumeAnalysis" className="mt-0">
          <Card>
            <CardHeader className="space-y-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><FileClock className="h-4 w-4" />简历分析任务</CardTitle>
                <p className="mt-1 text-xs text-zinc-500">查看后台队列、调度、worker、重试日志和失败原因。</p>
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                {[
                  { label: '总任务', value: resumeAnalysisStats.total },
                  { label: '活跃任务', value: resumeAnalysisStats.active },
                  { label: '成功', value: resumeAnalysisStats.succeeded },
                  { label: '失败', value: resumeAnalysisStats.failed },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border bg-zinc-50 px-3 py-2 dark:bg-zinc-900/60">
                    <div className="text-xs text-zinc-500">{item.label}</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_220px]">
                <Input
                  value={resumeAnalysisQuery}
                  onChange={(event) => setResumeAnalysisQuery(event.target.value)}
                  placeholder="搜索用户、文件、worker、错误信息"
                />
                <select
                  value={resumeAnalysisStatusFilter}
                  onChange={(event) => setResumeAnalysisStatusFilter(event.target.value)}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  {RESUME_ANALYSIS_STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>{statusOption === 'all' ? '全部状态' : statusOption}</option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {resumeAnalysisJobs.length === 0 ? <p className="text-sm text-zinc-400">暂无简历分析任务</p> : filteredResumeAnalysisJobs.length === 0 ? <p className="text-sm text-zinc-400">没有匹配的任务</p> : filteredResumeAnalysisJobs.map((job) => {
                const logs = Array.isArray(job.logs) ? job.logs : [];
                const latestLog = logs[logs.length - 1];
                return (
                  <div key={job.id} className="grid gap-3 rounded-lg border px-3 py-2 text-sm xl:grid-cols-[1.2fr_1fr_1fr_140px] xl:items-start">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate font-medium">{job.fileName}</span>
                        <Badge variant={job.status === 'succeeded' ? 'secondary' : job.status === 'failed' ? 'destructive' : 'outline'}>{job.status}</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-zinc-500">任务 {job.id} · 用户 {job.user?.email || job.user?.name || job.userId}</p>
                      {job.resumeId && <p className="mt-1 truncate text-xs text-zinc-500">生成简历 {job.resumeId}</p>}
                    </div>
                    <div className="text-xs text-zinc-500">
                      <div className="font-medium text-zinc-950 dark:text-zinc-50">进度 {job.progress}% · 尝试 {job.attempts}/{job.maxAttempts}</div>
                      <div>排队位置 {job.position || '-'} · 文件 {(Number(job.fileSize || 0) / 1024).toFixed(0)} KB</div>
                      <div>创建 {formatDateTime(job.createdAt)}</div>
                    </div>
                    <div className="min-w-0 text-xs text-zinc-500">
                      <div className="truncate font-medium text-zinc-950 dark:text-zinc-50">worker {job.workerId || '-'}</div>
                      <div>开始 {formatDateTime(job.startedAt)}</div>
                      <div>心跳 {formatDateTime(job.lastHeartbeatAt)}</div>
                      {latestLog && <div className="mt-1 line-clamp-2">最近日志：{latestLog.message}</div>}
                      {job.errorMessage && <div className="mt-1 line-clamp-2 text-red-600 dark:text-red-400">{job.errorCode || 'error'}：{job.errorMessage}</div>}
                    </div>
                    <div className="text-xs text-zinc-500">
                      <div>完成 {formatDateTime(job.finishedAt)}</div>
                      <div>日志 {logs.length} 条</div>
                      <div className="mt-1 line-clamp-3">{logs.slice(-3).map((log) => `${log.level}:${log.message}`).join(' / ') || '-'}</div>
                    </div>
                  </div>
                );
              })}
              <Button variant="outline" size="sm" onClick={load} className="cursor-pointer gap-2"><RefreshCw className="h-4 w-4" />{t('refresh')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="walletTransactions" className="mt-0">
          <Card>
            <CardHeader className="space-y-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><Coins className="h-4 w-4" />{t('walletTransactions')}</CardTitle>
                <p className="mt-1 text-xs text-zinc-500">{t('walletTransactionsHint')}</p>
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                {[
                  { label: t('walletTransactionMetricTotal'), value: walletTransactionStats.total },
                  { label: t('walletTransactionMetricCredited'), value: walletTransactionStats.credited },
                  { label: t('walletTransactionMetricDebited'), value: walletTransactionStats.debited },
                  { label: t('walletTransactionMetricUsers'), value: walletTransactionStats.users },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border bg-zinc-50 px-3 py-2 dark:bg-zinc-900/60">
                    <div className="text-xs text-zinc-500">{item.label}</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_180px]">
                <Input
                  value={walletTransactionQuery}
                  onChange={(event) => setWalletTransactionQuery(event.target.value)}
                  placeholder={t('walletTransactionSearchPlaceholder')}
                />
                <select
                  value={walletDirectionFilter}
                  onChange={(event) => setWalletDirectionFilter(event.target.value)}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  {WALLET_TRANSACTION_DIRECTION_OPTIONS.map((direction) => (
                    <option key={direction} value={direction}>
                      {direction === 'all' ? t('allWalletTransactionDirections') : direction}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {walletTransactions.length === 0 ? <p className="text-sm text-zinc-400">{t('noWalletTransactions')}</p> : filteredWalletTransactions.length === 0 ? <p className="text-sm text-zinc-400">{t('noWalletTransactionMatches')}</p> : filteredWalletTransactions.map((transaction) => (
                <div key={transaction.id} className="grid gap-3 rounded-lg border px-3 py-2 text-sm xl:grid-cols-[1fr_1fr_140px_140px] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{transaction.source}</span>
                      <Badge variant={transaction.direction === 'credit' ? 'secondary' : 'outline'}>{transaction.direction}</Badge>
                      <Badge variant="outline">{transaction.currency}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-zinc-500">{transaction.description || transaction.sourceId || '-'}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-medium">{transaction.user?.name || transaction.user?.email || transaction.userId}</p>
                    <p className="truncate text-xs text-zinc-500">{transaction.user?.email || transaction.user?.role || '-'}</p>
                  </div>
                  <div className="text-xs text-zinc-500">
                    <div className="font-medium text-zinc-950 dark:text-zinc-50">
                      {transaction.direction === 'credit' ? '+' : '-'}{Number(transaction.amount || 0)}
                    </div>
                    <div>{t('walletBalanceAfter')}: {Number(transaction.balanceAfter || 0)}</div>
                  </div>
                  <div className="text-xs text-zinc-500">
                    <div>{formatDateTime(transaction.createdAt)}</div>
                    {transaction.sourceId && <code className="mt-1 block truncate rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-900">{transaction.sourceId}</code>}
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={load} className="cursor-pointer gap-2"><RefreshCw className="h-4 w-4" />{t('refresh')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviewComments" className="mt-0">
          <Card>
            <CardHeader className="space-y-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><MessageSquareText className="h-4 w-4" />{t('reviewComments')}</CardTitle>
                <p className="mt-1 text-xs text-zinc-500">{t('reviewCommentsHint')}</p>
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                {[
                  { label: t('reviewCommentMetricTotal'), value: reviewCommentStats.total },
                  { label: t('reviewCommentMetricOpen'), value: reviewCommentStats.open },
                  { label: t('reviewCommentMetricResolved'), value: reviewCommentStats.resolved },
                  { label: t('reviewCommentMetricShares'), value: reviewCommentStats.shares },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border bg-zinc-50 px-3 py-2 dark:bg-zinc-900/60">
                    <div className="text-xs text-zinc-500">{item.label}</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_180px]">
                <Input
                  value={reviewCommentQuery}
                  onChange={(event) => setReviewCommentQuery(event.target.value)}
                  placeholder={t('reviewCommentSearchPlaceholder')}
                />
                <select
                  value={reviewCommentStatusFilter}
                  onChange={(event) => setReviewCommentStatusFilter(event.target.value as ReviewCommentStatusFilter)}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  {REVIEW_COMMENT_STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {statusOption === 'all' ? t('allReviewCommentStatuses') : statusOption}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {reviewComments.length === 0 ? <p className="text-sm text-zinc-400">{t('noReviewComments')}</p> : filteredReviewComments.length === 0 ? <p className="text-sm text-zinc-400">{t('noReviewCommentMatches')}</p> : filteredReviewComments.map((comment) => (
                <div key={comment.id} className="grid gap-3 rounded-lg border px-3 py-2 text-sm xl:grid-cols-[1.2fr_1fr_140px] xl:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{comment.resume?.title || comment.resumeId}</span>
                      <Badge variant={comment.status === 'resolved' ? 'secondary' : 'outline'}>{comment.status}</Badge>
                      {comment.parentCommentId && <Badge variant="outline">{t('reviewCommentReply')}</Badge>}
                    </div>
                    <p className="mt-1 line-clamp-3 text-sm text-zinc-700 dark:text-zinc-200">{comment.content}</p>
                    {comment.selectedText && <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{t('reviewCommentSelectedText')}: {comment.selectedText}</p>}
                  </div>
                  <div className="min-w-0 text-xs text-zinc-500">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{comment.authorUser?.name || comment.authorName || '-'}</p>
                    <p className="truncate">{comment.authorUser?.email || comment.authorEmail || '-'}</p>
                    <p className="mt-2 truncate">{[comment.resume?.targetCompany, comment.resume?.targetJobTitle].filter(Boolean).join(' · ') || '-'}</p>
                    <p className="truncate">{comment.share?.label || comment.share?.token || comment.shareId}</p>
                  </div>
                  <div className="text-xs text-zinc-500">
                    <div>{formatDate(comment.createdAt)}</div>
                    {comment.share?.token && <code className="mt-1 block truncate rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-900">{comment.share.token}</code>}
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={load} className="cursor-pointer gap-2"><RefreshCw className="h-4 w-4" />{t('refresh')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviewPresence" className="mt-0">
          <Card>
            <CardHeader className="space-y-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><Radio className="h-4 w-4" />{t('reviewPresence')}</CardTitle>
                <p className="mt-1 text-xs text-zinc-500">{t('reviewPresenceHint')}</p>
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                {[
                  { label: t('reviewPresenceMetricRecent'), value: reviewPresenceStats.total },
                  { label: t('reviewPresenceMetricActive'), value: reviewPresenceStats.active },
                  { label: t('reviewPresenceMetricShares'), value: reviewPresenceStats.shares },
                  { label: t('reviewPresenceMetricResumes'), value: reviewPresenceStats.resumes },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border bg-zinc-50 px-3 py-2 dark:bg-zinc-900/60">
                    <div className="text-xs text-zinc-500">{item.label}</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{item.value}</div>
                  </div>
                ))}
              </div>
              <Input
                value={reviewPresenceQuery}
                onChange={(event) => setReviewPresenceQuery(event.target.value)}
                placeholder={t('reviewPresenceSearchPlaceholder')}
              />
            </CardHeader>
            <CardContent className="space-y-2">
              {reviewPresence.length === 0 ? <p className="text-sm text-zinc-400">{t('noReviewPresence')}</p> : filteredReviewPresence.length === 0 ? <p className="text-sm text-zinc-400">{t('noReviewPresenceMatches')}</p> : filteredReviewPresence.map((presence) => (
                <div key={presence.id} className="grid gap-3 rounded-lg border px-3 py-2 text-sm xl:grid-cols-[1fr_1fr_160px] xl:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex h-2.5 w-2.5 rounded-full" style={{ backgroundColor: presence.color || '#10b981' }} />
                      <span className="truncate font-medium">{presence.user?.name || presence.reviewerName || presence.user?.email || presence.userId}</span>
                      {presence.share?.isActive === false && <Badge variant="destructive">{t('reviewPresenceInactiveShare')}</Badge>}
                    </div>
                    <p className="mt-1 truncate text-xs text-zinc-500">{presence.user?.email || presence.reviewerEmail || '-'}</p>
                  </div>
                  <div className="min-w-0 text-xs text-zinc-500">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{presence.resume?.title || presence.resumeId}</p>
                    <p className="truncate">{[presence.resume?.targetCompany, presence.resume?.targetJobTitle].filter(Boolean).join(' · ') || '-'}</p>
                    <p className="mt-1 truncate">{presence.share?.label || presence.share?.token || presence.shareId}</p>
                  </div>
                  <div className="text-xs text-zinc-500">
                    <div className="font-medium text-zinc-950 dark:text-zinc-50">{formatDateTime(presence.lastSeenAt)}</div>
                    {presence.share?.token && <code className="mt-1 block truncate rounded bg-zinc-100 px-2 py-1 dark:bg-zinc-900">{presence.share.token}</code>}
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={load} className="cursor-pointer gap-2"><RefreshCw className="h-4 w-4" />{t('refresh')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="changeProposals" className="mt-0">
          <Card>
            <CardHeader className="space-y-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-4 w-4" />{t('changeProposals')}</CardTitle>
                <p className="mt-1 text-xs text-zinc-500">{t('changeProposalsHint')}</p>
              </div>
              <div className="grid gap-2 md:grid-cols-4">
                {[
                  { label: t('changeProposalMetricTotal'), value: changeProposalStats.total },
                  { label: t('changeProposalMetricPending'), value: changeProposalStats.pending },
                  { label: t('changeProposalMetricApplied'), value: changeProposalStats.applied },
                  { label: t('changeProposalMetricRejected'), value: changeProposalStats.rejected },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg border bg-zinc-50 px-3 py-2 dark:bg-zinc-900/60">
                    <div className="text-xs text-zinc-500">{item.label}</div>
                    <div className="mt-1 text-lg font-semibold text-zinc-950 dark:text-zinc-50">{item.value}</div>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-[1fr_180px]">
                <Input
                  value={changeProposalQuery}
                  onChange={(event) => setChangeProposalQuery(event.target.value)}
                  placeholder={t('changeProposalSearchPlaceholder')}
                />
                <select
                  value={changeProposalStatusFilter}
                  onChange={(event) => setChangeProposalStatusFilter(event.target.value as ChangeProposalStatusFilter)}
                  className="h-9 rounded-md border bg-background px-3 text-sm"
                >
                  {CHANGE_PROPOSAL_STATUS_OPTIONS.map((statusOption) => (
                    <option key={statusOption} value={statusOption}>
                      {statusOption === 'all' ? t('allChangeProposalStatuses') : statusOption}
                    </option>
                  ))}
                </select>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {changeProposals.length === 0 ? <p className="text-sm text-zinc-400">{t('noChangeProposals')}</p> : filteredChangeProposals.length === 0 ? <p className="text-sm text-zinc-400">{t('noChangeProposalMatches')}</p> : filteredChangeProposals.map((proposal) => (
                <div key={proposal.id} className="grid gap-3 rounded-lg border px-3 py-2 text-sm xl:grid-cols-[1.2fr_1fr_160px] xl:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{proposal.resume?.title || proposal.resumeId}</span>
                      <Badge variant={proposal.status === 'pending' ? 'outline' : proposal.status === 'applied' ? 'secondary' : 'destructive'}>{proposal.status}</Badge>
                      <Badge variant="outline">{proposal.source || 'ai'}</Badge>
                      <Badge variant="secondary">{proposal.sectionType}</Badge>
                    </div>
                    <p className="mt-1 line-clamp-3 text-sm text-zinc-700 dark:text-zinc-200">{proposal.suggested}</p>
                    {proposal.reason && <p className="mt-1 line-clamp-2 text-xs text-zinc-500">{proposal.reason}</p>}
                  </div>
                  <div className="min-w-0 text-xs text-zinc-500">
                    <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{proposal.user?.name || proposal.user?.email || proposal.userId || '-'}</p>
                    <p className="truncate">{[proposal.resume?.targetCompany, proposal.resume?.targetJobTitle].filter(Boolean).join(' · ') || '-'}</p>
                    <p className="mt-2 truncate">{proposal.share?.label || proposal.share?.token || proposal.shareId || '-'}</p>
                    {proposal.comment?.content && <p className="mt-1 line-clamp-2">{proposal.comment.content}</p>}
                  </div>
                  <div className="text-xs text-zinc-500">
                    <div>{formatDate(proposal.createdAt)}</div>
                    <div className="mt-1 truncate">{proposal.targetField}</div>
                    {proposal.evidenceRequired && <Badge variant="outline" className="mt-2">{t('changeProposalEvidenceRequired')}</Badge>}
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={load} className="cursor-pointer gap-2"><RefreshCw className="h-4 w-4" />{t('refresh')}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="templates" className="mt-0">
          <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto rounded-xl border bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
              {TEMPLATE_PANEL_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setTemplatePanel(item.value)}
                    className={cn(
                      'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm text-zinc-600 transition hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900',
                      templatePanel === item.value && 'bg-zinc-100 font-medium text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50',
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </button>
                );
              })}
            </div>

            {templatePanel === 'resume' && (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                <AdminDataTable
                  title={t('templates')}
                  description={t('templateListHint')}
                  icon={FileSliders}
                  rows={filteredTemplates}
                  getRowId={(template) => template.id}
                  selectedIds={selectedTemplateIds}
                  onSelectedIdsChange={setSelectedTemplateIds}
                  emptyText={templates.length === 0 ? t('noTemplates') : t('noTemplateMatches')}
                  minWidth="980px"
                  metrics={(
                    <MetricStrip
                      items={[
                        { label: t('templateMetricTotal'), value: templateStats.total },
                        { label: t('templateMetricPublic'), value: templateStats.public },
                        { label: t('templateMetricPrivate'), value: templateStats.private },
                        { label: t('templateMetricInstalls'), value: templateStats.installs },
                      ]}
                    />
                  )}
                  toolbar={(
                    <>
                      <TableSearch value={templateQuery} onChange={setTemplateQuery} placeholder={t('templateSearchPlaceholder')} />
                      <select
                        value={templateStatusFilter}
                        onChange={(event) => setTemplateStatusFilter(event.target.value as TemplateStatusFilter)}
                        className="h-9 rounded-md border bg-background px-3 text-sm"
                      >
                        <option value="all">{t('allTemplateStatuses')}</option>
                        <option value="public">{t('publicOnly')}</option>
                        <option value="private">{t('privateOnly')}</option>
                      </select>
                    </>
                  )}
                  columns={[
                    {
                      key: 'name',
                      header: '模板',
                      cell: (template) => (
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{template.name}</span>
                            <Badge variant={template.isPublic ? 'secondary' : 'outline'}>{template.isPublic ? t('public') : t('private')}</Badge>
                          </div>
                          <p className="mt-1 truncate text-xs text-zinc-500">{template.description || '-'}</p>
                        </div>
                      ),
                    },
                    { key: 'base', header: '基础模板', cell: (template) => <span className="text-xs text-zinc-500">{template.baseTemplate}</span> },
                    { key: 'installs', header: '安装', cell: (template) => <span className="text-xs text-zinc-500">{template.installCount}</span> },
                  ]}
                  renderRowActions={(template) => (
                    <>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="预览模板" onClick={() => setError(`模板 ${template.name} 预览后续接入。`)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="复制模板" onClick={() => copyTemplate(template)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="编辑模板" onClick={() => editTemplate(template)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="删除模板" onClick={() => markDangerousCleanupPending(`模板 ${template.name}`)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                />

                <Card>
                  <CardHeader><CardTitle className="text-base">{templateForm.id ? t('saveTemplate') : t('createTemplate')}</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    <Input value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} placeholder={t('templateName')} />
                    <Textarea value={templateForm.description} onChange={(e) => setTemplateForm({ ...templateForm, description: e.target.value })} placeholder={t('templateDescription')} />
                    <select value={templateForm.baseTemplate} onChange={(e) => setTemplateForm({ ...templateForm, baseTemplate: e.target.value })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                      {templateOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <Textarea value={templateForm.themeJson} onChange={(e) => setTemplateForm({ ...templateForm, themeJson: e.target.value })} placeholder={t('themeJson')} className="min-h-36 font-mono text-xs" />
                    <Textarea value={templateForm.customCss} onChange={(e) => setTemplateForm({ ...templateForm, customCss: e.target.value })} placeholder={t('customCss')} className="min-h-28 font-mono text-xs" />
                    <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"><span>{t('publicTemplate')}</span><Switch checked={templateForm.isPublic} onCheckedChange={(checked) => setTemplateForm({ ...templateForm, isPublic: checked })} /></label>
                    <div className="flex gap-2">
                      <Button onClick={saveTemplate} disabled={!templateForm.name.trim()} className="cursor-pointer gap-2 bg-brand hover:bg-brand-hover"><Save className="h-4 w-4" />{t('saveTemplate')}</Button>
                      <Button variant="outline" onClick={() => setTemplateForm(EMPTY_TEMPLATE_FORM)}>{t('createTemplate')}</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {templatePanel === 'job' && (
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
                <AdminDataTable
                  title={t('jobTemplates')}
                  description={t('jobTemplateListHint')}
                  icon={Briefcase}
                  rows={filteredJobTemplates}
                  getRowId={(template) => template.id}
                  selectedIds={selectedJobTemplateIds}
                  onSelectedIdsChange={setSelectedJobTemplateIds}
                  emptyText={jobTemplates.length === 0 ? t('noJobTemplates') : t('noJobTemplateMatches')}
                  minWidth="1120px"
                  metrics={(
                    <MetricStrip
                      items={[
                        { label: t('jobTemplateMetricTotal'), value: jobTemplateStats.total },
                        { label: t('jobTemplateMetricCustom'), value: jobTemplateStats.custom },
                        { label: t('jobTemplateMetricEnabled'), value: jobTemplateStats.enabled },
                        { label: t('jobTemplateMetricDisabled'), value: jobTemplateStats.disabled },
                      ]}
                    />
                  )}
                  toolbar={(
                    <>
                      <TableSearch value={jobTemplateQuery} onChange={setJobTemplateQuery} placeholder={t('jobTemplateSearchPlaceholder')} />
                      <div className="flex flex-wrap items-center gap-2">
                        <select value={jobTemplateLevelFilter} onChange={(event) => setJobTemplateLevelFilter(event.target.value as JobTemplateLevelFilter)} className="h-9 rounded-md border bg-background px-3 text-sm">
                          <option value="all">{t('allLevels')}</option>
                          <option value="intern">intern</option>
                          <option value="junior">junior</option>
                          <option value="mid">mid</option>
                          <option value="senior">senior</option>
                        </select>
                        <select value={jobTemplateSourceFilter} onChange={(event) => setJobTemplateSourceFilter(event.target.value as JobTemplateSourceFilter)} className="h-9 rounded-md border bg-background px-3 text-sm">
                          <option value="all">{t('allSources')}</option>
                          <option value="builtin">{t('sourceBuiltin')}</option>
                          <option value="custom">{t('sourceCustom')}</option>
                          <option value="enabled">{t('sourceEnabled')}</option>
                          <option value="disabled">{t('sourceDisabled')}</option>
                        </select>
                      </div>
                    </>
                  )}
                  columns={[
                    {
                      key: 'title',
                      header: '岗位',
                      cell: (template) => (
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{template.title}</span>
                            <Badge variant={template.builtin ? 'secondary' : 'outline'}>{template.builtin ? t('builtin') : t('custom')}</Badge>
                            {!template.enabled && <Badge variant="outline">{t('disabled')}</Badge>}
                          </div>
                          <p className="mt-1 truncate text-xs text-zinc-500">{template.roleKey} · {template.industry}</p>
                        </div>
                      ),
                    },
                    { key: 'level', header: '等级', cell: (template) => <Badge variant="outline">{template.level}</Badge> },
                    { key: 'keywords', header: '关键词', cell: (template) => <div className="flex max-w-72 flex-wrap gap-1">{template.keywords.slice(0, 4).map((keyword) => <Badge key={keyword} variant="secondary">{keyword}</Badge>)}</div> },
                    { key: 'sort', header: '排序', cell: (template) => <span className="text-xs text-zinc-500">{template.sortOrder}</span> },
                  ]}
                  renderRowActions={(template) => (
                    <>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="复制岗位模板" onClick={() => copyJobTemplate(template)}>
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      {!template.builtin && (
                        <Button type="button" variant="ghost" size="icon-xs" aria-label="编辑岗位模板" onClick={() => editJobTemplate(template)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {!template.builtin && (
                        <Button type="button" variant="ghost" size="icon-xs" aria-label="启停岗位模板" onClick={() => toggleJobTemplate(template)}>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="删除岗位模板" onClick={() => markDangerousCleanupPending(`岗位模板 ${template.title}`)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                />

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{jobTemplateForm.id ? t('saveJobTemplate') : t('createJobTemplate')}</CardTitle>
                    <p className="text-xs text-zinc-500">{t('jobTemplateFormHint')}</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <Input value={jobTemplateForm.roleKey} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, roleKey: e.target.value })} placeholder={t('jobTemplateRoleKey')} />
                      <Input value={jobTemplateForm.title} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, title: e.target.value })} placeholder={t('jobTemplateTitle')} />
                    </div>
                    <div className="grid gap-2 md:grid-cols-[1fr_120px]">
                      <Input value={jobTemplateForm.industry} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, industry: e.target.value })} placeholder={t('jobTemplateIndustry')} />
                      <select value={jobTemplateForm.level} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, level: e.target.value as AdminJobTemplateLevel })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                        <option value="intern">intern</option>
                        <option value="junior">junior</option>
                        <option value="mid">mid</option>
                        <option value="senior">senior</option>
                      </select>
                    </div>
                    <Textarea value={jobTemplateForm.jd} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, jd: e.target.value })} placeholder={t('jobTemplateJd')} className="min-h-44" />
                    <Textarea value={jobTemplateForm.keywordsText} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, keywordsText: e.target.value })} placeholder={t('jobTemplateKeywords')} className="min-h-20" />
                    <Textarea value={jobTemplateForm.recommendedSectionsText} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, recommendedSectionsText: e.target.value })} placeholder={t('jobTemplateSections')} className="min-h-20" />
                    <Textarea value={jobTemplateForm.interviewQuestionsText} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, interviewQuestionsText: e.target.value })} placeholder={t('jobTemplateQuestions')} className="min-h-24" />
                    <div className="grid gap-2 md:grid-cols-[1fr_120px]">
                      <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"><span>{t('enabled')}</span><Switch checked={jobTemplateForm.enabled} onCheckedChange={(checked) => setJobTemplateForm({ ...jobTemplateForm, enabled: checked })} /></label>
                      <Input type="number" value={jobTemplateForm.sortOrder} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, sortOrder: Number(e.target.value) || 1000 })} placeholder={t('sortOrder')} />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={saveJobTemplate} disabled={!jobTemplateForm.roleKey.trim() || !jobTemplateForm.title.trim()} className="cursor-pointer gap-2 bg-brand hover:bg-brand-hover"><Save className="h-4 w-4" />{t('saveJobTemplate')}</Button>
                      <Button variant="outline" onClick={() => setJobTemplateForm(EMPTY_JOB_TEMPLATE_FORM)}>{t('createJobTemplate')}</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="jobTemplates" className="mt-0">
          <div className="grid gap-4 lg:grid-cols-[1fr_460px]">
            <Card>
              <CardHeader className="space-y-3">
                <div>
                  <CardTitle className="text-base">{t('jobTemplates')}</CardTitle>
                  <p className="mt-1 text-xs text-zinc-500">{t('jobTemplateListHint')}</p>
                </div>
                <div className="grid gap-2 md:grid-cols-4">
                  {[
                    { label: t('jobTemplateMetricTotal'), value: jobTemplateStats.total },
                    { label: t('jobTemplateMetricCustom'), value: jobTemplateStats.custom },
                    { label: t('jobTemplateMetricEnabled'), value: jobTemplateStats.enabled },
                    { label: t('jobTemplateMetricDisabled'), value: jobTemplateStats.disabled },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-lg border px-3 py-2">
                      <p className="text-xs text-zinc-500">{metric.label}</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{metric.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_140px_140px]">
                  <Input
                    value={jobTemplateQuery}
                    onChange={(event) => setJobTemplateQuery(event.target.value)}
                    placeholder={t('jobTemplateSearchPlaceholder')}
                  />
                  <select
                    value={jobTemplateLevelFilter}
                    onChange={(event) => setJobTemplateLevelFilter(event.target.value as JobTemplateLevelFilter)}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="all">{t('allLevels')}</option>
                    <option value="intern">intern</option>
                    <option value="junior">junior</option>
                    <option value="mid">mid</option>
                    <option value="senior">senior</option>
                  </select>
                  <select
                    value={jobTemplateSourceFilter}
                    onChange={(event) => setJobTemplateSourceFilter(event.target.value as JobTemplateSourceFilter)}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="all">{t('allSources')}</option>
                    <option value="builtin">{t('sourceBuiltin')}</option>
                    <option value="custom">{t('sourceCustom')}</option>
                    <option value="enabled">{t('sourceEnabled')}</option>
                    <option value="disabled">{t('sourceDisabled')}</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {jobTemplates.length === 0 ? <p className="text-sm text-zinc-400">{t('noJobTemplates')}</p> : filteredJobTemplates.length === 0 ? <p className="text-sm text-zinc-400">{t('noJobTemplateMatches')}</p> : filteredJobTemplates.map((template) => (
                  <div key={template.id} className="rounded-lg border px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{template.title}</span>
                          <Badge variant={template.builtin ? 'secondary' : 'outline'}>{template.builtin ? t('builtin') : t('custom')}</Badge>
                          <Badge variant="outline">{template.level}</Badge>
                          {!template.enabled && <Badge variant="outline">{t('disabled')}</Badge>}
                        </div>
                        <p className="mt-1 truncate text-xs text-zinc-500">{template.roleKey} · {template.industry}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {template.keywords.slice(0, 8).map((keyword) => <Badge key={keyword} variant="secondary">{keyword}</Badge>)}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button variant="outline" size="sm" onClick={() => copyJobTemplate(template)}>{t('duplicateJobTemplate')}</Button>
                        {!template.builtin && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => editJobTemplate(template)}>{t('edit')}</Button>
                          <Button variant="outline" size="sm" onClick={() => toggleJobTemplate(template)}>
                            {template.enabled ? t('disable') : t('enable')}
                          </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{jobTemplateForm.id ? t('saveJobTemplate') : t('createJobTemplate')}</CardTitle>
                <p className="text-xs text-zinc-500">{t('jobTemplateFormHint')}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid gap-2 md:grid-cols-2">
                  <Input value={jobTemplateForm.roleKey} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, roleKey: e.target.value })} placeholder={t('jobTemplateRoleKey')} />
                  <Input value={jobTemplateForm.title} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, title: e.target.value })} placeholder={t('jobTemplateTitle')} />
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_120px]">
                  <Input value={jobTemplateForm.industry} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, industry: e.target.value })} placeholder={t('jobTemplateIndustry')} />
                  <select value={jobTemplateForm.level} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, level: e.target.value as AdminJobTemplateLevel })} className="h-9 w-full rounded-md border bg-background px-3 text-sm">
                    <option value="intern">intern</option>
                    <option value="junior">junior</option>
                    <option value="mid">mid</option>
                    <option value="senior">senior</option>
                  </select>
                </div>
                <Textarea value={jobTemplateForm.jd} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, jd: e.target.value })} placeholder={t('jobTemplateJd')} className="min-h-44" />
                <Textarea value={jobTemplateForm.keywordsText} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, keywordsText: e.target.value })} placeholder={t('jobTemplateKeywords')} className="min-h-20" />
                <Textarea value={jobTemplateForm.recommendedSectionsText} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, recommendedSectionsText: e.target.value })} placeholder={t('jobTemplateSections')} className="min-h-20" />
                <Textarea value={jobTemplateForm.interviewQuestionsText} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, interviewQuestionsText: e.target.value })} placeholder={t('jobTemplateQuestions')} className="min-h-24" />
                <div className="grid gap-2 md:grid-cols-[1fr_120px]">
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm"><span>{t('enabled')}</span><Switch checked={jobTemplateForm.enabled} onCheckedChange={(checked) => setJobTemplateForm({ ...jobTemplateForm, enabled: checked })} /></label>
                  <Input type="number" value={jobTemplateForm.sortOrder} onChange={(e) => setJobTemplateForm({ ...jobTemplateForm, sortOrder: Number(e.target.value) || 1000 })} placeholder={t('sortOrder')} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveJobTemplate} disabled={!jobTemplateForm.roleKey.trim() || !jobTemplateForm.title.trim()} className="cursor-pointer gap-2 bg-brand hover:bg-brand-hover"><Save className="h-4 w-4" />{t('saveJobTemplate')}</Button>
                  <Button variant="outline" onClick={() => setJobTemplateForm(EMPTY_JOB_TEMPLATE_FORM)}>{t('createJobTemplate')}</Button>
                </div>
              </CardContent>
            </Card>
          </div>
	        </TabsContent>

	        <TabsContent value="commerce" className="mt-0">
	          <div className="space-y-4">
              <MetricStrip
                items={[
                  { label: t('products'), value: productStats.total },
                  { label: t('orders'), value: orderStats.total },
                  { label: t('redeemCodes'), value: redeemCodeStats.total },
                  { label: t('growth'), value: (growth?.referrals.length ?? 0) + (growth?.lottery.draws.length ?? 0) },
                ]}
              />

              <div className="flex gap-2 overflow-x-auto rounded-xl border bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                {COMMERCE_PANEL_ITEMS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setCommercePanel(item.value)}
                      className={cn(
                        'inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm text-zinc-600 transition hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900',
                        commercePanel === item.value && 'bg-zinc-100 font-medium text-zinc-950 dark:bg-zinc-900 dark:text-zinc-50',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {commercePanel === 'products' && (
                <AdminDataTable
                  title={t('products')}
                  description="管理商品、价格、资源绑定和上下架状态。"
                  icon={ReceiptText}
                  rows={filteredProducts}
                  getRowId={(product) => product.id}
                  selectedIds={selectedProductIds}
                  onSelectedIdsChange={setSelectedProductIds}
                  emptyText={products.length === 0 ? t('noProducts') : '没有匹配的产品'}
                  minWidth="1080px"
                  metrics={(
                    <MetricStrip
                      items={[
                        { label: '产品总数', value: productStats.total },
                        { label: '启用', value: productStats.active, tone: 'good' },
                        { label: '停用', value: productStats.inactive },
                        { label: '标价合计', value: money(productStats.revenuePreview) },
                      ]}
                    />
                  )}
                  toolbar={<TableSearch value={productQuery} onChange={setProductQuery} placeholder="搜索产品、SKU、类型、资源" />}
                  columns={[
                    {
                      key: 'product',
                      header: '产品',
                      cell: (product) => (
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{product.name}</span>
                            <Badge variant="outline">{product.type}</Badge>
                            {!product.active && <Badge variant="secondary">{t('disabled')}</Badge>}
                          </div>
                          <p className="mt-1 truncate text-xs text-zinc-500">{product.sku} · {product.resourceType || '-'}</p>
                        </div>
                      ),
                    },
                    {
                      key: 'price',
                      header: '价格',
                      cell: (product) => (
                        <Input
                          type="number"
                          min={0}
                          value={Math.round(Number(product.priceCents || 0) / 100)}
                          onChange={(event) => {
                            const priceCents = Math.max(0, Math.round(Number(event.target.value || 0) * 100));
                            setProducts((prev) => prev.map((item) => item.id === product.id ? { ...item, priceCents } : item));
                          }}
                          onBlur={(event) => updateProduct(product, { priceCents: Math.max(0, Math.round(Number(event.target.value || 0) * 100)) })}
                          className="h-8 w-24"
                        />
                      ),
                    },
                    { key: 'money', header: '展示金额', cell: (product) => <span className="text-xs text-zinc-500">{money(product.priceCents, product.currency)}</span> },
                    { key: 'active', header: '状态', cell: (product) => <Switch checked={product.active} onCheckedChange={(checked) => updateProduct(product, { active: checked })} /> },
                  ]}
                  renderRowActions={(product) => (
                    <>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="预览产品" onClick={() => setError(`产品 ${product.name} 预览后续接入。`)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="编辑产品" onClick={() => setError('产品名称和描述编辑后续接入；价格和上下架已支持行内编辑。')}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="删除产品" onClick={() => markDangerousCleanupPending(`产品 ${product.name}`)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                />
              )}

              {commercePanel === 'orders' && (
                <AdminDataTable
                  title={t('orders')}
                  description="查看订单、支付和履约状态。"
                  icon={ListChecks}
                  rows={filteredOrders}
                  getRowId={(order) => order.id}
                  selectedIds={selectedOrderIds}
                  onSelectedIdsChange={setSelectedOrderIds}
                  emptyText={orders.length === 0 ? t('noOrders') : '没有匹配的订单'}
                  minWidth="1180px"
                  metrics={(
                    <MetricStrip
                      items={[
                        { label: '订单数', value: orderStats.total },
                        { label: '已支付', value: orderStats.paid },
                        { label: '已履约', value: orderStats.fulfilled, tone: 'good' },
                        { label: '应付金额', value: money(orderStats.payable) },
                      ]}
                    />
                  )}
                  toolbar={(
                    <>
                      <TableSearch value={orderQuery} onChange={setOrderQuery} placeholder="搜索订单号、用户、商品、支付方式" />
                      <select value={orderStatusFilter} onChange={(event) => setOrderStatusFilter(event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                        {ORDER_STATUS_OPTIONS.map((statusOption) => <option key={statusOption} value={statusOption}>{statusOption === 'all' ? '全部状态' : statusOption}</option>)}
                      </select>
                    </>
                  )}
                  columns={[
                    { key: 'order', header: '订单', cell: (order) => <div className="min-w-0"><p className="truncate font-medium">{order.orderNo}</p><p className="truncate text-xs text-zinc-500">{order.userId}</p></div> },
                    { key: 'status', header: '状态', cell: (order) => <Badge variant="outline">{order.status}</Badge> },
                    { key: 'amount', header: '金额', cell: (order) => <span className="text-xs text-zinc-500">{money(order.payableCents, order.currency)}</span> },
                    { key: 'items', header: '商品', cell: (order) => <span className="line-clamp-2 text-xs text-zinc-500">{order.items?.length ? order.items.map((item) => `${item.name} x${item.quantity}`).join(' / ') : '-'}</span> },
                    { key: 'createdAt', header: '创建时间', cell: (order) => <span className="text-xs text-zinc-500">{formatDate(order.createdAt)}</span> },
                  ]}
                  renderRowActions={(order) => (
                    <>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="预览订单" onClick={() => setError(`订单 ${order.orderNo} 详情预览后续接入。`)}>
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="编辑订单" onClick={() => setError('订单编辑/履约操作后续接入。')}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label="删除订单" onClick={() => markDangerousCleanupPending(`订单 ${order.orderNo}`)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                />
              )}

              {commercePanel === 'redeem' && (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
                  <AdminDataTable
                    title={t('redeemCodes')}
                    description="管理运营兑换码、领取次数和权益配置。"
                    icon={KeyRound}
                    rows={filteredRedeemCodes}
                    getRowId={(code) => code.id}
                    selectedIds={selectedRedeemCodeIds}
                    onSelectedIdsChange={setSelectedRedeemCodeIds}
                    emptyText={redeemCodes.length === 0 ? '暂无兑换码' : '没有匹配的兑换码'}
                    minWidth="900px"
                    metrics={(
                      <MetricStrip
                        items={[
                          { label: '兑换码', value: redeemCodeStats.total },
                          { label: '可用', value: redeemCodeStats.active, tone: 'good' },
                          { label: '已领取', value: redeemCodeStats.claimed },
                          { label: '领取上限', value: redeemCodeStats.maxClaims },
                        ]}
                      />
                    )}
                    toolbar={<TableSearch value={redeemCodeQuery} onChange={setRedeemCodeQuery} placeholder="搜索兑换码、类型、状态、权益" />}
                    columns={[
                      { key: 'code', header: '兑换码', cell: (code) => <div className="min-w-0"><p className="truncate font-medium">{code.code}</p><p className="truncate text-xs text-zinc-500">{code.type}</p></div> },
                      { key: 'status', header: '状态', cell: (code) => <Badge variant="outline">{code.status}</Badge> },
                      { key: 'claims', header: '领取', cell: (code) => <span className="text-xs text-zinc-500">{code.claimedCount}/{code.maxClaims}</span> },
                      { key: 'expiresAt', header: '过期', cell: (code) => <span className="text-xs text-zinc-500">{formatDate(code.expiresAt || undefined)}</span> },
                    ]}
                    renderRowActions={(code) => (
                      <>
                        <Button type="button" variant="ghost" size="icon-xs" aria-label="预览兑换码" onClick={() => setError(`兑换码 ${code.code} 详情预览后续接入。`)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-xs" aria-label="编辑兑换码" onClick={() => setError('兑换码编辑/停用操作后续接入。')}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon-xs" aria-label="删除兑换码" onClick={() => markDangerousCleanupPending(`兑换码 ${code.code}`)} className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  />

                  <Card>
                    <CardHeader><CardTitle className="text-base">{t('createRedeemCode')}</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                      <Input value={redeemForm.code} onChange={(e) => setRedeemForm({ ...redeemForm, code: e.target.value })} placeholder={t('redeemCode')} />
                      <Input type="number" min={1} value={redeemForm.maxClaims} onChange={(e) => setRedeemForm({ ...redeemForm, maxClaims: Math.max(1, Number(e.target.value) || 1) })} placeholder={t('maxClaims')} />
                      <Textarea value={redeemForm.benefitJson} onChange={(e) => setRedeemForm({ ...redeemForm, benefitJson: e.target.value })} placeholder={t('benefitJson')} className="min-h-40 font-mono text-xs" />
                      <Button onClick={createRedeemCode} disabled={!redeemForm.code.trim()} className="cursor-pointer gap-2 bg-brand hover:bg-brand-hover"><Plus className="h-4 w-4" />{t('createRedeemCode')}</Button>
                    </CardContent>
                  </Card>
                </div>
              )}

              {commercePanel === 'growth' && (
                <div className="rounded-xl border bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                  <MetricStrip
                    items={[
                      { label: t('referrals'), value: growth?.referrals.length ?? 0 },
                      { label: t('lotteryCampaigns'), value: growth?.lottery.campaigns.length ?? 0 },
                      { label: t('lotteryDraws'), value: growth?.lottery.draws.length ?? 0 },
                      { label: '待扩展活动', value: '-' },
                    ]}
                  />
                </div>
              )}
	          </div>
	        </TabsContent>
        </section>
	      </Tabs>
    </div>
  );
}
