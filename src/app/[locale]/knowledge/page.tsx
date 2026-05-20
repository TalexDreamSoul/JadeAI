'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Brain, GitBranch, Plus, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

const TYPE_TONES: Record<string, string> = {
  jd: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-300',
  skill_gap: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300',
  learning_task: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300',
  interview_question: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300',
  skill: 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-300',
};

function relationLabel(relation: string, t: ReturnType<typeof useTranslations>) {
  const key = `relations.${relation}`;
  try {
    return t(key);
  } catch {
    return relation;
  }
}

function headers() {
  const fingerprint = typeof window !== 'undefined' ? localStorage.getItem('touchresume_fingerprint') : null;
  return {
    'Content-Type': 'application/json',
    ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
  };
}

export default function KnowledgePage({ embedded = false }: { embedded?: boolean } = {}) {
  const t = useTranslations('knowledge');
  const { isLoading } = useFingerprint();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [form, setForm] = useState({ type: 'skill', label: '', content: '' });
  const [activeType, setActiveType] = useState('all');

  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const nodeTypes = ['all', ...Array.from(new Set(nodes.map((node) => node.type)))];
  const filteredNodes = activeType === 'all' ? nodes : nodes.filter((node) => node.type === activeType);
  const groupedNodes = filteredNodes.reduce<Record<string, Node[]>>((groups, node) => {
    groups[node.type] = [...(groups[node.type] || []), node];
    return groups;
  }, {});
  const learningTasks = nodes.filter((node) => node.type === 'learning_task');

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
      {!embedded && (
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-zinc-900 dark:text-foreground">
            <Brain className="h-6 w-6 text-brand" />
            {t('title')}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">{t('subtitle')}</p>
        </div>
      )}

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

      <Tabs defaultValue="graph" className="space-y-4">
        <TabsList>
          <TabsTrigger value="graph" className="gap-2"><GitBranch className="h-4 w-4" />{t('graphView')}</TabsTrigger>
          <TabsTrigger value="learning" className="gap-2"><Target className="h-4 w-4" />{t('learningPath')}</TabsTrigger>
        </TabsList>

        <TabsContent value="graph" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {nodeTypes.map((type) => (
              <Button key={type} size="sm" variant={activeType === type ? 'default' : 'outline'} onClick={() => setActiveType(type)} className={activeType === type ? 'bg-brand hover:bg-brand-hover' : ''}>
                {type === 'all' ? t('allTypes') : type}
              </Button>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              {Object.entries(groupedNodes).map(([type, items]) => (
                <section key={type} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-sm font-semibold">{type}</h2>
                    <Badge variant="secondary">{items.length}</Badge>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {items.map((node) => (
                      <div key={node.id} className={`rounded-lg border p-3 ${TYPE_TONES[node.type] || 'bg-zinc-50 dark:bg-zinc-800'}`}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <h3 className="truncate font-semibold">{node.label}</h3>
                          <Badge variant="outline">{node.type}</Badge>
                        </div>
                        <p className="line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-zinc-600 dark:text-zinc-300">{node.content}</p>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
              {filteredNodes.length === 0 && (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-400">{t('noNodes')}</div>
              )}
            </div>

            <aside className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <h2 className="mb-3 text-sm font-semibold">{t('connections')}</h2>
              {edges.length === 0 ? (
                <p className="text-sm text-zinc-400">{t('noConnections')}</p>
              ) : (
                <div className="space-y-2 text-sm">
                  {edges.map((edge) => {
                    const from = nodeById.get(edge.fromNodeId);
                    const to = nodeById.get(edge.toNodeId);
                    return (
                      <div key={edge.id} className="rounded-md border bg-zinc-50 p-3 dark:bg-zinc-800">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{from?.type || t('unknown')}</Badge>
                          <span className="font-medium">{from?.label || edge.fromNodeId}</span>
                        </div>
                        <div className="my-2 text-xs font-semibold text-brand">{relationLabel(edge.relation, t)}</div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="outline">{to?.type || t('unknown')}</Badge>
                          <span className="font-medium">{to?.label || edge.toNodeId}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="learning" className="space-y-3">
          {learningTasks.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-zinc-400">{t('noLearningTasks')}</div>
          ) : learningTasks.map((task) => {
            const incoming = edges
              .filter((edge) => edge.toNodeId === task.id || edge.fromNodeId === task.id)
              .map((edge) => edge.fromNodeId === task.id ? nodeById.get(edge.toNodeId) : nodeById.get(edge.fromNodeId))
              .filter(Boolean) as Node[];
            return (
              <div key={task.id} className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-semibold">{task.label}</h2>
                  <Badge variant="secondary">{task.type}</Badge>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-zinc-600 dark:text-zinc-300">{task.content}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {incoming.length ? incoming.map((node) => <Badge key={node.id} variant="outline">{node.label}</Badge>) : <span className="text-xs text-zinc-400">{t('noConnections')}</span>}
                </div>
              </div>
            );
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
}
