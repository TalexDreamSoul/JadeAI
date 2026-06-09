'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Activity, Bot, Briefcase, ClipboardCheck, Copy, FileSliders, KeyRound, MessageSquareText, Plus, Radio, ReceiptText, RefreshCw, Save, ShieldCheck, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFingerprint } from '@/hooks/use-fingerprint';
import { TEMPLATES } from '@/lib/constants';
import { getTemplateLabel } from '@/lib/template-labels';
import { EmailAuthForm } from '@/components/auth/email-auth-form';

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

interface AdminUser {
  id: string;
  email?: string | null;
  name?: string | null;
  authType: string;
  role: string;
  aiCredits: number;
  aiCreditBalance?: number;
  createdAt?: string | number | Date;
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

const ORDER_STATUS_OPTIONS = ['all', 'pending_payment', 'paid', 'fulfilled', 'canceled'];
const AI_USAGE_STATUS_OPTIONS = ['all', 'success', 'reserved', 'failed_refunded', 'insufficient_credits'];
const REVIEW_COMMENT_STATUS_OPTIONS: ReviewCommentStatusFilter[] = ['all', 'open', 'resolved'];
const CHANGE_PROPOSAL_STATUS_OPTIONS: ChangeProposalStatusFilter[] = ['all', 'pending', 'applied', 'rejected'];

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

function formatDateTime(value?: string | number | Date) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : '-';
}

function money(cents: number, currency = 'CNY') {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(Number(cents || 0) / 100);
}

