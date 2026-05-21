'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Brain,
  Briefcase,
  Check,
  ClipboardPaste,
  ExternalLink,
  FileText,
  GitBranch,
  Languages,
  Loader2,
  MessageSquareText,
  Network,
  Pencil,
  Plus,
  RotateCcw,
  Sparkles,
  SpellCheck,
  Target,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
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
import { SettingsLauncher } from '@/components/layout/settings-launcher';
import { useFingerprint } from '@/hooks/use-fingerprint';
import { Link, useRouter } from '@/i18n/routing';
import { getAIHeaders } from '@/stores/settings-store';
import { useEditorStore } from '@/stores/editor-store';
import type { Resume } from '@/types/resume';
import { InterviewLobby } from '@/components/interview/interview-lobby';
import KnowledgePage from '@/app/[locale]/knowledge/page';

type CareerWorkbenchProps = {
  embedded?: boolean;
  resumeId?: string;
  activeTab?: CareerWorkbenchTab;
  onActiveTabChange?: (tab: CareerWorkbenchTab) => void;
  onResumeChanged?: () => void | Promise<void>;
};

export type CareerWorkbenchTab = 'match' | 'history' | 'memory' | 'knowledge' | 'interview';
export type CareerWorkbenchAiTool = 'ai-review' | 'translate' | 'cover-letter' | 'grammar-check';
type JdHistoryAction = 'match-analysis' | 'cloud-analysis' | 'derive-resume' | 'build-knowledge' | 'create-interview';

type JobTemplate = {
  id?: string;
  roleKey: string;
  title: string;
  level: string;
  industry: string;
  jd: string;
  keywords: string[];
  interviewQuestions: string[];
  recommendedSections: string[];
  scope?: 'public' | 'personal';
  enabled?: boolean;
};

type MemoryItem = {
  id: string;
  type: string;
  title: string;
  content: string;
  source: string;
  confidence: number;
};

type ApplicableSuggestion = {
  sectionType: string;
  targetField: string;
  current: string;
  suggested: string;
  reason: string;
  evidenceRequired: boolean;
};

type AppliedSuggestionState = {
  sectionId: string;
  previousContent: unknown;
};

type JdAnalysisResult = {
  overallScore: number;
  atsScore: number;
  keywordMatches: string[];
  missingKeywords: string[];
  suggestions: { section: string; current: string; suggested: string }[];
  applicableSuggestions?: ApplicableSuggestion[];
  summary: string;
  historyId?: string;
};

type JdHistoryItem = {
  id: string;
  resumeId?: string;
  resumeTitle?: string;
  resumeVersionLabel?: string;
  targetCompany?: string;
  targetJobTitle?: string;
  isCurrentResume?: boolean;
  isBaseResume?: boolean;
  overallScore: number;
  atsScore: number;
  jobDescription: string;
  createdAt: string | number | Date;
  status?: 'pending' | 'success' | 'failed' | 'running';
  error?: string;
};

function getHeaders() {
  const fingerprint = typeof window !== 'undefined' ? localStorage.getItem('touchresume_fingerprint') : null;
  return {
    'Content-Type': 'application/json',
    ...(fingerprint ? { 'x-fingerprint': fingerprint } : {}),
  };
}

function getRequestHeaders(includeAI = false) {
  return {
    ...getHeaders(),
    ...(includeAI ? getAIHeaders() : {}),
  };
}

function scoreTone(score?: number) {
  if (typeof score !== 'number') return 'text-zinc-500';
  if (score >= 75) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 55) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

type DiffPart = { value: string; type: 'same' | 'removed' | 'added' };

function pushDiffPart(parts: DiffPart[], value: string, type: DiffPart['type']) {
  if (!value) return;
  const last = parts[parts.length - 1];
  if (last?.type === type) last.value += value;
  else parts.push({ value, type });
}

