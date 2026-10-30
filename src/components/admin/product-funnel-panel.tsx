'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type FunnelStep = {
  key: string;
  label: string;
  eventNames: string[];
  actors: number;
  conversionFromPrevious: number | null;
  conversionFromStart: number | null;
};

type FunnelResponse = {
  days: 7 | 30;
  since: string;
  until: string;
  uniqueActors: number;
  funnels: Array<{
    key: string;
    label: string;
    steps: FunnelStep[];
  }>;
};

function requestHeaders(): Record<string, string> {
  const fingerprint = typeof window !== 'undefined'
    ? localStorage.getItem('touchresume_fingerprint')
    : null;
  return fingerprint ? { 'x-fingerprint': fingerprint } : {};
}

function conversion(value: number | null) {
  return value === null ? '-' : `${value.toFixed(1)}%`;
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString(undefined, { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    : '-';
}

export function ProductFunnelPanel() {
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<FunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/product-funnel?days=${days}`, { headers: requestHeaders() });
      if (!response.ok) throw new Error('漏斗数据加载失败');
      setData(await response.json());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '漏斗数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4 dark:border-zinc-800">
        <div>
          <h2 className="text-base font-semibold">核心产品漏斗</h2>
          <p className="mt-1 text-xs text-zinc-500">按区间内去重用户统计；转化率以前一步到达人数为分母。</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex h-9 rounded-md border bg-zinc-50 p-0.5 dark:border-zinc-800 dark:bg-zinc-900">
            {[7, 30].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setDays(value as 7 | 30)}
                className={cn(
                  'h-8 min-w-14 rounded px-3 text-xs font-medium text-zinc-500 transition',
                  days === value && 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-zinc-50',
                )}
              >
                {value} 天
              </button>
            ))}
          </div>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => void load()} disabled={loading} aria-label="刷新漏斗">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>重试</Button>
        </div>
      )}

      {loading && !data ? (
        <div className="flex h-40 items-center justify-center text-sm text-zinc-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中
        </div>
      ) : data ? (
        <>
          <div className="grid gap-px overflow-hidden rounded-md border bg-zinc-200 sm:grid-cols-3 dark:border-zinc-800 dark:bg-zinc-800">
            <div className="bg-white px-4 py-3 dark:bg-zinc-950">
              <p className="text-xs text-zinc-500">去重用户</p>
              <p className="mt-1 text-xl font-semibold tabular-nums">{data.uniqueActors}</p>
            </div>
            <div className="bg-white px-4 py-3 dark:bg-zinc-950">
              <p className="text-xs text-zinc-500">开始时间</p>
              <p className="mt-1 text-sm font-medium">{dateLabel(data.since)}</p>
            </div>
            <div className="bg-white px-4 py-3 dark:bg-zinc-950">
              <p className="text-xs text-zinc-500">截止时间</p>
              <p className="mt-1 text-sm font-medium">{dateLabel(data.until)}</p>
            </div>
          </div>

          {data.funnels.map((funnel) => (
            <section key={funnel.key} className="overflow-hidden rounded-md border bg-white dark:border-zinc-800 dark:bg-zinc-950">
              <div className="border-b px-4 py-3 dark:border-zinc-800">
                <h3 className="text-sm font-semibold">{funnel.label}</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[680px] table-fixed text-sm">
                  <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900/70">
                    <tr>
                      <th className="w-14 px-4 py-2 font-medium">步骤</th>
                      <th className="px-4 py-2 font-medium">到达节点</th>
                      <th className="w-28 px-4 py-2 text-right font-medium">用户数</th>
                      <th className="w-32 px-4 py-2 text-right font-medium">上一步转化</th>
                      <th className="w-32 px-4 py-2 text-right font-medium">起点转化</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y dark:divide-zinc-800">
                    {funnel.steps.map((step, index) => (
                      <tr key={step.key}>
                        <td className="px-4 py-3 text-xs tabular-nums text-zinc-400">{index + 1}</td>
                        <td className="px-4 py-3 font-medium">{step.label}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{step.actors}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">{conversion(step.conversionFromPrevious)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-zinc-500">{conversion(step.conversionFromStart)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      ) : null}
    </div>
  );
}