export default function AdminPage() {
  const t = useTranslations('admin');
  const tDashboard = useTranslations('dashboard');
  const { status, data: session } = useSession();
  const { isLoading } = useFingerprint();
  const [channels, setChannels] = useState<AIChannel[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [jobTemplates, setJobTemplates] = useState<AdminJobTemplate[]>([]);
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [aiUsage, setAiUsage] = useState<AdminAIUsageLog[]>([]);
  const [aiUsageStatusFilter, setAiUsageStatusFilter] = useState('all');
  const [aiUsageQuery, setAiUsageQuery] = useState('');
  const [reviewComments, setReviewComments] = useState<AdminReviewComment[]>([]);
  const [reviewCommentStatusFilter, setReviewCommentStatusFilter] = useState<ReviewCommentStatusFilter>('all');
  const [reviewCommentQuery, setReviewCommentQuery] = useState('');
  const [reviewPresence, setReviewPresence] = useState<AdminReviewPresence[]>([]);
  const [reviewPresenceQuery, setReviewPresenceQuery] = useState('');
  const [changeProposals, setChangeProposals] = useState<AdminChangeProposal[]>([]);
  const [changeProposalStatusFilter, setChangeProposalStatusFilter] = useState<ChangeProposalStatusFilter>('all');
  const [changeProposalQuery, setChangeProposalQuery] = useState('');
  const [redeemCodes, setRedeemCodes] = useState<AdminRedeemCode[]>([]);
  const [growth, setGrowth] = useState<AdminGrowthState | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    weight: 1,
  });
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
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE_FORM);
  const [templateQuery, setTemplateQuery] = useState('');
  const [templateStatusFilter, setTemplateStatusFilter] = useState<TemplateStatusFilter>('all');
  const [jobTemplateForm, setJobTemplateForm] = useState(EMPTY_JOB_TEMPLATE_FORM);
  const [jobTemplateQuery, setJobTemplateQuery] = useState('');
  const [jobTemplateLevelFilter, setJobTemplateLevelFilter] = useState<JobTemplateLevelFilter>('all');
  const [jobTemplateSourceFilter, setJobTemplateSourceFilter] = useState<JobTemplateSourceFilter>('all');
  const [redeemForm, setRedeemForm] = useState(EMPTY_REDEEM_FORM);

  const isLoggedIn = status === 'authenticated' && !!session?.user?.email;
  const currentUser = users.find((user) => user.email && user.email === session?.user?.email);
  const isAdmin = currentUser?.role === 'admin';

  const templateOptions = useMemo(() => TEMPLATES.map((template) => ({
    value: template,
    label: getTemplateLabel(template, tDashboard),
  })), [tDashboard]);

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

  const load = async () => {
    const [channelsRes, authRes, usersRes, templatesRes, jobTemplatesRes, productsRes, ordersRes, aiUsageRes, reviewCommentsRes, reviewPresenceRes, changeProposalsRes, redeemRes, growthRes] = await Promise.all([
      fetch('/api/admin/ai-channels', { headers: getHeaders() }),
      fetch('/api/admin/auth-settings', { headers: getHeaders() }),
      fetch('/api/admin/users', { headers: getHeaders() }),
      fetch('/api/templates', { headers: getHeaders() }),
      fetch('/api/admin/job-templates', { headers: getHeaders() }),
      fetch('/api/admin/products?activeOnly=0', { headers: getHeaders() }),
      fetch(`/api/admin/orders?limit=50&status=${orderStatusFilter}`, { headers: getHeaders() }),
      fetch(`/api/admin/ai-usage?limit=100&status=${aiUsageStatusFilter}`, { headers: getHeaders() }),
      fetch(`/api/admin/review-comments?limit=100&status=${reviewCommentStatusFilter}`, { headers: getHeaders() }),
      fetch('/api/admin/review-presence?limit=100&minutes=30', { headers: getHeaders() }),
      fetch(`/api/admin/change-proposals?limit=100&status=${changeProposalStatusFilter}`, { headers: getHeaders() }),
      fetch('/api/admin/redeem-codes?limit=50', { headers: getHeaders() }),
      fetch('/api/admin/growth?limit=50', { headers: getHeaders() }),
    ]);

    if (!channelsRes.ok || !authRes.ok || !usersRes.ok || !templatesRes.ok || !jobTemplatesRes.ok || !productsRes.ok || !ordersRes.ok || !aiUsageRes.ok || !reviewCommentsRes.ok || !reviewPresenceRes.ok || !changeProposalsRes.ok || !redeemRes.ok || !growthRes.ok) {
      const forbidden = [channelsRes, authRes, usersRes, jobTemplatesRes, productsRes, ordersRes, aiUsageRes, reviewCommentsRes, reviewPresenceRes, changeProposalsRes, redeemRes, growthRes].some((res) => res.status === 403);
      setError(forbidden ? t('forbidden') : t('loadFailed'));
      return;
    }

    setChannels(await channelsRes.json());
    setUsers(await usersRes.json());
    setTemplates(await templatesRes.json());
    const loadedJobTemplates = await jobTemplatesRes.json();
    setJobTemplates([...(loadedJobTemplates.builtin || []), ...(loadedJobTemplates.custom || [])]);
    const loadedProducts = await productsRes.json();
    const loadedOrders = await ordersRes.json();
    const loadedAiUsage = await aiUsageRes.json();
    const loadedReviewComments = await reviewCommentsRes.json();
    const loadedReviewPresence = await reviewPresenceRes.json();
    const loadedChangeProposals = await changeProposalsRes.json();
    const loadedRedeemCodes = await redeemRes.json();
    const loadedGrowth = await growthRes.json();
    setProducts(Array.isArray(loadedProducts.products) ? loadedProducts.products : []);
    setOrders(Array.isArray(loadedOrders.orders) ? loadedOrders.orders : []);
    setAiUsage(Array.isArray(loadedAiUsage.usage) ? loadedAiUsage.usage : []);
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
  };

  useEffect(() => {
    if (isLoading || status === 'loading') return;
    if (!isLoggedIn) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, status, isLoggedIn, orderStatusFilter, aiUsageStatusFilter, reviewCommentStatusFilter, changeProposalStatusFilter]);

  const create = async () => {
    const res = await fetch('/api/admin/ai-channels', {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ ...form, name: '', apiKey: '' });
      load();
    }
  };

  const toggle = async (channel: AIChannel) => {
    await fetch(`/api/admin/ai-channels/${channel.id}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify({ enabled: !channel.enabled }),
    });
    load();
  };

  const updateUser = async (userId: string, patch: Partial<{ role: string; aiCreditBalance: number }>) => {
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'PATCH',
      headers: getHeaders(),
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      setError(t('loadFailed'));
      return;
    }
    const updated = await res.json();
    setUsers((prev) => prev.map((user) => user.id === userId ? { ...user, ...updated } : user));
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

  if (!isLoggedIn || error === t('forbidden') || (users.length > 0 && !isAdmin)) {
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-foreground">{t('title')}</h1>
        <p className="mt-1 text-sm text-zinc-500">{t('subtitle')}</p>
      </div>

      {error && <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users" className="gap-2"><Users className="h-4 w-4" />{t('users')}</TabsTrigger>
          <TabsTrigger value="auth" className="gap-2"><KeyRound className="h-4 w-4" />{t('authSettings')}</TabsTrigger>
	          <TabsTrigger value="ai" className="gap-2"><Bot className="h-4 w-4" />{t('aiChannels')}</TabsTrigger>
	          <TabsTrigger value="aiUsage" className="gap-2"><Activity className="h-4 w-4" />{t('aiUsage')}</TabsTrigger>
	          <TabsTrigger value="reviewComments" className="gap-2"><MessageSquareText className="h-4 w-4" />{t('reviewComments')}</TabsTrigger>
	          <TabsTrigger value="reviewPresence" className="gap-2"><Radio className="h-4 w-4" />{t('reviewPresence')}</TabsTrigger>
	          <TabsTrigger value="changeProposals" className="gap-2"><ClipboardCheck className="h-4 w-4" />{t('changeProposals')}</TabsTrigger>
	          <TabsTrigger value="templates" className="gap-2"><FileSliders className="h-4 w-4" />{t('templates')}</TabsTrigger>
	          <TabsTrigger value="jobTemplates" className="gap-2"><Briefcase className="h-4 w-4" />{t('jobTemplates')}</TabsTrigger>
	          <TabsTrigger value="commerce" className="gap-2"><ReceiptText className="h-4 w-4" />{t('commerce')}</TabsTrigger>
	        </TabsList>

        <TabsContent value="users">
          <Card>
            <CardHeader><CardTitle className="text-base">{t('users')}</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {users.length === 0 ? <p className="text-sm text-zinc-400">{t('noUsers')}</p> : users.map((user) => (
                <div key={user.id} className="grid gap-3 rounded-lg border px-3 py-2 text-sm md:grid-cols-[1fr_120px_130px_160px_100px] md:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{user.name || user.email || user.id}</p>
                    <p className="truncate text-xs text-zinc-500">{user.email || '-'}</p>
                  </div>
                  <Badge variant="secondary">{user.authType}</Badge>
                  <select
                    value={user.role}
                    onChange={(event) => updateUser(user.id, { role: event.target.value })}
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-xs text-zinc-500">{t('aiCreditBalance')}</span>
                    <Input
                      type="number"
                      min={0}
                      value={user.aiCreditBalance ?? user.aiCredits ?? 0}
                      onChange={(event) => {
                        const aiCreditBalance = Math.max(0, Math.floor(Number(event.target.value) || 0));
                        setUsers((prev) => prev.map((item) => item.id === user.id ? {
                          ...item,
                          aiCreditBalance,
                          aiCredits: aiCreditBalance,
                        } : item));
                      }}
                      onBlur={(event) => updateUser(user.id, { aiCreditBalance: Math.max(0, Math.floor(Number(event.target.value) || 0)) })}
                      className="h-8 w-20"
                    />
                  </div>
                  <span className="text-xs text-zinc-500">{formatDate(user.createdAt)}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="auth">
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

        <TabsContent value="ai">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4" />{t('aiChannels')}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2 md:grid-cols-6">
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('name')} />
                <Input value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} placeholder={t('provider')} />
                <Input value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} placeholder={t('baseUrl')} />
                <Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder={t('model')} />
                <Input value={form.apiKey} onChange={(e) => setForm({ ...form, apiKey: e.target.value })} placeholder={t('apiKey')} type="password" />
                <Button onClick={create} className="cursor-pointer gap-2 bg-brand hover:bg-brand-hover"><Plus className="h-4 w-4" />{t('add')}</Button>
              </div>
              <div className="space-y-2">
                {channels.map((channel) => (
                  <div key={channel.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="font-medium">{channel.name}</span><Badge variant="secondary">{channel.provider}</Badge><Badge variant="outline">w{channel.weight}</Badge></div>
                      <p className="truncate text-xs text-zinc-500">{channel.model} · {channel.baseUrl}</p>
                    </div>
                    <Switch checked={channel.enabled} onCheckedChange={() => toggle(channel)} />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={load} className="cursor-pointer gap-2"><RefreshCw className="h-4 w-4" />{t('refresh')}</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aiUsage">
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

        <TabsContent value="reviewComments">
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

        <TabsContent value="reviewPresence">
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

        <TabsContent value="changeProposals">
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

        <TabsContent value="templates">
          <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
            <Card>
              <CardHeader className="space-y-3">
                <div>
                  <CardTitle className="text-base">{t('templates')}</CardTitle>
                  <p className="mt-1 text-xs text-zinc-500">{t('templateListHint')}</p>
                </div>
                <div className="grid gap-2 md:grid-cols-4">
                  {[
                    { label: t('templateMetricTotal'), value: templateStats.total },
                    { label: t('templateMetricPublic'), value: templateStats.public },
                    { label: t('templateMetricPrivate'), value: templateStats.private },
                    { label: t('templateMetricInstalls'), value: templateStats.installs },
                  ].map((metric) => (
                    <div key={metric.label} className="rounded-lg border px-3 py-2">
                      <p className="text-xs text-zinc-500">{metric.label}</p>
                      <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">{metric.value}</p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 md:grid-cols-[1fr_150px]">
                  <Input
                    value={templateQuery}
                    onChange={(event) => setTemplateQuery(event.target.value)}
                    placeholder={t('templateSearchPlaceholder')}
                  />
                  <select
                    value={templateStatusFilter}
                    onChange={(event) => setTemplateStatusFilter(event.target.value as TemplateStatusFilter)}
                    className="h-9 rounded-md border bg-background px-3 text-sm"
                  >
                    <option value="all">{t('allTemplateStatuses')}</option>
                    <option value="public">{t('publicOnly')}</option>
                    <option value="private">{t('privateOnly')}</option>
                  </select>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {templates.length === 0 ? <p className="text-sm text-zinc-400">{t('noTemplates')}</p> : filteredTemplates.length === 0 ? <p className="text-sm text-zinc-400">{t('noTemplateMatches')}</p> : filteredTemplates.map((template) => (
                  <div key={template.id} className="flex flex-col gap-3 rounded-lg border px-3 py-2 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{template.name}</span>
                        <Badge variant={template.isPublic ? 'secondary' : 'outline'}>{template.isPublic ? t('public') : t('private')}</Badge>
                        <Badge variant="outline">{t('templateInstallCount', { count: template.installCount })}</Badge>
                      </div>
                      <p className="truncate text-xs text-zinc-500">{template.baseTemplate} · {template.description}</p>
                    </div>
                    <div className="flex shrink-0 gap-2 self-end md:self-auto">
                      <Button variant="outline" size="sm" onClick={() => copyTemplate(template)} className="gap-1.5"><Copy className="h-4 w-4" />{t('duplicateTemplate')}</Button>
                      <Button variant="outline" size="sm" onClick={() => editTemplate(template)}>{t('edit')}</Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
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
        </TabsContent>

        <TabsContent value="jobTemplates">
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

	        <TabsContent value="commerce">
	          <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
	            <div className="space-y-4">
	              <Card>
	                <CardHeader><CardTitle className="text-base">{t('products')}</CardTitle></CardHeader>
	                <CardContent className="space-y-2">
	                  {products.length === 0 ? <p className="text-sm text-zinc-400">{t('noProducts')}</p> : products.map((product) => (
	                    <div key={product.id} className="grid gap-3 rounded-lg border px-3 py-2 text-sm md:grid-cols-[1fr_140px_110px_90px] md:items-center">
	                      <div className="min-w-0">
	                        <div className="flex flex-wrap items-center gap-2">
	                          <span className="font-medium">{product.name}</span>
	                          <Badge variant="outline">{product.type}</Badge>
	                          {!product.active && <Badge variant="secondary">{t('disabled')}</Badge>}
	                        </div>
	                        <p className="truncate text-xs text-zinc-500">{product.sku} · {product.resourceType || '-'} · {product.description}</p>
	                      </div>
	                      <Input
	                        type="number"
	                        min={0}
	                        value={Math.round(Number(product.priceCents || 0) / 100)}
	                        onChange={(event) => {
	                          const priceCents = Math.max(0, Math.round(Number(event.target.value || 0) * 100));
	                          setProducts((prev) => prev.map((item) => item.id === product.id ? { ...item, priceCents } : item));
	                        }}
	                        onBlur={(event) => updateProduct(product, { priceCents: Math.max(0, Math.round(Number(event.target.value || 0) * 100)) })}
	                        className="h-8"
	                      />
	                      <span className="text-xs text-zinc-500">{money(product.priceCents, product.currency)}</span>
	                      <Switch checked={product.active} onCheckedChange={(checked) => updateProduct(product, { active: checked })} />
	                    </div>
	                  ))}
	                </CardContent>
	              </Card>

	              <Card>
	                <CardHeader>
	                  <div className="flex items-center justify-between gap-3">
	                    <CardTitle className="text-base">{t('orders')}</CardTitle>
	                    <select
	                      value={orderStatusFilter}
	                      onChange={(event) => setOrderStatusFilter(event.target.value)}
	                      className="h-8 rounded-md border bg-background px-2 text-xs"
	                    >
	                      {ORDER_STATUS_OPTIONS.map((statusOption) => (
	                        <option key={statusOption} value={statusOption}>{statusOption}</option>
	                      ))}
	                    </select>
	                  </div>
	                </CardHeader>
	                <CardContent className="space-y-2">
	                  {orders.length === 0 ? <p className="text-sm text-zinc-400">{t('noOrders')}</p> : orders.slice(0, 12).map((order) => (
	                    <div key={order.id} className="rounded-lg border px-3 py-2 text-sm">
	                      <div className="grid gap-3 md:grid-cols-[1fr_110px_110px_100px] md:items-center">
	                        <div className="min-w-0">
	                          <p className="truncate font-medium">{order.orderNo}</p>
	                          <p className="truncate text-xs text-zinc-500">{order.userId} · {formatDate(order.createdAt)}</p>
	                        </div>
	                        <Badge variant="outline">{order.status}</Badge>
	                        <span>{money(order.payableCents, order.currency)}</span>
	                        <span className="text-xs text-zinc-500">{order.source}</span>
	                      </div>
	                      <div className="mt-2 space-y-1 border-t pt-2 text-xs text-zinc-500">
	                        <p className="line-clamp-2">
	                          {t('orderItems')}: {order.items?.length
	                            ? order.items.map((item) => `${item.name} x${item.quantity}`).join(' / ')
	                            : '-'}
	                        </p>
	                        <p>
	                          {t('payments')}: {order.payments?.length ?? 0}
	                          {' · '}
	                          {t('paidAt')}: {formatDate(order.paidAt || undefined)}
	                          {' · '}
	                          {t('fulfilledAt')}: {formatDate(order.fulfilledAt || undefined)}
	                        </p>
	                      </div>
	                    </div>
	                  ))}
	                </CardContent>
	              </Card>
	            </div>

	            <div className="space-y-4">
	              <Card>
	                <CardHeader><CardTitle className="text-base">{t('redeemCodes')}</CardTitle></CardHeader>
	                <CardContent className="space-y-3">
	                  <Input value={redeemForm.code} onChange={(e) => setRedeemForm({ ...redeemForm, code: e.target.value })} placeholder={t('redeemCode')} />
	                  <Input type="number" min={1} value={redeemForm.maxClaims} onChange={(e) => setRedeemForm({ ...redeemForm, maxClaims: Math.max(1, Number(e.target.value) || 1) })} placeholder={t('maxClaims')} />
	                  <Textarea value={redeemForm.benefitJson} onChange={(e) => setRedeemForm({ ...redeemForm, benefitJson: e.target.value })} placeholder={t('benefitJson')} className="min-h-40 font-mono text-xs" />
	                  <Button onClick={createRedeemCode} disabled={!redeemForm.code.trim()} className="cursor-pointer gap-2 bg-brand hover:bg-brand-hover"><Plus className="h-4 w-4" />{t('createRedeemCode')}</Button>
	                  <div className="space-y-2 pt-2">
	                    {redeemCodes.slice(0, 8).map((code) => (
	                      <div key={code.id} className="rounded-lg border px-3 py-2 text-sm">
	                        <div className="flex items-center justify-between gap-3">
	                          <span className="font-medium">{code.code}</span>
	                          <Badge variant="outline">{code.status}</Badge>
	                        </div>
	                        <p className="mt-1 text-xs text-zinc-500">{code.claimedCount}/{code.maxClaims} · {code.type} · {formatDate(code.expiresAt || undefined)}</p>
	                      </div>
	                    ))}
	                  </div>
	                </CardContent>
	              </Card>

	              <Card>
	                <CardHeader><CardTitle className="text-base">{t('growth')}</CardTitle></CardHeader>
	                <CardContent className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
	                  <div className="rounded-lg border px-3 py-2">
	                    <div className="text-xs text-zinc-500">{t('referrals')}</div>
	                    <div className="mt-1 text-xl font-semibold">{growth?.referrals.length ?? 0}</div>
	                  </div>
	                  <div className="rounded-lg border px-3 py-2">
	                    <div className="text-xs text-zinc-500">{t('lotteryCampaigns')}</div>
	                    <div className="mt-1 text-xl font-semibold">{growth?.lottery.campaigns.length ?? 0}</div>
	                  </div>
	                  <div className="rounded-lg border px-3 py-2">
	                    <div className="text-xs text-zinc-500">{t('lotteryDraws')}</div>
	                    <div className="mt-1 text-xl font-semibold">{growth?.lottery.draws.length ?? 0}</div>
	                  </div>
	                </CardContent>
	              </Card>
	            </div>
	          </div>
	        </TabsContent>
	      </Tabs>
    </div>
  );
}