function buildCharDiff(oldText: string, newText: string) {
  const oldChars = Array.from(oldText || '');
  const newChars = Array.from(newText || '');
  if (oldChars.length * newChars.length > 250000) {
    return {
      oldParts: [{ value: oldText, type: 'removed' as const }],
      newParts: [{ value: newText, type: 'added' as const }],
    };
  }

  const dp = Array.from({ length: oldChars.length + 1 }, () => Array(newChars.length + 1).fill(0));
  for (let i = oldChars.length - 1; i >= 0; i--) {
    for (let j = newChars.length - 1; j >= 0; j--) {
      dp[i][j] = oldChars[i] === newChars[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const oldParts: DiffPart[] = [];
  const newParts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < oldChars.length || j < newChars.length) {
    if (i < oldChars.length && j < newChars.length && oldChars[i] === newChars[j]) {
      pushDiffPart(oldParts, oldChars[i], 'same');
      pushDiffPart(newParts, newChars[j], 'same');
      i++;
      j++;
    } else if (j < newChars.length && (i === oldChars.length || dp[i][j + 1] >= dp[i + 1][j])) {
      pushDiffPart(newParts, newChars[j], 'added');
      j++;
    } else if (i < oldChars.length) {
      pushDiffPart(oldParts, oldChars[i], 'removed');
      i++;
    }
  }
  return { oldParts, newParts };
}

function renderDiffParts(parts: DiffPart[], side: 'old' | 'new') {
  return parts.map((part, index) => {
    const changed = part.type === 'removed' || part.type === 'added';
    const className = part.type === 'removed'
      ? 'rounded bg-red-500/15 px-0.5 text-red-700 line-through decoration-red-500 dark:bg-red-500/20 dark:text-red-300'
      : part.type === 'added'
        ? 'rounded bg-emerald-500/15 px-0.5 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
        : undefined;
    if (!changed && side === 'old') return <span key={index}>{part.value}</span>;
    if (!changed && side === 'new') return <span key={index}>{part.value}</span>;
    return <span key={index} className={className}>{part.value}</span>;
  });
}

export const CAREER_WORKBENCH_TABS: { value: CareerWorkbenchTab; icon: React.ElementType; labelKey: string }[] = [
  { value: 'match', icon: Target, labelKey: 'matchTab' },
  { value: 'memory', icon: Brain, labelKey: 'memoryTab' },
  { value: 'knowledge', icon: Network, labelKey: 'knowledgeTab' },
  { value: 'interview', icon: MessageSquareText, labelKey: 'interviewTab' },
];

export function CareerWorkbenchNav({
  activeTab,
  onActiveTabChange,
  onOpenAiTool,
}: {
  activeTab: CareerWorkbenchTab;
  onActiveTabChange: (tab: CareerWorkbenchTab) => void;
  onOpenAiTool?: (tool: CareerWorkbenchAiTool) => void;
}) {
  const t = useTranslations('career');
  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r bg-white dark:border-zinc-800 dark:bg-zinc-900 max-md:w-full max-md:border-r-0">
      <div className="p-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
          {t('nav')}
        </h3>
      </div>
      <div className="min-h-0 flex-1 space-y-3 px-2">
        <div className="space-y-0.5">
          {CAREER_WORKBENCH_TABS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.value;
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => onActiveTabChange(item.value)}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 ${
                  active
                    ? 'bg-brand-muted text-brand dark:bg-brand-muted dark:text-brand'
                    : 'text-zinc-600 hover:bg-zinc-50 dark:text-zinc-400 dark:hover:bg-zinc-800'
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{t(item.labelKey)}</span>
              </button>
            );
          })}
        </div>
        {onOpenAiTool && (
          <div className="border-t pt-3 dark:border-zinc-800">
            <p className="mb-1.5 px-2 text-xs text-zinc-400">{t('quickActions')}</p>
            <button type="button" onClick={() => onOpenAiTool('ai-review')} className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
              <Wand2 className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('aiReviewTool')}</span>
            </button>
            <button type="button" onClick={() => onOpenAiTool('translate')} className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
              <Languages className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('translateTool')}</span>
            </button>
            <button type="button" onClick={() => onOpenAiTool('cover-letter')} className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('coverLetterTool')}</span>
            </button>
            <button type="button" onClick={() => onOpenAiTool('grammar-check')} className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200">
              <SpellCheck className="h-4 w-4 shrink-0" />
              <span className="truncate">{t('grammarCheckTool')}</span>
            </button>
          </div>
        )}
      </div>
      <div className="space-y-2 border-t p-2 dark:border-zinc-800">
        <SettingsLauncher variant="sidebar" />
      </div>
    </div>
  );
}

