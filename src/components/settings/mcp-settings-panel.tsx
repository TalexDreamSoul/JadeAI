'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Clipboard, KeyRound, Loader2, PlugZap, RefreshCw, ShieldCheck, Trash2, WandSparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

type McpAccess = {
  enabled: boolean;
  tokenPreview: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  lastUsedAt: string | null;
};

type McpConfig = {
  access: McpAccess;
  endpoint: string;
  transport: string;
  tools: string[];
};

function getHeaders(): Record<string, string> {
  const fingerprint = typeof window !== 'undefined'
    ? localStorage.getItem('touchresume_fingerprint')
    : null;
  return {
    'Content-Type': 'application/json',
    ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
  };
}

function formatTime(value: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function currentWebsiteEndpoint(endpoint: string) {
  if (typeof window === 'undefined') return endpoint;
  try {
    const url = new URL(endpoint || '/api/mcp/resume', window.location.origin);
    return `${window.location.origin}${url.pathname}${url.search}`;
  } catch {
    return `${window.location.origin}/api/mcp/resume`;
  }
}

function buildConfigSnippet(endpoint: string, token: string | null) {
  return JSON.stringify({
    mcpServers: {
      jadeai_resume: {
        url: endpoint || 'https://your-jadeai-domain.com/api/mcp/resume',
        headers: {
          Authorization: `Bearer ${token || '<your-token>'}`,
        },
      },
    },
  }, null, 2);
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildSkillMarkdown(endpoint: string, token: string | null) {
  const endpointValue = endpoint || 'https://your-jadeai-domain.com/api/mcp/resume';
  const tokenValue = token || '<your-token>';
  const authHeader = `Authorization: Bearer ${tokenValue}`;

  return `---
name: jadeai-resume
description: Use when the user asks to read, analyze, tailor, or safely update JadeAI/TouchResume resumes, JD analyses, knowledge graph data, or resume chat history via the user's JadeAI MCP API key.
---

# JadeAI Resume

Use the user's JadeAI Resume MCP access token/API key to work with resume data.

## Connection

- Endpoint: \`${endpointValue}\`
- Header: \`${authHeader}\`

\`\`\`json
${buildConfigSnippet(endpointValue, tokenValue)}
\`\`\`

If the MCP client does not import the JSON automatically, add the HTTP MCP server manually with the same endpoint and header.

## JSON-RPC smoke test

\`\`\`bash
curl -s ${shellQuote(endpointValue)} \\
  -H 'Content-Type: application/json' \\
  -H ${shellQuote(authHeader)} \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
\`\`\`

## Workflow

1. Prefer read tools first: \`list_resumes\`, \`get_resume\`, \`list_jd_analyses\`, \`search_knowledge\`, \`get_resume_context_pack\`.
2. Prefer suggestion-first editing: call \`create_change_proposal\` for user-accepted/rejected changes, especially when the user asks for comments or suggested edits.
3. For direct writes, never write blindly. First call \`create_resume_version\`.
4. Run write tools in preview mode first. Apply only when the user approves and pass \`versionId\` with \`apply: true\`.
5. Do not print, commit, or share this token/API key.
`;
}

function buildSkillInstallSnippet(endpoint: string, token: string | null) {
  return `mkdir -p ~/.pi/agent/skills/jadeai-resume
cat > ~/.pi/agent/skills/jadeai-resume/SKILL.md <<'EOF'
${buildSkillMarkdown(endpoint, token)}
EOF`;
}

export function McpSettingsPanel() {
  const t = useTranslations('settings.mcp');
  const tc = useTranslations('common');
  const [config, setConfig] = useState<McpConfig | null>(null);
  const [freshToken, setFreshToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mcp/config', {
        headers: getHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Failed to load MCP config');
      const data = await res.json();
      setConfig({ ...data, endpoint: currentWebsiteEndpoint(data.endpoint || '') });
    } catch {
      toast.error(t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  const snippet = useMemo(
    () => buildConfigSnippet(config?.endpoint || '', freshToken),
    [config?.endpoint, freshToken],
  );

  const skillSnippet = useMemo(
    () => buildSkillInstallSnippet(config?.endpoint || '', freshToken),
    [config?.endpoint, freshToken],
  );

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success(t('copied'));
      setTimeout(() => setCopied((current) => (current === key ? null : current)), 1500);
    } catch {
      toast.error(t('copyFailed'));
    }
  };

  const createToken = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/mcp/token', {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to create MCP token');
      const data = await res.json();
      setFreshToken(data.token);
      setConfig((current) => current ? { ...current, access: data.access } : current);
      toast.success(t('tokenCreated'));
    } catch {
      toast.error(t('tokenCreateFailed'));
    } finally {
      setSaving(false);
    }
  };

  const revokeToken = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/mcp/token', {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to revoke MCP token');
      const data = await res.json();
      setFreshToken(null);
      setConfig((current) => current ? { ...current, access: data.access } : current);
      toast.success(t('tokenRevoked'));
    } catch {
      toast.error(t('tokenRevokeFailed'));
    } finally {
      setSaving(false);
      setRevokeOpen(false);
    }
  };

  const enabled = !!config?.access.enabled;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <PlugZap className="h-4 w-4 text-brand" />
            <h3 className="text-sm font-semibold">{t('resumeServer')}</h3>
            <Badge
              variant={enabled ? 'default' : 'outline'}
              className={cn(enabled && 'bg-emerald-600 text-white')}
            >
              {enabled ? t('enabled') : t('disabled')}
            </Badge>
          </div>
          <p className="max-w-[420px] text-xs leading-5 text-zinc-500">
            {t('description')}
          </p>
        </div>
        <Button
          variant="outline"
          size="icon-sm"
          className="cursor-pointer"
          onClick={loadConfig}
          disabled={loading}
          title={t('refresh')}
          aria-label={t('refresh')}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        </Button>
      </div>

      <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium">
              <KeyRound className="h-4 w-4 text-zinc-500" />
              {t('token')}
            </div>
            <p className="text-xs text-zinc-500">
              {enabled
                ? t('tokenActive', { token: config?.access.tokenPreview || '-' })
                : t('tokenEmpty')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="cursor-pointer gap-2 bg-brand hover:bg-brand-hover"
              onClick={createToken}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              {enabled ? t('resetToken') : t('createToken')}
            </Button>
            {enabled && (
              <Button
                size="sm"
                variant="outline"
                className="cursor-pointer gap-2 text-red-600 hover:text-red-700"
                onClick={() => setRevokeOpen(true)}
                disabled={saving}
              >
                <Trash2 className="h-4 w-4" />
                {t('revoke')}
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 text-xs text-zinc-500 sm:grid-cols-3">
          <div>
            <div className="font-medium text-zinc-700 dark:text-zinc-300">{t('createdAt')}</div>
            <div className="mt-1">{formatTime(config?.access.createdAt || null)}</div>
          </div>
          <div>
            <div className="font-medium text-zinc-700 dark:text-zinc-300">{t('updatedAt')}</div>
            <div className="mt-1">{formatTime(config?.access.updatedAt || null)}</div>
          </div>
          <div>
            <div className="font-medium text-zinc-700 dark:text-zinc-300">{t('lastUsedAt')}</div>
            <div className="mt-1">{formatTime(config?.access.lastUsedAt || null)}</div>
          </div>
        </div>
      </div>

      {freshToken && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-sm font-medium">{t('freshTokenTitle')}</div>
              <p className="mt-1 text-xs leading-5">{t('freshTokenHint')}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 cursor-pointer gap-2 bg-white/70 dark:bg-transparent"
              onClick={() => copyText('token', freshToken)}
            >
              {copied === 'token' ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
              {t('copyToken')}
            </Button>
          </div>
          <code className="mt-3 block break-all rounded-md bg-white/70 px-3 py-2 text-xs dark:bg-black/20">
            {freshToken}
          </code>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{t('endpoint')}</div>
            <p className="text-xs text-zinc-500">{t('endpointHint')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer gap-2"
            onClick={() => copyText('endpoint', config?.endpoint || '')}
            disabled={!config?.endpoint}
          >
            {copied === 'endpoint' ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
            {t('copy')}
          </Button>
        </div>
        <code className="block break-all rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs dark:border-zinc-800 dark:bg-zinc-950">
          {config?.endpoint || '...'}
        </code>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{t('clientConfig')}</div>
            <p className="text-xs text-zinc-500">{t('clientConfigHint')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer gap-2"
            onClick={() => copyText('config', snippet)}
          >
            {copied === 'config' ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
            {t('copy')}
          </Button>
        </div>
        <Textarea
          readOnly
          value={snippet}
          className="min-h-36 resize-none font-mono text-xs"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <WandSparkles className="h-4 w-4 text-brand" />
              {t('skill')}
            </div>
            <p className="text-xs text-zinc-500">{t('skillHint')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer gap-2"
            onClick={() => copyText('skill', skillSnippet)}
          >
            {copied === 'skill' ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
            {t('copySkill')}
          </Button>
        </div>
        <Textarea
          readOnly
          value={skillSnippet}
          className="min-h-40 resize-none font-mono text-xs"
        />
        <p className="text-xs text-amber-600 dark:text-amber-400">
          {freshToken ? t('skillFreshTokenHint') : t('skillPlaceholderHint')}
        </p>
      </div>

      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-100">
        <div className="mb-1 flex items-center gap-2 font-medium">
          <ShieldCheck className="h-4 w-4" />
          {t('safetyTitle')}
        </div>
        <p>{t('safetyHint')}</p>
      </div>

      <AlertDialog open={revokeOpen} onOpenChange={setRevokeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('revokeConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('revokeConfirmDesc')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">{tc('cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={revokeToken}
              className="cursor-pointer bg-red-600 hover:bg-red-700"
            >
              {t('revoke')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
