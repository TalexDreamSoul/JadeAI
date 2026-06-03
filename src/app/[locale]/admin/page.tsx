'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Bot, Briefcase, FileSliders, KeyRound, Plus, ReceiptText, RefreshCw, Save, ShieldCheck, Users } from 'lucide-react';
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
  const [jobTemplateForm, setJobTemplateForm] = useState(EMPTY_JOB_TEMPLATE_FORM);
  const [redeemForm, setRedeemForm] = useState(EMPTY_REDEEM_FORM);

  const isLoggedIn = status === 'authenticated' && !!session?.user?.email;
  const currentUser = users.find((user) => user.email && user.email === session?.user?.email);
  const isAdmin = currentUser?.role === 'admin';

  const templateOptions = useMemo(() => TEMPLATES.map((template) => ({
    value: template,
    label: getTemplateLabel(template, tDashboard),
  })), [tDashboard]);

  const load = async () => {
    const [channelsRes, authRes, usersRes, templatesRes, jobTemplatesRes, productsRes, ordersRes, redeemRes, growthRes] = await Promise.all([
      fetch('/api/admin/ai-channels', { headers: getHeaders() }),
      fetch('/api/admin/auth-settings', { headers: getHeaders() }),
      fetch('/api/admin/users', { headers: getHeaders() }),
      fetch('/api/templates', { headers: getHeaders() }),
      fetch('/api/admin/job-templates', { headers: getHeaders() }),
      fetch('/api/admin/products?activeOnly=0', { headers: getHeaders() }),
      fetch(`/api/admin/orders?limit=50&status=${orderStatusFilter}`, { headers: getHeaders() }),
      fetch('/api/admin/redeem-codes?limit=50', { headers: getHeaders() }),
      fetch('/api/admin/growth?limit=50', { headers: getHeaders() }),
    ]);

    if (!channelsRes.ok || !authRes.ok || !usersRes.ok || !templatesRes.ok || !jobTemplatesRes.ok || !productsRes.ok || !ordersRes.ok || !redeemRes.ok || !growthRes.ok) {
      const forbidden = [channelsRes, authRes, usersRes, jobTemplatesRes, productsRes, ordersRes, redeemRes, growthRes].some((res) => res.status === 403);
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
    const loadedRedeemCodes = await redeemRes.json();
    const loadedGrowth = await growthRes.json();
    setProducts(Array.isArray(loadedProducts.products) ? loadedProducts.products : []);
    setOrders(Array.isArray(loadedOrders.orders) ? loadedOrders.orders : []);
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
  }, [isLoading, status, isLoggedIn, orderStatusFilter]);

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
      passwordLoginEnabled: authSettings.passwordLoginEnabled,
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
              <div className="rounded-lg border bg-zinc-50 p-3 text-sm dark:bg-zinc-900/60">
                <div className="grid gap-2 md:grid-cols-2">
                  <p><span className="text-zinc-500">{t('authMode')}:</span> <Badge variant="secondary">{authSettings.authMode}</Badge></p>
                  <p><span className="text-zinc-500">{t('adminPasswordLogin')}:</span> <Badge variant={authSettings.adminPasswordEnabled ? 'secondary' : 'outline'}>{authSettings.adminPasswordEnabled ? t('enabled') : t('disabled')}</Badge></p>
                  <p><span className="text-zinc-500">{t('publicPasswordLogin')}:</span> <Badge variant={authSettings.publicPasswordEnabled ? 'secondary' : 'outline'}>{authSettings.publicPasswordEnabled ? t('enabled') : t('disabled')}</Badge></p>
                  <p><span className="text-zinc-500">{t('passwordRegister')}:</span> <Badge variant={authSettings.passwordRegisterEnabled ? 'secondary' : 'outline'}>{authSettings.passwordRegisterEnabled ? t('enabled') : t('disabled')}</Badge></p>
                </div>
              </div>

              {authSettings.authMode === 'local' && (
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>{t('passwordLogin')}</span>
                    <Switch checked={authSettings.passwordLoginEnabled} onCheckedChange={(checked) => setAuthSettings((s) => ({ ...s, passwordLoginEnabled: checked }))} />
                  </label>
                  <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                    <span>{t('passwordRegister')}</span>
                    <Switch checked={authSettings.passwordRegisterEnabled} onCheckedChange={(checked) => setAuthSettings((s) => ({ ...s, passwordRegisterEnabled: checked }))} />
                  </label>
                </div>
              )}

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

        <TabsContent value="templates">
          <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
            <Card>
              <CardHeader><CardTitle className="text-base">{t('templates')}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {templates.length === 0 ? <p className="text-sm text-zinc-400">{t('noTemplates')}</p> : templates.map((template) => (
                  <div key={template.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2"><span className="font-medium">{template.name}</span>{template.isPublic && <Badge variant="secondary">Public</Badge>}<Badge variant="outline">{template.installCount}</Badge></div>
                      <p className="truncate text-xs text-zinc-500">{template.baseTemplate} · {template.description}</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => editTemplate(template)}>{t('edit')}</Button>
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
              <CardHeader><CardTitle className="text-base">{t('jobTemplates')}</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {jobTemplates.length === 0 ? <p className="text-sm text-zinc-400">{t('noJobTemplates')}</p> : jobTemplates.map((template) => (
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
                      {!template.builtin && (
                        <div className="flex shrink-0 gap-2">
                          <Button variant="outline" size="sm" onClick={() => editJobTemplate(template)}>{t('edit')}</Button>
                          <Button variant="outline" size="sm" onClick={() => toggleJobTemplate(template)}>
                            {template.enabled ? t('disable') : t('enable')}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">{jobTemplateForm.id ? t('saveJobTemplate') : t('createJobTemplate')}</CardTitle></CardHeader>
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