export function CareerWorkbench({ embedded = false, resumeId, activeTab, onActiveTabChange, onResumeChanged }: CareerWorkbenchProps) {
  const t = useTranslations('career');
  const router = useRouter();
  const { isLoading: fpLoading } = useFingerprint();
  const setHighlightedSectionType = useEditorStore((state) => state.setHighlightedSectionType);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [jdHistory, setJdHistory] = useState<JdHistoryItem[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState('');
  const [selectedTemplateKey, setSelectedTemplateKey] = useState('');
  const [internalActiveTab, setInternalActiveTab] = useState<CareerWorkbenchTab>('match');
  const [jobTitle, setJobTitle] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [memoryForm, setMemoryForm] = useState({ type: 'profile', title: '', content: '' });
  const [editingMemoryId, setEditingMemoryId] = useState<string | null>(null);
  const [jdDialogOpen, setJdDialogOpen] = useState(false);
  const [analysis, setAnalysis] = useState<JdAnalysisResult | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [appliedSuggestions, setAppliedSuggestions] = useState<Record<number, AppliedSuggestionState>>({});

  const selectedResume = useMemo(
    () => resumes.find((resume) => resume.id === selectedResumeId) || null,
    [resumes, selectedResumeId]
  );
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.roleKey === selectedTemplateKey) || null,
    [templates, selectedTemplateKey]
  );
  const suggestions = analysis?.applicableSuggestions?.length
    ? analysis.applicableSuggestions
    : analysis?.suggestions?.map((item) => ({
      sectionType: item.section,
      targetField: item.section === 'summary' ? 'text' : 'highlights',
      current: item.current,
      suggested: item.suggested,
      reason: item.suggested,
      evidenceRequired: true,
    })) || [];
  const currentTab = activeTab || internalActiveTab;
  const setCurrentTab = onActiveTabChange || setInternalActiveTab;

  const load = async () => {
    const [resumeRes, templateRes, memoryRes] = await Promise.all([
      fetch('/api/resume', { headers: getRequestHeaders() }),
      fetch('/api/career/job-templates', { headers: getRequestHeaders() }),
      fetch('/api/career/memories', { headers: getRequestHeaders() }),
    ]);

    if (resumeRes.ok) {
      const data = await resumeRes.json();
      const cloudResumes = Array.isArray(data) ? data.filter((resume: Resume) => resume.cloudSyncEnabled !== false) : [];
      setResumes(cloudResumes);
      setSelectedResumeId((current) => resumeId || current || cloudResumes[0]?.id || '');
    }
    if (templateRes.ok) {
      const data = await templateRes.json();
      setTemplates(Array.isArray(data) ? data : []);
    }
    if (memoryRes.ok) {
      const data = await memoryRes.json();
      setMemories(Array.isArray(data) ? data : []);
    }
  };

  const loadJdHistory = async (targetResumeId = selectedResumeId) => {
    if (!targetResumeId) return;
    const res = await fetch(`/api/ai/jd-analysis/history?resumeId=${targetResumeId}`, { headers: getRequestHeaders() });
    if (!res.ok) return;
    const data = await res.json();
    const serverItems = Array.isArray(data)
      ? data.map((item: JdHistoryItem) => ({ ...item, status: item.status || 'success' as const }))
      : [];
    setJdHistory((current) => {
      const transientItems = current.filter((item) => item.status === 'running');
      const serverIds = new Set(serverItems.map((item: JdHistoryItem) => item.id));
      return [...transientItems.filter((item) => !serverIds.has(item.id)), ...serverItems];
    });
  };

  useEffect(() => {
    if (fpLoading) return;
    load().catch((error) => {
      console.error('Failed to load career workbench:', error);
      toast.error(t('loadFailed'));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fpLoading, resumeId]);

  useEffect(() => {
    if (resumeId) setSelectedResumeId(resumeId);
  }, [resumeId]);

  useEffect(() => {
    if (!selectedResumeId) return;
    loadJdHistory(selectedResumeId).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResumeId]);

  const applyTemplate = (roleKey: string) => {
    setSelectedTemplateKey(roleKey);
    const template = templates.find((item) => item.roleKey === roleKey);
    if (!template) return;
    setJobTitle(template.title);
    setJobDescription(template.jd);
    setAnalysis(null);
    setAppliedSuggestions({});
  };

  const loadHistoryDetail = async (item: JdHistoryItem) => {
    if (item.status === 'pending' || item.status === 'running' || item.status === 'failed') return null;
    const res = await fetch(`/api/ai/jd-analysis/history?resumeId=${selectedResumeId}&id=${item.id}`, { headers: getRequestHeaders() });
    if (!res.ok) return null;
    return res.json();
  };

  const applyHistoryDetail = (detail: any) => {
    setJobDescription(detail.jobDescription || '');
    setAnalysis({ ...detail.result, historyId: detail.id });
    setAppliedSuggestions({});
    setCurrentTab('match');
  };

  const openHistoryItem = async (item: JdHistoryItem) => {
    if (item.status === 'pending' || item.status === 'running' || item.status === 'failed') {
      setJobDescription(item.jobDescription || '');
      setAnalysis(null);
      setAppliedSuggestions({});
      setCurrentTab('match');
      return;
    }
    const detail = await loadHistoryDetail(item);
    if (!detail) return;
    applyHistoryDetail(detail);
  };

  const runAnalysis = async (mode: 'current' | 'cloud' = 'current', jdOverride?: string) => {
    const targetJobDescription = jdOverride ?? jobDescription;
    if (!selectedResumeId || !targetJobDescription.trim()) {
      toast.error(t('missingResumeOrJd'));
      return;
    }
    const busyKey = mode === 'cloud' ? 'cloud-analysis' : 'analysis';
    const transientId = `local-${Date.now()}`;
    let historyRecordId = transientId;
    if (mode === 'cloud') {
      setJdHistory((current) => [{
        id: transientId,
        overallScore: 0,
        atsScore: 0,
        jobDescription: targetJobDescription.slice(0, 100),
        createdAt: new Date(),
        status: 'running',
      }, ...current]);
    }
    setBusy(busyKey);
    try {
      const headers = mode === 'cloud'
        ? { ...getHeaders(), 'x-ai-mode': 'server' }
        : getRequestHeaders(true);
      const res = await fetch('/api/ai/jd-analysis', {
        method: 'POST',
        headers,
        body: JSON.stringify({ resumeId: selectedResumeId, jobDescription: targetJobDescription }),
      });
      const data = await res.json().catch(async () => ({ error: await res.text().catch(() => '') }));
      if (mode === 'cloud' && data.historyId) {
        historyRecordId = data.historyId;
        setJdHistory((current) => current.map((item) => item.id === transientId ? { ...item, id: data.historyId } : item));
      }
      if (!res.ok) throw new Error(data.error || res.statusText || t('analysisFailed'));
      setAnalysis(data);
      setAppliedSuggestions({});
      if (mode === 'cloud') {
        setJdHistory((current) => current.map((item) => item.id === historyRecordId ? {
          ...item,
          id: data.historyId || historyRecordId,
          overallScore: data.overallScore || 0,
          atsScore: data.atsScore || 0,
          status: 'success',
        } : item));
      }
      await loadJdHistory();
      toast.success(mode === 'cloud' ? t('cloudAnalysisDone') : t('analysisDone'));
    } catch (error) {
      const message = error instanceof Error ? error.message : t('analysisFailed');
      console.error(error);
      if (mode === 'cloud') {
        setJdHistory((current) => current.map((item) => item.id === historyRecordId ? {
          ...item,
          status: 'failed',
          error: message,
        } : item));
      }
      toast.error(message.includes('log in') || message.includes('Unauthorized') ? t('cloudAnalysisUnauthorized') : t('analysisFailed'), {
        description: message,
      });
    } finally {
      setBusy(null);
    }
  };

  const deriveResume = async (jdOverride?: string) => {
    const targetJobDescription = jdOverride ?? jobDescription;
    if (!selectedResumeId || !targetJobDescription.trim()) {
      toast.error(t('missingResumeOrJd'));
      return;
    }
    setBusy('derive');
    try {
      const res = await fetch(`/api/resume/${selectedResumeId}/derive`, {
        method: 'POST',
        headers: getRequestHeaders(true),
        body: JSON.stringify({
          targetCompany,
          targetJobTitle: jobTitle || selectedTemplate?.title || '',
          jobDescription: targetJobDescription,
          title: `${selectedResume?.title || t('resume')} - ${targetCompany || jobTitle || selectedTemplate?.title || 'JD'}`,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const resume = await res.json();
      toast.success(t('deriveDone'));
      await load();
      await onResumeChanged?.();
      router.push(`/editor/${resume.id}`);
    } catch (error) {
      console.error(error);
      toast.error(t('deriveFailed'));
    } finally {
      setBusy(null);
    }
  };

  const applySuggestion = async (suggestion: ApplicableSuggestion, index: number) => {
    if (!selectedResumeId) return;
    setBusy(`apply-${index}`);
    try {
      const res = await fetch('/api/career/apply-suggestion', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ resumeId: selectedResumeId, suggestion }),
      });
      if (!res.ok) {
        const data = await res.json().catch(async () => ({ error: await res.text().catch(() => '') }));
        throw new Error(data.error || t('applyFailed'));
      }
      const data = await res.json();
      setAppliedSuggestions((current) => ({
        ...current,
        [index]: {
          sectionId: data.sectionId,
          previousContent: data.previousContent,
        },
      }));
      void onResumeChanged?.();
      toast.success(t('applyDone'));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t('applyFailed'));
    } finally {
      setBusy(null);
    }
  };

  const undoSuggestion = async (suggestion: ApplicableSuggestion, index: number) => {
    const applied = appliedSuggestions[index];
    if (!selectedResumeId || !applied) return;
    setBusy(`undo-${index}`);
    try {
      const res = await fetch('/api/career/restore-section', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
          resumeId: selectedResumeId,
          sectionId: applied.sectionId,
          content: applied.previousContent,
          reason: suggestion.reason,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(async () => ({ error: await res.text().catch(() => '') }));
        throw new Error(data.error || t('undoFailed'));
      }
      setAppliedSuggestions((current) => {
        const next = { ...current };
        delete next[index];
        return next;
      });
      void onResumeChanged?.();
      toast.success(t('undoDone'));
    } catch (error) {
      console.error(error);
      toast.error(error instanceof Error ? error.message : t('undoFailed'));
    } finally {
      setBusy(null);
    }
  };

  const createInterview = async (jdOverride?: string) => {
    const targetJobDescription = jdOverride ?? jobDescription;
    if (!selectedResumeId || !targetJobDescription.trim()) {
      toast.error(t('missingResumeOrJd'));
      return;
    }
    const isGameRole = `${jobTitle} ${selectedTemplate?.industry || ''} ${selectedTemplateKey}`.toLowerCase().includes('game')
      || `${jobTitle} ${selectedTemplate?.industry || ''}`.includes('游戏');
    const interviewers = isGameRole
      ? [
        {
          type: 'scenario',
          name: '王强',
          title: '游戏项目主面',
          avatar: 'scenario',
          bio: '长期负责游戏项目技术和策划联合面试，关注候选人是否真正理解玩法、工程实现、上线约束和玩家体验。',
          style: '围绕目标 JD 和候选人项目进行场景追问，要求说明设计/实现取舍、风险和验证方式。',
          focusAreas: ['岗位理解', '项目真实性', '玩法或技术落地', '版本协作', '复盘能力'],
          personality: '务实直接，重点看可落地经验和真实参与度。',
          systemPrompt: '',
        },
        {
          type: 'project_deep_dive',
          name: '陈刚',
          title: '项目深挖面试官',
          avatar: 'project_deep_dive',
          bio: '从项目细节判断候选人的真实贡献，关注方案、协作、数据和结果。',
          style: '沿着简历项目逐层追问具体角色、关键决策、难点、结果和复盘。',
          focusAreas: ['项目贡献度', '关键难点', '协作推进', '结果度量', '复盘迭代'],
          personality: '追问细节，不接受泛泛而谈。',
          systemPrompt: '',
        },
        {
          type: 'behavioral',
          name: '刘芳',
          title: 'HRBP',
          avatar: 'behavioral',
          bio: '关注动机、协作、抗压和长期成长。',
          style: '用 STAR 方法追问真实经历。',
          focusAreas: ['求职动机', '团队协作', '抗压能力', '沟通表达', '成长意愿'],
          personality: '专业干练，有引导性。',
          systemPrompt: '',
        },
      ]
      : [
        {
          type: 'technical',
          name: '张明',
          title: '技术专家',
          avatar: 'technical',
          bio: '关注基础、系统设计、工程落地和问题定位。',
          style: '由浅入深追问实现细节和边界情况。',
          focusAreas: ['岗位基础', '系统设计', '项目细节', '问题定位', '学习能力'],
          personality: '严谨直接，逻辑驱动。',
          systemPrompt: '',
        },
        {
          type: 'project_deep_dive',
          name: '陈刚',
          title: '项目深挖面试官',
          avatar: 'project_deep_dive',
          bio: '从项目细节判断候选人的真实贡献。',
          style: '沿着简历项目逐层追问角色、决策、难点和结果。',
          focusAreas: ['项目贡献度', '技术决策', '问题解决', '结果导向', '复盘能力'],
          personality: '务实老练，追问细节。',
          systemPrompt: '',
        },
        {
          type: 'behavioral',
          name: '刘芳',
          title: 'HRBP',
          avatar: 'behavioral',
          bio: '关注动机、协作、抗压和长期成长。',
          style: '用 STAR 方法追问真实经历。',
          focusAreas: ['求职动机', '团队协作', '抗压能力', '沟通表达', '成长意愿'],
          personality: '专业干练，有引导性。',
          systemPrompt: '',
        },
      ];

    setBusy('interview');
    try {
      const res = await fetch('/api/interview', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
          resumeId: selectedResumeId,
          jobTitle: jobTitle || selectedTemplate?.title || t('jobTitle'),
          jobDescription: targetJobDescription,
          interviewers,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      toast.success(t('interviewCreated'));
      router.push(`/interview/${data.session.id}`);
    } catch (error) {
      console.error(error);
      toast.error(t('interviewFailed'));
    } finally {
      setBusy(null);
    }
  };

  const createKnowledge = async (jdOverride?: string) => {
    const targetJobDescription = jdOverride ?? jobDescription;
    if (!selectedResumeId || !targetJobDescription.trim()) {
      toast.error(t('missingResumeOrJd'));
      return;
    }
    setBusy('knowledge');
    try {
      const res = await fetch('/api/career/knowledge-from-jd', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
          resumeId: selectedResumeId,
          jobTitle: jobTitle || selectedTemplate?.title || '',
          jobDescription: targetJobDescription,
          missingKeywords: analysis?.missingKeywords || selectedTemplate?.keywords || [],
          keywordMatches: analysis?.keywordMatches || [],
          interviewQuestions: selectedTemplate?.interviewQuestions || [],
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
      toast.success(t('knowledgeDone'));
    } catch (error) {
      console.error(error);
      toast.error(t('knowledgeFailed'));
    } finally {
      setBusy(null);
    }
  };

  const runHistoryAction = async (item: JdHistoryItem, action: JdHistoryAction) => {
    if (item.status === 'pending' || item.status === 'running') return;
    const detail = item.status === 'failed' ? null : await loadHistoryDetail(item);
    if (detail) {
      applyHistoryDetail(detail);
    } else {
      setJobDescription(item.jobDescription || '');
      setAnalysis(null);
      setAppliedSuggestions({});
      setCurrentTab('match');
    }
    const targetJobDescription = detail?.jobDescription || item.jobDescription || '';
    if (action === 'match-analysis') void runAnalysis('current', targetJobDescription);
    if (action === 'cloud-analysis') void runAnalysis('cloud', targetJobDescription);
    if (action === 'derive-resume') void deriveResume(targetJobDescription);
    if (action === 'build-knowledge') void createKnowledge(targetJobDescription);
    if (action === 'create-interview') void createInterview(targetJobDescription);
  };

  const saveMemory = async () => {
    if (!memoryForm.title.trim()) {
      toast.error(t('memoryTitleRequired'));
      return;
    }
    setBusy('memory');
    try {
      const res = await fetch(editingMemoryId ? `/api/career/memories/${editingMemoryId}` : '/api/career/memories', {
        method: editingMemoryId ? 'PATCH' : 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(memoryForm),
      });
      if (!res.ok) throw new Error(await res.text());
      setMemoryForm({ type: 'profile', title: '', content: '' });
      setEditingMemoryId(null);
      await load();
      toast.success(t('memorySaved'));
    } catch (error) {
      console.error(error);
      toast.error(t('memoryFailed'));
    } finally {
      setBusy(null);
    }
  };

  const editMemory = (memory: MemoryItem) => {
    setEditingMemoryId(memory.id);
    setMemoryForm({ type: memory.type, title: memory.title, content: memory.content || '' });
  };

  const cancelMemoryEdit = () => {
    setEditingMemoryId(null);
    setMemoryForm({ type: 'profile', title: '', content: '' });
  };

  const deleteMemory = async (memoryId: string) => {
    setBusy(`memory-delete-${memoryId}`);
    try {
      const res = await fetch(`/api/career/memories/${memoryId}`, {
        method: 'DELETE',
        headers: getRequestHeaders(),
      });
      if (!res.ok) throw new Error(await res.text());
      if (editingMemoryId === memoryId) cancelMemoryEdit();
      await load();
      toast.success(t('memoryDeleted'));
    } catch (error) {
      console.error(error);
      toast.error(t('memoryDeleteFailed'));
    } finally {
      setBusy(null);
    }
  };

  const startNewAnalysis = () => {
    const targetJobDescription = jobDescription;
    if (!selectedResumeId || !targetJobDescription.trim()) {
      void runAnalysis('cloud', targetJobDescription);
      return;
    }
    setJdDialogOpen(false);
    void runAnalysis('cloud', targetJobDescription);
  };

  const saveJdTemplate = async () => {
    if (!jobDescription.trim()) {
      setJdDialogOpen(false);
      return;
    }
    const title = (jobTitle || selectedTemplate?.title || t('jobTitle')).trim();
    try {
      const res = await fetch('/api/career/job-templates/personal', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
          title,
          industry: targetCompany || t('personalTemplate'),
          jd: jobDescription,
          keywords: selectedTemplate?.keywords || [],
          interviewQuestions: selectedTemplate?.interviewQuestions || [],
          recommendedSections: selectedTemplate?.recommendedSections || ['个人简介', '工作经历', '项目经历', '技能特长'],
          enabled: true,
        }),
      });
      if (res.ok) {
        const template = await res.json();
        await load();
        if (template?.roleKey) setSelectedTemplateKey(template.roleKey);
        toast.success(t('jdTemplateSaved'));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setJdDialogOpen(false);
    }
  };

  const renderHistoryResumeMeta = (item: JdHistoryItem) => {
    if (!item.resumeId && !item.resumeTitle) return null;
    const roleLabel = item.targetCompany || item.targetJobTitle
      ? [item.targetCompany, item.targetJobTitle].filter(Boolean).join(' · ')
      : item.resumeVersionLabel || item.resumeTitle;
    return (
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        {item.isCurrentResume && (
          <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {t('currentVersion')}
          </Badge>
        )}
        {!item.isCurrentResume && item.isBaseResume && (
          <Badge variant="outline" className="text-zinc-500">
            {t('baseVersion')}
          </Badge>
        )}
        {!item.isCurrentResume && !item.isBaseResume && (
          <Badge variant="outline" className="text-violet-600 dark:text-violet-300">
            {t('roleVersion')}
          </Badge>
        )}
        {roleLabel && (
          <span title={item.resumeTitle} className="min-w-0 max-w-[18rem] truncate text-zinc-400">
            {roleLabel}
          </span>
        )}
      </div>
    );
  };

  const renderSuggestionDiff = (suggestion: ApplicableSuggestion, side: 'old' | 'new') => {
    const current = suggestion.current || '';
    const suggested = suggestion.suggested || '';
    if (!current && side === 'old') return t('empty');
    const diff = buildCharDiff(current, suggested);
    return renderDiffParts(side === 'old' ? diff.oldParts : diff.newParts, side);
  };

  const renderHistoryStatus = (item: JdHistoryItem) => {
    if (item.status === 'pending' || item.status === 'running') return <Badge variant="secondary" className="bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">{t('analysisPending')}</Badge>;
    if (item.status === 'failed') return <Badge variant="destructive">{t('analysisFailedStatus')}</Badge>;
    return <Badge variant="secondary">{item.overallScore}</Badge>;
  };

  const renderHistoryActions = (item: JdHistoryItem) => (
    <div className="mt-3 flex flex-wrap gap-1.5 border-t pt-2 dark:border-zinc-800">
      <Button type="button" size="xs" variant="ghost" onClick={() => runHistoryAction(item, 'match-analysis')} disabled={!!busy || item.status === 'pending' || item.status === 'running'} className="h-7 cursor-pointer gap-1 px-2 text-xs">
        <Target className="h-3.5 w-3.5" />
        {t('analyze')}
      </Button>
      <Button type="button" size="xs" variant="ghost" onClick={() => runHistoryAction(item, 'cloud-analysis')} disabled={!!busy || item.status === 'pending' || item.status === 'running'} className="h-7 cursor-pointer gap-1 px-2 text-xs">
        <Sparkles className="h-3.5 w-3.5" />
        {t('cloudAnalyze')}
      </Button>
      <Button type="button" size="xs" variant="ghost" onClick={() => runHistoryAction(item, 'derive-resume')} disabled={!!busy || item.status === 'pending' || item.status === 'running'} className="h-7 cursor-pointer gap-1 px-2 text-xs">
        <GitBranch className="h-3.5 w-3.5" />
        {t('derive')}
      </Button>
      <Button type="button" size="xs" variant="ghost" onClick={() => runHistoryAction(item, 'build-knowledge')} disabled={!!busy || item.status === 'pending' || item.status === 'running'} className="h-7 cursor-pointer gap-1 px-2 text-xs">
        <Brain className="h-3.5 w-3.5" />
        {t('buildKnowledge')}
      </Button>
      <Button type="button" size="xs" variant="ghost" onClick={() => runHistoryAction(item, 'create-interview')} disabled={!!busy || item.status === 'pending' || item.status === 'running'} className="h-7 cursor-pointer gap-1 px-2 text-xs">
        <MessageSquareText className="h-3.5 w-3.5" />
        {t('createInterview')}
      </Button>
    </div>
  );

  return (
    <div className={embedded ? 'h-full overflow-auto bg-zinc-50 p-4 dark:bg-zinc-950' : 'space-y-6'}>
      <div className={embedded ? 'mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between' : 'flex flex-col gap-4 md:flex-row md:items-end md:justify-between'}>
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-brand">
            <Sparkles className="h-4 w-4" />
            {t('eyebrow')}
          </div>
          <h1 className="text-2xl font-bold text-zinc-950 dark:text-zinc-50">{t('title')}</h1>
        </div>

      </div>

      <div className="space-y-4">
        {!embedded && (
          <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand" />
              <h2 className="text-sm font-semibold">{t('resumeContext')}</h2>
            </div>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>{t('baseResume')}</Label>
                <Select value={selectedResumeId} onValueChange={setSelectedResumeId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('selectResume')} />
                  </SelectTrigger>
                  <SelectContent>
                    {resumes.map((resume) => (
                      <SelectItem key={resume.id} value={resume.id}>
                        {resume.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="space-y-2">
                  <Label>{t('jobTitle')}</Label>
                  <Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder={t('jobTitlePlaceholder')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('targetCompany')}</Label>
                  <Input value={targetCompany} onChange={(event) => setTargetCompany(event.target.value)} placeholder={t('targetCompanyPlaceholder')} />
                </div>
              </div>
            </div>
          </section>
        )}

        <Dialog open={jdDialogOpen} onOpenChange={setJdDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>{t('jdDialogTitle')}</DialogTitle>
              <DialogDescription>{t('jdDialogDescription')}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="space-y-2">
                <Label>{t('templateLibrary')}</Label>
                <Select value={selectedTemplateKey} onValueChange={applyTemplate}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={t('selectTemplate')} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((template) => (
                      <SelectItem key={template.roleKey} value={template.roleKey}>
                        {template.title} · {template.industry} · {template.scope === 'personal' ? t('personalTemplate') : t('publicTemplate')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t('jobTitle')}</Label>
                  <Input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder={t('jobTitlePlaceholder')} />
                </div>
                <div className="space-y-2">
                  <Label>{t('targetCompany')}</Label>
                  <Input value={targetCompany} onChange={(event) => setTargetCompany(event.target.value)} placeholder={t('targetCompanyPlaceholder')} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t('jobDescription')}</Label>
                <Textarea
                  value={jobDescription}
                  onChange={(event) => setJobDescription(event.target.value)}
                  placeholder={t('jobDescriptionPlaceholder')}
                  className="min-h-72"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setJdDialogOpen(false)}>{t('cancel')}</Button>
              <Button type="button" variant="outline" onClick={saveJdTemplate}>{t('saveJd')}</Button>
              <Button type="button" onClick={startNewAnalysis} disabled={busy === 'cloud-analysis'} className="bg-brand hover:bg-brand-hover">
                {busy === 'cloud-analysis' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('cloudAnalyze')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <main className="space-y-4">
          {!embedded && (
            <div className="flex flex-wrap gap-2 rounded-lg border bg-white p-2 dark:bg-zinc-900">
              {CAREER_WORKBENCH_TABS.map((item) => {
                const Icon = item.icon;
                const active = currentTab === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setCurrentTab(item.value)}
                    className={`inline-flex cursor-pointer items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                      active
                        ? 'bg-brand-muted text-brand'
                        : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t(item.labelKey)}
                  </button>
                );
              })}
            </div>
          )}

          {!embedded && <Link href={selectedResumeId ? `/editor/${selectedResumeId}` : '/dashboard'} className="flex items-center justify-between rounded-lg border bg-white p-4 text-left transition hover:border-brand dark:bg-zinc-900">
            <div>
              <p className="text-sm font-semibold">{t('openEditor')}</p>
              <p className="mt-1 text-xs text-zinc-500">{t('openEditorHint')}</p>
            </div>
            <ExternalLink className="h-5 w-5 text-brand" />
          </Link>}

          {currentTab === 'knowledge' ? (
            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <KnowledgePage embedded />
            </div>
          ) : currentTab === 'interview' ? (
            <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <InterviewLobby embedded />
            </div>
          ) : currentTab === 'history' ? (
            <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-sm font-semibold">{t('historyTab')}</h2>
                  <p className="mt-1 text-xs text-zinc-500">{t('historyHint')}</p>
                </div>
                <Button variant="outline" onClick={() => loadJdHistory()} className="gap-2">
                  <RotateCcw className="h-4 w-4" />
                  {t('refreshHistory')}
                </Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {jdHistory.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-sm text-zinc-400 md:col-span-2">{t('noMatchHistory')}</div>
                ) : jdHistory.map((item) => (
                  <div key={item.id} className="rounded-md border bg-white p-3 transition hover:border-brand dark:bg-zinc-900">
                    <button type="button" onClick={() => openHistoryItem(item)} className="w-full text-left">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-medium">{item.jobDescription}</span>
                        {renderHistoryStatus(item)}
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-xs text-zinc-500">
                        <span>ATS {item.atsScore}</span>
                        <span>{new Date(item.createdAt).toLocaleString()}</span>
                      </div>
                      {renderHistoryResumeMeta(item)}
                      {item.status === 'failed' && item.error && (
                        <p className="mt-2 line-clamp-2 text-xs text-red-500">{item.error}</p>
                      )}
                    </button>
                    {renderHistoryActions(item)}
                  </div>
                ))}
              </div>
            </section>
          ) : currentTab === 'memory' ? (
            <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
              <div className="mb-4 flex items-center gap-2">
                <Brain className="h-4 w-4 text-brand" />
                <h2 className="text-sm font-semibold">{t('careerMemory')}</h2>
              </div>
              <div className="grid gap-3 md:grid-cols-[160px_1fr]">
                <Select value={memoryForm.type} onValueChange={(type) => setMemoryForm((current) => ({ ...current, type }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="profile">{t('memoryTypes.profile')}</SelectItem>
                    <SelectItem value="preference">{t('memoryTypes.preference')}</SelectItem>
                    <SelectItem value="project_fact">{t('memoryTypes.project_fact')}</SelectItem>
                    <SelectItem value="skill_evidence">{t('memoryTypes.skill_evidence')}</SelectItem>
                    <SelectItem value="interview_gap">{t('memoryTypes.interview_gap')}</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={memoryForm.title} onChange={(event) => setMemoryForm((current) => ({ ...current, title: event.target.value }))} placeholder={t('memoryTitle')} />
                <Textarea value={memoryForm.content} onChange={(event) => setMemoryForm((current) => ({ ...current, content: event.target.value }))} placeholder={t('memoryContent')} className="md:col-span-2" />
                <div className="md:col-span-2">
                  <Button onClick={saveMemory} disabled={busy === 'memory'} className="gap-2 bg-brand hover:bg-brand-hover">
                    {busy === 'memory' ? <Loader2 className="h-4 w-4 animate-spin" /> : editingMemoryId ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingMemoryId ? t('updateMemory') : t('saveMemory')}
                  </Button>
                  {editingMemoryId && (
                    <Button variant="outline" onClick={cancelMemoryEdit} className="ml-2 gap-2">
                      <X className="h-4 w-4" />
                      {t('cancel')}
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {memories.length === 0 ? (
                  <div className="rounded-md border border-dashed p-6 text-sm text-zinc-400 md:col-span-2">{t('noMemories')}</div>
                ) : memories.map((memory) => (
                  <div key={memory.id} className="rounded-md border p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="truncate text-sm font-semibold">{memory.title}</h3>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary">{t(`memoryTypes.${memory.type}`)}</Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => editMemory(memory)} title={t('editMemory')}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-600" onClick={() => deleteMemory(memory.id)} disabled={busy === `memory-delete-${memory.id}`} title={t('deleteMemory')}>
                          {busy === `memory-delete-${memory.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-600 dark:text-zinc-300">{memory.content || t('emptyMemory')}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <div className="space-y-4">
              <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <h2 className="text-sm font-semibold">{t('matchHistory')}</h2>
                  <Button onClick={() => setJdDialogOpen(true)} className="gap-2 bg-brand hover:bg-brand-hover">
                    <Plus className="h-4 w-4" />
                    {t('newAnalysis')}
                  </Button>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {jdHistory.length === 0 ? (
                    <div className="rounded-md border border-dashed p-4 text-sm text-zinc-400 md:col-span-2">{t('noMatchHistory')}</div>
                  ) : jdHistory.map((item) => (
                    <div key={item.id} className="rounded-md border p-3 transition hover:border-brand">
                      <button type="button" onClick={() => openHistoryItem(item)} className="w-full text-left">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">{item.jobDescription}</span>
                          {renderHistoryStatus(item)}
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">ATS {item.atsScore}</p>
                        {renderHistoryResumeMeta(item)}
                        {item.status === 'failed' && item.error && (
                          <p className="mt-2 line-clamp-2 text-xs text-red-500">{item.error}</p>
                        )}
                      </button>
                      {renderHistoryActions(item)}
                    </div>
                  ))}
                </div>
              </section>

              {analysis && <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                <div>
                  <h2 className="text-sm font-semibold">{t('matchResult')}</h2>
                  <p className="mt-1 text-xs text-zinc-500">{t('matchResultHint')}</p>
                </div>

                <div className="mt-5 space-y-5">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-md bg-zinc-50 p-4 dark:bg-zinc-800">
                        <p className="text-xs text-zinc-500">{t('overallScore')}</p>
                        <p className={`mt-1 text-3xl font-bold ${scoreTone(analysis.overallScore)}`}>{analysis.overallScore}</p>
                      </div>
                      <div className="rounded-md bg-zinc-50 p-4 dark:bg-zinc-800">
                        <p className="text-xs text-zinc-500">{t('atsScore')}</p>
                        <p className={`mt-1 text-3xl font-bold ${scoreTone(analysis.atsScore)}`}>{analysis.atsScore}</p>
                      </div>
                      <div className="rounded-md bg-zinc-50 p-4 dark:bg-zinc-800">
                        <p className="text-xs text-zinc-500">{t('keywordGap')}</p>
                        <p className="mt-1 text-3xl font-bold text-zinc-900 dark:text-zinc-50">{analysis.missingKeywords.length}</p>
                      </div>
                    </div>
                    <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">{analysis.summary}</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="mb-2 text-xs font-semibold text-zinc-500">{t('matchedKeywords')}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.keywordMatches.length ? analysis.keywordMatches.map((keyword) => <Badge key={keyword} variant="secondary">{keyword}</Badge>) : <span className="text-sm text-zinc-400">{t('empty')}</span>}
                        </div>
                      </div>
                      <div>
                        <p className="mb-2 text-xs font-semibold text-zinc-500">{t('missingKeywords')}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {analysis.missingKeywords.length ? analysis.missingKeywords.map((keyword) => <Badge key={keyword} variant="outline">{keyword}</Badge>) : <span className="text-sm text-zinc-400">{t('empty')}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
              </section>}

              {analysis && <section className="rounded-lg border bg-white p-4 dark:bg-zinc-900">
                <h2 className="text-sm font-semibold">{t('applicableSuggestions')}</h2>
                <p className="mt-1 text-xs text-zinc-500">{t('applicableSuggestionsHint')}</p>
                <div className="mt-4 space-y-3">
                  {suggestions.length === 0 ? (
                    <div className="rounded-md border border-dashed p-6 text-center text-sm text-zinc-400">{t('noSuggestions')}</div>
                  ) : suggestions.map((suggestion, index) => (
                    <div
                      key={`${suggestion.sectionType}-${index}`}
                      className="rounded-md border p-3 transition hover:border-brand hover:bg-brand-muted/30"
                      onMouseEnter={() => setHighlightedSectionType(suggestion.sectionType)}
                      onMouseLeave={() => setHighlightedSectionType(null)}
                      onFocus={() => setHighlightedSectionType(suggestion.sectionType)}
                      onBlur={() => setHighlightedSectionType(null)}
                    >
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{suggestion.sectionType}</Badge>
                        <Badge variant="secondary">{suggestion.targetField}</Badge>
                        {suggestion.evidenceRequired && <Badge variant="outline">{t('needsEvidence')}</Badge>}
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-md border border-red-200 bg-red-50/60 p-3 dark:border-red-900/70 dark:bg-red-950/20">
                          <p className="mb-2 text-xs font-semibold text-red-700 dark:text-red-300">{t('currentContent')}</p>
                          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-200">{renderSuggestionDiff(suggestion, 'old')}</p>
                        </div>
                        <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-900/70 dark:bg-emerald-950/20">
                          <p className="mb-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{t('suggestedContent')}</p>
                          <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-700 dark:text-zinc-200">{renderSuggestionDiff(suggestion, 'new')}</p>
                        </div>
                      </div>
                      <p className="mt-2 text-xs text-zinc-500">{suggestion.reason}</p>
                      <div className="mt-3 flex justify-end gap-2">
                        {appliedSuggestions[index] && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => undoSuggestion(suggestion, index)}
                            disabled={busy === `undo-${index}`}
                            className="gap-2"
                          >
                            {busy === `undo-${index}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                            {t('undo')}
                          </Button>
                        )}
                        <Button
                          type="button"
                          size="sm"
                          variant={appliedSuggestions[index] ? 'outline' : 'default'}
                          onClick={() => applySuggestion(suggestion, index)}
                          disabled={!!appliedSuggestions[index] || busy === `apply-${index}`}
                          className={appliedSuggestions[index] ? 'gap-2' : 'gap-2 bg-brand hover:bg-brand-hover'}
                        >
                          {busy === `apply-${index}` ? <Loader2 className="h-4 w-4 animate-spin" /> : appliedSuggestions[index] ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          {appliedSuggestions[index] ? t('applied') : t('apply')}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

export default CareerWorkbench;
