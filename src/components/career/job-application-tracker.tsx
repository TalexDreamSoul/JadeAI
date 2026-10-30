'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  BriefcaseBusiness,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
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
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useFingerprint } from '@/hooks/use-fingerprint';
import { Link } from '@/i18n/routing';
import type { JobApplicationResult, JobApplicationStage } from '@/lib/career/job-application';

type Application = {
  id: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  sourceUrl: string | null;
  stage: JobApplicationStage;
  result: JobApplicationResult;
  resumeId: string | null;
  jdAnalysisId: string | null;
  interviewSessionId: string | null;
  appliedAt: string | number | null;
  resultAt: string | number | null;
  notes: string;
  createdAt: string | number;
  updatedAt: string | number;
  resume: { id: string; title: string; targetCompany: string | null; targetJobTitle: string | null } | null;
  jdAnalysis: { id: string; resumeId: string; overallScore: number; atsScore: number; createdAt: string | number } | null;
  interview: { id: string; jobTitle: string; status: string; createdAt: string | number } | null;
};

type ApplicationOptions = {
  resumes: Array<{
    id: string;
    title: string;
    targetCompany: string | null;
    targetJobTitle: string | null;
    jobDescription: string | null;
  }>;
  jdAnalyses: Array<{
    id: string;
    resumeId: string;
    resumeTitle: string;
    companyName: string | null;
    jobTitle: string | null;
    jobDescription: string;
    overallScore: number;
    createdAt: string | number;
  }>;
  interviews: Array<{
    id: string;
    resumeId: string | null;
    jobTitle: string;
    status: string;
    createdAt: string | number;
  }>;
};

type FormState = {
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  sourceUrl: string;
  stage: JobApplicationStage;
  result: JobApplicationResult;
  resumeId: string;
  jdAnalysisId: string;
  interviewSessionId: string;
  appliedAt: string;
  resultAt: string;
  notes: string;
};

type TrackerDefaults = Partial<Pick<FormState, 'companyName' | 'jobTitle' | 'jobDescription' | 'resumeId'>>;

const PAGE_SIZE = 10;
const STAGES: JobApplicationStage[] = ['saved', 'applied', 'screening', 'interview', 'offer', 'closed'];
const RESULTS: JobApplicationResult[] = ['pending', 'offer', 'rejected', 'withdrawn', 'no_response'];

function requestHeaders() {
  const fingerprint = typeof window !== 'undefined' ? localStorage.getItem('touchresume_fingerprint') : null;
  return {
    'Content-Type': 'application/json',
    ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
  };
}

function todayInputValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function emptyForm(defaults: TrackerDefaults = {}): FormState {
  return {
    companyName: defaults.companyName || '',
    jobTitle: defaults.jobTitle || '',
    jobDescription: defaults.jobDescription || '',
    sourceUrl: '',
    stage: 'applied',
    result: 'pending',
    resumeId: defaults.resumeId || '',
    jdAnalysisId: '',
    interviewSessionId: '',
    appliedAt: todayInputValue(),
    resultAt: '',
    notes: '',
  };
}

function toInputDate(value: string | number | null) {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
}

async function readError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  return payload && typeof payload.error === 'string' ? payload.error : fallback;
}

