'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Brain, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useFingerprint } from '@/hooks/use-fingerprint';

interface Node {
  id: string;
  type: string;
  label: string;
  content: string;
}

interface Edge {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relation: string;
}

function headers() {
  const fingerprint = typeof window !== 'undefined' ? localStorage.getItem('touchresume_fingerprint') : null;
  return {
    'Content-Type': 'application/json',
    ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
  };
}

export default function KnowledgePage() {
  const t = useTranslations('knowledge');
  const { isLoading } = useFingerprint();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [form, setForm] = useState({ type: 'skill', label: '', content: '' });

  const load = async () => {
    const res = await fetch('/api/knowledge', { headers: headers() });
    if (res.ok) {
      const data = await res.json();
      setNodes(data.nodes || []);
      setEdges(data.edges || []);
    }
  };

  useEffect(() => {
    if (isLoading) return;
    let cancelled = false;
    fetch('/api/knowledge', { headers: headers() })
      .then((res) => (res.ok ? res.json() : { nodes: [], edges: [] }))
      .then((data) => {
        if (cancelled) return;
        setNodes(data.nodes || []);
        setEdges(data.edges || []);
      })
      .catch(() => {
        if (cancelled) return;
        setNodes([]);
        setEdges([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isLoading]);

  const create = async () => {
    const res = await fetch('/api/knowledge', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setForm({ type: 'skill', label: '', content: '' });
      load();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-foreground">
          <Brain className="h-6 w-6 text-brand" />
          {t('title')}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{t('subtitle')}</p>
      </div>

      <div className="grid gap-3 rounded-xl border bg-white p-4 dark:bg-zinc-900 md:grid-cols-[160px_1fr_auto]">
        <Input value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} placeholder={t('type')} />
        <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder={t('label')} />
        <Button onClick={create} disabled={!form.label.trim()} className="cursor-pointer gap-2 bg-brand hover:bg-brand-hover">
          <Plus className="h-4 w-4" />
          {t('add')}
        </Button>
        <Textarea
          value={form.content}
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          placeholder={t('content')}
          className="md:col-span-3"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-[1fr_320px]">
        <div className="grid gap-3 md:grid-cols-2">
          {nodes.map((node) => (
            <div key={node.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">{node.label}</h3>
                <Badge variant="secondary">{node.type}</Badge>
              </div>
              <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-300">{node.content}</p>
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold">{t('connections')}</h2>
          {edges.length === 0 ? (
            <p className="text-sm text-zinc-400">{t('noConnections')}</p>
          ) : (
            <div className="space-y-2 text-sm">
              {edges.map((edge) => (
                <div key={edge.id} className="rounded-md bg-zinc-50 p-2 dark:bg-zinc-800">
                  {edge.fromNodeId} - {edge.relation} - {edge.toNodeId}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
