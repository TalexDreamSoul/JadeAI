'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Bot, FileSliders, KeyRound, Plus, RefreshCw, Save, Users } from 'lucide-react';
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

interface AuthSettings {
  passwordLoginEnabled: boolean;
  passwordRegisterEnabled: boolean;
  googleLoginEnabled: boolean;
  googleClientId: string;
  googleClientSecret: string;
  googleClientSecretSet?: boolean;
}

interface AdminUser {
  id: string;
  email?: string | null;
  name?: string | null;
  authType: string;
  role: string;
  aiCredits: number;
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

const EMPTY_TEMPLATE_FORM = {
  id: '',
  name: '',
  description: '',
  baseTemplate: 'touch-pure',
  themeJson: '{\n  "primaryColor": "#1a1a1a",\n  "accentColor": "#3b82f6"\n}',
  customCss: '',
  isPublic: false,
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

export default function AdminPage() {
  const t = useTranslations('admin');
  const tDashboard = useTranslations('dashboard');
  const { status, data: session } = useSession();
  const { isLoading } = useFingerprint();
  const [channels, setChannels] = useState<AIChannel[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
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
    passwordLoginEnabled: true,
    passwordRegisterEnabled: true,
    googleLoginEnabled: false,
    googleClientId: '',
    googleClientSecret: '',
    googleClientSecretSet: false,
  });
  const [templateForm, setTemplateForm] = useState(EMPTY_TEMPLATE_FORM);

  const isLoggedIn = status === 'authenticated' && !!session?.user?.email;
  const currentUser = users.find((user) => user.email && user.email === session?.user?.email);
  const isAdmin = currentUser?.role === 'admin';

  const templateOptions = useMemo(() => TEMPLATES.map((template) => ({
    value: template,
    label: getTemplateLabel(template, tDashboard),
  })), [tDashboard]);

  const load = async () => {
    const [channelsRes, authRes, usersRes, templatesRes] = await Promise.all([
      fetch('/api/admin/ai-channels', { headers: getHeaders() }),
      fetch('/api/admin/auth-settings', { headers: getHeaders() }),
      fetch('/api/admin/users', { headers: getHeaders() }),
      fetch('/api/templates', { headers: getHeaders() }),
    ]);

    if (!channelsRes.ok || !authRes.ok || !usersRes.ok || !templatesRes.ok) {
      setError(channelsRes.status === 403 || authRes.status === 403 || usersRes.status === 403 ? t('forbidden') : t('loadFailed'));
      return;
    }

    setChannels(await channelsRes.json());
    setUsers(await usersRes.json());
    setTemplates(await templatesRes.json());
    const loadedAuth = await authRes.json();
    setAuthSettings({
      passwordLoginEnabled: loadedAuth.passwordLoginEnabled,
      passwordRegisterEnabled: loadedAuth.passwordRegisterEnabled,
      googleLoginEnabled: loadedAuth.googleLoginEnabled,
      googleClientId: loadedAuth.googleClientId || '',
      googleClientSecret: '',
      googleClientSecretSet: loadedAuth.googleClientSecretSet,
    });
    setError('');
  };

  useEffect(() => {
    if (isLoading || status === 'loading') return;
    if (!isLoggedIn) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, status, isLoggedIn]);

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

  const updateUser = async (userId: string, patch: Partial<{ role: string; aiCredits: number }>) => {
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
    const safeAuthSettings = { ...authSettings, googleClientSecret: undefined };
    const payload = {
      ...safeAuthSettings,
      ...(authSettings.googleClientSecret.trim()
        ? { googleClientSecret: authSettings.googleClientSecret.trim() }
        : {}),
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
    setAuthSettings({
      passwordLoginEnabled: updated.passwordLoginEnabled,
      passwordRegisterEnabled: updated.passwordRegisterEnabled,
      googleLoginEnabled: updated.googleLoginEnabled,
      googleClientId: updated.googleClientId || '',
      googleClientSecret: '',
      googleClientSecretSet: updated.googleClientSecretSet,
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

  if (status === 'loading' || isLoading) {
    return <div className="rounded-xl border bg-white p-6 text-sm text-zinc-500">{t('loadFailed')}...</div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="rounded-xl border bg-white p-6 text-sm text-zinc-500 dark:bg-zinc-900">
        {t('forbidden')}
      </div>
    );
  }

  if (users.length > 0 && !isAdmin) {
    return (
      <div className="rounded-xl border bg-white p-6 text-sm text-zinc-500 dark:bg-zinc-900">
        {t('forbidden')}
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
                    <span className="shrink-0 text-xs text-zinc-500">{t('aiCredits')}</span>
                    <Input
                      type="number"
                      min={0}
                      value={user.aiCredits ?? 0}
                      onChange={(event) => {
                        const aiCredits = Math.max(0, Math.floor(Number(event.target.value) || 0));
                        setUsers((prev) => prev.map((item) => item.id === user.id ? { ...item, aiCredits } : item));
                      }}
                      onBlur={(event) => updateUser(user.id, { aiCredits: Math.max(0, Math.floor(Number(event.target.value) || 0)) })}
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
              <div className="grid gap-3 md:grid-cols-3">
                <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span>{t('passwordLogin')}</span>
                  <Switch checked={authSettings.passwordLoginEnabled} onCheckedChange={(checked) => setAuthSettings((s) => ({ ...s, passwordLoginEnabled: checked }))} />
                </label>
                <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span>{t('passwordRegister')}</span>
                  <Switch checked={authSettings.passwordRegisterEnabled} onCheckedChange={(checked) => setAuthSettings((s) => ({ ...s, passwordRegisterEnabled: checked }))} />
                </label>
                <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                  <span>{t('googleOAuth')}</span>
                  <Switch checked={authSettings.googleLoginEnabled} onCheckedChange={(checked) => setAuthSettings((s) => ({ ...s, googleLoginEnabled: checked }))} />
                </label>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <Input value={authSettings.googleClientId} onChange={(e) => setAuthSettings((s) => ({ ...s, googleClientId: e.target.value }))} placeholder={t('googleClientId')} />
                <Input value={authSettings.googleClientSecret} onChange={(e) => setAuthSettings((s) => ({ ...s, googleClientSecret: e.target.value }))} placeholder={authSettings.googleClientSecretSet ? t('googleClientSecretSet') : t('googleClientSecret')} type="password" />
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
      </Tabs>
    </div>
  );
}