export function JobApplicationTracker({ defaults = {} }: { defaults?: TrackerDefaults }) {
  const t = useTranslations('careerApplications');
  const { isLoading: fingerprintLoading } = useFingerprint();
  const [items, setItems] = useState<Application[]>([]);
  const [options, setOptions] = useState<ApplicationOptions>({ resumes: [], jdAnalyses: [], interviews: [] });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [queryDraft, setQueryDraft] = useState('');
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<JobApplicationStage | 'all'>('all');
  const [result, setResult] = useState<JobApplicationResult | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [quickUpdatingId, setQuickUpdatingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);
  const [form, setForm] = useState<FormState>(() => emptyForm(defaults));

  useEffect(() => {
    if (fingerprintLoading) return;
    let cancelled = false;
    fetch('/api/career/applications/options', { headers: requestHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response, t('loadFailed')));
        return response.json();
      })
      .then((payload) => {
        if (!cancelled) setOptions(payload);
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : t('loadFailed'));
      });
    return () => {
      cancelled = true;
    };
  }, [fingerprintLoading, t]);

  useEffect(() => {
    if (fingerprintLoading) return;
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) params.set('query', query);
    if (stage !== 'all') params.set('stage', stage);
    if (result !== 'all') params.set('result', result);
    setLoading(true);
    fetch(`/api/career/applications?${params}`, { headers: requestHeaders() })
      .then(async (response) => {
        if (!response.ok) throw new Error(await readError(response, t('loadFailed')));
        return response.json();
      })
      .then((payload) => {
        if (cancelled) return;
        setItems(payload.items || []);
        setTotal(Number(payload.total || 0));
        setTotalPages(Math.max(1, Number(payload.totalPages || 1)));
      })
      .catch((error) => {
        if (!cancelled) toast.error(error instanceof Error ? error.message : t('loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fingerprintLoading, page, query, result, stage, t]);

  const reload = async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
    if (query) params.set('query', query);
    if (stage !== 'all') params.set('stage', stage);
    if (result !== 'all') params.set('result', result);
    const response = await fetch(`/api/career/applications?${params}`, { headers: requestHeaders() });
    if (!response.ok) throw new Error(await readError(response, t('loadFailed')));
    const payload = await response.json();
    setItems(payload.items || []);
    setTotal(Number(payload.total || 0));
    setTotalPages(Math.max(1, Number(payload.totalPages || 1)));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm(defaults));
    setDialogOpen(true);
  };

  const openEdit = (application: Application) => {
    setEditingId(application.id);
    setForm({
      companyName: application.companyName,
      jobTitle: application.jobTitle,
      jobDescription: application.jobDescription || '',
      sourceUrl: application.sourceUrl || '',
      stage: application.stage,
      result: application.result,
      resumeId: application.resumeId || '',
      jdAnalysisId: application.jdAnalysisId || '',
      interviewSessionId: application.interviewSessionId || '',
      appliedAt: toInputDate(application.appliedAt),
      resultAt: toInputDate(application.resultAt),
      notes: application.notes || '',
    });
    setDialogOpen(true);
  };

  const selectResume = (resumeId: string) => {
    const normalizedId = resumeId === 'none' ? '' : resumeId;
    const resume = options.resumes.find((item) => item.id === normalizedId);
    setForm((current) => ({
      ...current,
      resumeId: normalizedId,
      companyName: current.companyName || resume?.targetCompany || '',
      jobTitle: current.jobTitle || resume?.targetJobTitle || '',
      jobDescription: current.jobDescription || resume?.jobDescription || '',
    }));
  };

  const selectAnalysis = (analysisId: string) => {
    const normalizedId = analysisId === 'none' ? '' : analysisId;
    const analysis = options.jdAnalyses.find((item) => item.id === normalizedId);
    setForm((current) => ({
      ...current,
      jdAnalysisId: normalizedId,
      resumeId: current.resumeId || analysis?.resumeId || '',
      companyName: current.companyName || analysis?.companyName || '',
      jobTitle: current.jobTitle || analysis?.jobTitle || '',
      jobDescription: current.jobDescription || analysis?.jobDescription || '',
    }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.companyName.trim() || !form.jobTitle.trim()) {
      toast.error(t('requiredFields'));
      return;
    }
    setSaving(true);
    try {
      const response = await fetch(
        editingId ? `/api/career/applications/${editingId}` : '/api/career/applications',
        {
          method: editingId ? 'PATCH' : 'POST',
          headers: requestHeaders(),
          body: JSON.stringify({
            ...form,
            resumeId: form.resumeId || null,
            jdAnalysisId: form.jdAnalysisId || null,
            interviewSessionId: form.interviewSessionId || null,
            appliedAt: form.appliedAt || null,
            resultAt: form.resultAt || null,
          }),
        },
      );
      if (!response.ok) throw new Error(await readError(response, t('saveFailed')));
      setDialogOpen(false);
      toast.success(editingId ? t('updated') : t('created'));
      if (!editingId && page !== 1) setPage(1);
      else await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const quickUpdate = async (
    application: Application,
    update: Partial<Pick<Application, 'stage' | 'result' | 'resultAt'>>,
  ) => {
    setQuickUpdatingId(application.id);
    try {
      const response = await fetch(`/api/career/applications/${application.id}`, {
        method: 'PATCH',
        headers: requestHeaders(),
        body: JSON.stringify(update),
      });
      if (!response.ok) throw new Error(await readError(response, t('saveFailed')));
      await reload();
      toast.success(t('updated'));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('saveFailed'));
    } finally {
      setQuickUpdatingId(null);
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setQuickUpdatingId(deleteTarget.id);
    try {
      const response = await fetch(`/api/career/applications/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: requestHeaders(),
      });
      if (!response.ok) throw new Error(await readError(response, t('deleteFailed')));
      setDeleteTarget(null);
      toast.success(t('deleted'));
      if (items.length === 1 && page > 1) setPage((current) => current - 1);
      else await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('deleteFailed'));
    } finally {
      setQuickUpdatingId(null);
    }
  };

  const formatDate = (value: string | number | null, dateOnly = false) => {
    if (!value) return t('notSet');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return t('notSet');
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...(dateOnly ? { timeZone: 'UTC' } : {}),
    }).format(date);
  };

  return (
    <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <BriefcaseBusiness className="h-4 w-4 text-brand" />
            <h2 className="text-sm font-semibold">{t('title')}</h2>
          </div>
          <p className="mt-1 text-xs text-zinc-500">{t('summary', { count: total })}</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-brand hover:bg-brand-hover">
          <Plus className="h-4 w-4" />
          {t('newApplication')}
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center">
        <form
          className="flex min-w-0 flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setPage(1);
            setQuery(queryDraft.trim());
          }}
        >
          <Input
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            placeholder={t('searchPlaceholder')}
            className="min-w-0"
          />
          <Button type="submit" variant="outline" size="icon" title={t('search')}>
            <Search className="h-4 w-4" />
          </Button>
        </form>
        <Select value={stage} onValueChange={(value) => { setStage(value as JobApplicationStage | 'all'); setPage(1); }}>
          <SelectTrigger className="w-full lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allStages')}</SelectItem>
            {STAGES.map((value) => <SelectItem key={value} value={value}>{t(`stages.${value}`)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={result} onValueChange={(value) => { setResult(value as JobApplicationResult | 'all'); setPage(1); }}>
          <SelectTrigger className="w-full lg:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('allResults')}</SelectItem>
            {RESULTS.map((value) => <SelectItem key={value} value={value}>{t(`results.${value}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 overflow-x-auto rounded-md border">
        <table className="w-full min-w-[980px] border-collapse text-left text-sm">
          <thead className="bg-zinc-50 text-xs font-medium text-zinc-500 dark:bg-zinc-950 dark:text-zinc-400">
            <tr>
              <th className="w-[230px] px-3 py-2.5">{t('companyAndRole')}</th>
              <th className="w-[150px] px-3 py-2.5">{t('stage')}</th>
              <th className="w-[150px] px-3 py-2.5">{t('result')}</th>
              <th className="w-[130px] px-3 py-2.5">{t('appliedAt')}</th>
              <th className="px-3 py-2.5">{t('relations')}</th>
              <th className="w-[120px] px-3 py-2.5">{t('updatedAt')}</th>
              <th className="w-[92px] px-3 py-2.5 text-right">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y dark:divide-zinc-800">
            {loading ? (
              <tr><td colSpan={7} className="h-36 text-center text-zinc-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="h-40 text-center">
                  <BriefcaseBusiness className="mx-auto h-6 w-6 text-zinc-300" />
                  <p className="mt-2 text-sm text-zinc-500">{query || stage !== 'all' || result !== 'all' ? t('noMatches') : t('empty')}</p>
                  {!query && stage === 'all' && result === 'all' && (
                    <Button variant="outline" size="sm" onClick={openCreate} className="mt-3 gap-2">
                      <Plus className="h-3.5 w-3.5" />
                      {t('newApplication')}
                    </Button>
                  )}
                </td>
              </tr>
            ) : items.map((application) => (
              <tr key={application.id} className="align-top hover:bg-zinc-50/70 dark:hover:bg-zinc-950/50">
                <td className="px-3 py-3">
                  <div className="flex items-start gap-1.5">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-900 dark:text-zinc-100">{application.companyName}</p>
                      <p className="mt-0.5 truncate text-xs text-zinc-500">{application.jobTitle}</p>
                    </div>
                    {application.sourceUrl && (
                      <a href={application.sourceUrl} target="_blank" rel="noopener noreferrer" title={t('openSource')} className="mt-0.5 shrink-0 text-zinc-400 hover:text-brand">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={application.stage}
                    disabled={quickUpdatingId === application.id}
                    onValueChange={(value) => quickUpdate(application, { stage: value as JobApplicationStage })}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STAGES.map((value) => <SelectItem key={value} value={value}>{t(`stages.${value}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={application.result}
                    disabled={quickUpdatingId === application.id}
                    onValueChange={(value) => quickUpdate(application, {
                      result: value as JobApplicationResult,
                      resultAt: value === 'pending' ? null : application.resultAt || todayInputValue(),
                    })}
                  >
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RESULTS.map((value) => <SelectItem key={value} value={value}>{t(`results.${value}`)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </td>
                <td className="px-3 py-3 text-xs text-zinc-500">{formatDate(application.appliedAt, true)}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {application.resume && (
                      <Badge variant="outline" asChild>
                        <Link href={`/editor/${application.resume.id}`}>{application.resume.title}</Link>
                      </Badge>
                    )}
                    {application.jdAnalysis && (
                      <Badge variant="secondary">{t('matchScore', { score: application.jdAnalysis.overallScore })}</Badge>
                    )}
                    {application.interview && (
                      <Badge variant="outline" asChild>
                        <Link href={`/interview/${application.interview.id}`}>{t('interview')}</Link>
                      </Badge>
                    )}
                    {!application.resume && !application.jdAnalysis && !application.interview && <span className="text-xs text-zinc-400">{t('notSet')}</span>}
                  </div>
                </td>
                <td className="px-3 py-3 text-xs text-zinc-500">{formatDate(application.updatedAt)}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon-sm" variant="ghost" onClick={() => openEdit(application)} title={t('edit')}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon-sm" variant="ghost" onClick={() => setDeleteTarget(application)} title={t('delete')} className="text-red-500 hover:text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-zinc-500">
        <span>{t('pagination', { page, totalPages, total })}</span>
        <div className="flex gap-1">
          <Button size="icon-sm" variant="outline" disabled={loading || page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))} title={t('previousPage')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="icon-sm" variant="outline" disabled={loading || page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))} title={t('nextPage')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{editingId ? t('editTitle') : t('createTitle')}</DialogTitle>
              <DialogDescription>{t('formDescription')}</DialogDescription>
            </DialogHeader>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="application-company">{t('company')}</Label>
                <Input id="application-company" value={form.companyName} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} required maxLength={160} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="application-role">{t('role')}</Label>
                <Input id="application-role" value={form.jobTitle} onChange={(event) => setForm((current) => ({ ...current, jobTitle: event.target.value }))} required maxLength={160} />
              </div>
              <div className="space-y-2">
                <Label>{t('stage')}</Label>
                <Select value={form.stage} onValueChange={(value) => setForm((current) => ({ ...current, stage: value as JobApplicationStage }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{STAGES.map((value) => <SelectItem key={value} value={value}>{t(`stages.${value}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('result')}</Label>
                <Select value={form.result} onValueChange={(value) => setForm((current) => ({
                  ...current,
                  result: value as JobApplicationResult,
                  stage: value === 'offer'
                    ? 'offer'
                    : value === 'rejected' || value === 'withdrawn' || value === 'no_response'
                      ? 'closed'
                      : current.stage,
                  resultAt: value === 'pending' ? '' : current.resultAt || todayInputValue(),
                }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>{RESULTS.map((value) => <SelectItem key={value} value={value}>{t(`results.${value}`)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="application-applied-at">{t('appliedAt')}</Label>
                <Input id="application-applied-at" type="date" value={form.appliedAt} onChange={(event) => setForm((current) => ({ ...current, appliedAt: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="application-result-at">{t('resultAt')}</Label>
                <Input id="application-result-at" type="date" value={form.resultAt} onChange={(event) => setForm((current) => ({ ...current, resultAt: event.target.value }))} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="application-source">{t('sourceUrl')}</Label>
                <Input id="application-source" type="url" value={form.sourceUrl} onChange={(event) => setForm((current) => ({ ...current, sourceUrl: event.target.value }))} placeholder="https://" maxLength={2000} />
              </div>
              <div className="space-y-2">
                <Label>{t('resume')}</Label>
                <Select value={form.resumeId || 'none'} onValueChange={selectResume}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('notSet')}</SelectItem>
                    {options.resumes.map((resume) => <SelectItem key={resume.id} value={resume.id}>{resume.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('jdAnalysis')}</Label>
                <Select value={form.jdAnalysisId || 'none'} onValueChange={selectAnalysis}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('notSet')}</SelectItem>
                    {options.jdAnalyses.map((analysis) => (
                      <SelectItem key={analysis.id} value={analysis.id}>{analysis.resumeTitle} · {t('matchScore', { score: analysis.overallScore })}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>{t('interview')}</Label>
                <Select value={form.interviewSessionId || 'none'} onValueChange={(value) => setForm((current) => ({ ...current, interviewSessionId: value === 'none' ? '' : value }))}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('notSet')}</SelectItem>
                    {options.interviews.map((interview) => (
                      <SelectItem key={interview.id} value={interview.id}>{interview.jobTitle} · {t(`interviewStatuses.${interview.status}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="application-jd">{t('jobDescription')}</Label>
                <Textarea id="application-jd" value={form.jobDescription} onChange={(event) => setForm((current) => ({ ...current, jobDescription: event.target.value }))} className="min-h-32" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="application-notes">{t('notes')}</Label>
                <Textarea id="application-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="min-h-24" />
              </div>
            </div>
            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>{t('cancel')}</Button>
              <Button type="submit" disabled={saving} className="bg-brand hover:bg-brand-hover">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('deleteDescription', { company: deleteTarget?.companyName || '', role: deleteTarget?.jobTitle || '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={remove}>{t('delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
