'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Eye, Loader2, Store, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RECOMMENDED_TEMPLATES, TEMPLATES } from '@/lib/constants';
import { useResume } from '@/hooks/use-resume';
import { Link, useRouter } from '@/i18n/routing';
import { useFingerprint } from '@/hooks/use-fingerprint';
import { ResumePreview } from '@/components/preview/resume-preview';
import { TourOverlay, type TourStepConfig } from '@/components/tour/tour-overlay';
import { useTourStore, hasCompletedTour } from '@/stores/tour-store';
import { getTemplateLabel } from '@/lib/template-labels';
import { purchaseProductWithMockPayment } from '@/lib/commercial/client-payments';
import type { Resume } from '@/types/resume';

interface MarketTemplate {
  id: string;
  name: string;
  description: string;
  baseTemplate: string;
  themeConfig: Record<string, unknown>;
  customCss: string;
  isPublic: boolean;
  installCount: number;
  purchased?: boolean;
  locked?: boolean;
  canUseMonthlyFreeDownload?: boolean;
  freeDownloads?: {
    limit: number;
    used: number;
    remaining: number;
  } | null;
  product?: {
    id: string;
    priceCents: number;
    currency: string;
  } | null;
}

const TEMPLATES_TOUR_STEPS: TourStepConfig[] = [
  { target: 'tpl-preview', placement: 'bottom', i18nKey: 'tplPreview' },
  { target: 'tpl-use', placement: 'bottom', i18nKey: 'tplUse' },
];

// Stable date to avoid SSR/client hydration mismatch
const MOCK_DATE = new Date('2025-01-01T00:00:00Z');

function money(cents: number, currency = 'CNY') {
  const amount = Number(cents || 0) / 100;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(amount);
}

function buildMockResume(template: string): Resume {
  return ({
    id: 'mock',
    userId: 'mock',
    title: 'Sample Resume',
    template,
    themeConfig: {
      primaryColor: '#1a1a1a',
      accentColor: '#3b82f6',
      fontFamily: 'Inter',
      fontSize: 'medium',
      lineSpacing: 1.5,
      margin: { top: 20, right: 20, bottom: 20, left: 20 },
      sectionSpacing: 16,
    },
    isDefault: false,
    language: 'en',
    sections: [
      {
        id: 's1',
        resumeId: 'mock',
        type: 'personal_info',
        title: 'Personal Info',
        sortOrder: 0,
        visible: true,
        content: {
          fullName: 'Alex Chen',
          jobTitle: 'Senior Software Engineer',
          email: 'alex@example.com',
          phone: '+1 (555) 123-4567',
          location: 'San Francisco, CA',
          website: 'https://alexchen.dev',
          linkedin: 'linkedin.com/in/alexchen',
          github: 'github.com/alexchen',
        },
        createdAt: MOCK_DATE,
        updatedAt: MOCK_DATE,
      },
      {
        id: 's2',
        resumeId: 'mock',
        type: 'summary',
        title: 'Summary',
        sortOrder: 1,
        visible: true,
        content: {
          text: 'Full-stack engineer with 8+ years of experience building scalable web applications. Passionate about clean architecture, developer experience, and mentoring teams.',
        },
        createdAt: MOCK_DATE,
        updatedAt: MOCK_DATE,
      },
      {
        id: 's3',
        resumeId: 'mock',
        type: 'work_experience',
        title: 'Work Experience',
        sortOrder: 2,
        visible: true,
        content: {
          items: [
            {
              id: 'w1',
              company: 'TechCorp Inc.',
              position: 'Senior Software Engineer',
              location: 'San Francisco, CA',
              startDate: '2021-03',
              endDate: null,
              current: true,
              description: 'Led a team of 6 engineers building the next-gen analytics platform.',
              highlights: [
                'Reduced page load time by 40% through code splitting and lazy loading',
                'Designed microservices architecture serving 2M+ daily active users',
              ],
            },
            {
              id: 'w2',
              company: 'StartupXYZ',
              position: 'Software Engineer',
              location: 'Remote',
              startDate: '2018-06',
              endDate: '2021-02',
              current: false,
              description: 'Built core product features from 0 to 1.',
              highlights: [
                'Implemented real-time collaboration features using WebSockets',
                'Improved CI/CD pipeline reducing deployment time by 60%',
              ],
            },
          ],
        },
        createdAt: MOCK_DATE,
        updatedAt: MOCK_DATE,
      },
      {
        id: 's4',
        resumeId: 'mock',
        type: 'education',
        title: 'Education',
        sortOrder: 3,
        visible: true,
        content: {
          items: [
            {
              id: 'e1',
              institution: 'University of California, Berkeley',
              degree: 'Bachelor of Science',
              field: 'Computer Science',
              location: 'Berkeley, CA',
              startDate: '2014-09',
              endDate: '2018-05',
              gpa: '3.8',
              highlights: ['Dean\'s List', 'ACM Programming Contest Finalist'],
            },
          ],
        },
        createdAt: MOCK_DATE,
        updatedAt: MOCK_DATE,
      },
      {
        id: 's5',
        resumeId: 'mock',
        type: 'skills',
        title: 'Skills',
        sortOrder: 4,
        visible: true,
        content: {
          categories: [
            { id: 'sk1', name: 'Frontend', skills: ['React', 'TypeScript', 'Next.js', 'Tailwind CSS'] },
            { id: 'sk2', name: 'Backend', skills: ['Node.js', 'Python', 'PostgreSQL', 'Redis'] },
            { id: 'sk3', name: 'DevOps', skills: ['Docker', 'AWS', 'CI/CD', 'Kubernetes'] },
          ],
        },
        createdAt: MOCK_DATE,
        updatedAt: MOCK_DATE,
      },
      {
        id: 's6',
        resumeId: 'mock',
        type: 'projects',
        title: 'Projects',
        sortOrder: 5,
        visible: true,
        content: {
          items: [
            {
              id: 'p1',
              name: 'OpenSource CMS',
              url: 'https://github.com/alexchen/cms',
              description: 'A headless CMS built with Next.js and GraphQL.',
              technologies: ['Next.js', 'GraphQL', 'PostgreSQL'],
              highlights: ['1.2k+ GitHub stars', 'Used by 50+ companies'],
            },
          ],
        },
        createdAt: MOCK_DATE,
        updatedAt: MOCK_DATE,
      },
      {
        id: 's7',
        resumeId: 'mock',
        type: 'certifications',
        title: 'Certifications',
        sortOrder: 6,
        visible: true,
        content: {
          items: [
            { id: 'c1', name: 'AWS Solutions Architect', issuer: 'Amazon Web Services', date: '2023-05' },
          ],
        },
        createdAt: MOCK_DATE,
        updatedAt: MOCK_DATE,
      },
      {
        id: 's8',
        resumeId: 'mock',
        type: 'languages',
        title: 'Languages',
        sortOrder: 7,
        visible: true,
        content: {
          items: [
            { id: 'l1', language: 'English', proficiency: 'Native' },
            { id: 'l2', language: 'Mandarin', proficiency: 'Native' },
          ],
        },
        createdAt: MOCK_DATE,
        updatedAt: MOCK_DATE,
      },
    ],
    createdAt: MOCK_DATE,
    updatedAt: MOCK_DATE,
  }) as Resume;
}

export default function TemplatesPage() {
  const t = useTranslations();
  const router = useRouter();
  const { createResume } = useResume();
  const { fingerprint } = useFingerprint();
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);
  const [creatingTemplate, setCreatingTemplate] = useState<string | null>(null);
  const [marketTemplates, setMarketTemplates] = useState<MarketTemplate[]>([]);
  const [publishForm, setPublishForm] = useState({
    name: '',
    description: '',
    baseTemplate: 'touch-pure',
    customCss: '',
    isPublic: true,
  });
  const startTour = useTourStore((s) => s.startTour);

  useEffect(() => {
    if (hasCompletedTour('templates')) return;
    if (window.innerWidth < 768) return;
    const timer = setTimeout(() => startTour('templates', TEMPLATES_TOUR_STEPS.length), 800);
    return () => clearTimeout(timer);
  }, [startTour]);

  useEffect(() => {
    const headers: Record<string, string> = {};
    if (fingerprint) headers['x-fingerprint'] = fingerprint;
    fetch('/api/templates', { headers })
      .then((res) => res.ok ? res.json() : [])
      .then(setMarketTemplates)
      .catch(() => setMarketTemplates([]));
  }, [fingerprint]);

  const handleUseTemplate = async (template: string) => {
    setCreatingTemplate(template);
    try {
      const resume = await createResume({ template });
      if (resume) {
        router.push(`/editor/${resume.id}`);
      }
    } finally {
      setCreatingTemplate(null);
    }
  };

  const handleUseMarketTemplate = async (item: MarketTemplate) => {
    setCreatingTemplate(item.id);
    try {
      const headers: Record<string, string> = {};
      if (fingerprint) headers['x-fingerprint'] = fingerprint;
      const installRes = await fetch(`/api/templates/${item.id}/install`, {
        method: 'POST',
        headers,
      });
      if (installRes.status === 402) {
        const payload = await installRes.json().catch(() => ({}));
        const product = payload.product || item.product;
        if (!product?.id) throw new Error('模板需要先解锁');
        await purchaseProductWithMockPayment({
          productId: product.id,
          headers,
          clientContext: { source: 'resume_template', templateId: item.id },
        });
        const retry = await fetch(`/api/templates/${item.id}/install`, {
          method: 'POST',
          headers,
        });
        if (!retry.ok) throw new Error('模板授权确认失败');
      } else if (!installRes.ok) {
        throw new Error('模板安装失败');
      }

      const resume = await createResume({
        title: item.name,
        template: item.baseTemplate,
        themeConfig: {
          ...item.themeConfig,
          advanced: {
            ...((item.themeConfig?.advanced as Record<string, unknown> | undefined) || {}),
            customCss: item.customCss,
          },
        },
      });
      if (resume) {
        setMarketTemplates((prev) => prev.map((template) => (
          template.id === item.id
            ? {
                ...template,
                purchased: true,
                locked: false,
                installCount: Number(template.installCount || 0) + 1,
              }
            : template
        )));
        router.push(`/editor/${resume.id}`);
      }
    } finally {
      setCreatingTemplate(null);
    }
  };

  const handlePublishTemplate = async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (fingerprint) headers['x-fingerprint'] = fingerprint;
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...publishForm,
        themeConfig: {},
      }),
    });
    if (res.ok) {
      const item = await res.json();
      setMarketTemplates((prev) => [item, ...prev]);
      setPublishForm({ ...publishForm, name: '', description: '', customCss: '' });
    }
  };

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/dashboard"
          className="mb-4 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Link>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-foreground">
          {t('templates.title')}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {t('templates.subtitle')}
        </p>
      </div>

      <section className="mb-8 space-y-4">
        <div className="flex items-center gap-2">
          <Store className="h-5 w-5 text-brand" />
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t('templates.market')}</h2>
        </div>
        <div className="grid gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 md:grid-cols-[1fr_1fr_1fr_auto]">
          <Input
            value={publishForm.name}
            onChange={(e) => setPublishForm({ ...publishForm, name: e.target.value })}
            placeholder={t('templates.marketName')}
          />
          <Input
            value={publishForm.baseTemplate}
            onChange={(e) => setPublishForm({ ...publishForm, baseTemplate: e.target.value })}
            placeholder={t('templates.marketBase')}
          />
          <Textarea
            value={publishForm.customCss}
            onChange={(e) => setPublishForm({ ...publishForm, customCss: e.target.value })}
            placeholder={t('templates.marketCss')}
            className="min-h-10 md:col-span-1"
          />
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-zinc-500">
              <Switch
                checked={publishForm.isPublic}
                onCheckedChange={(checked) => setPublishForm({ ...publishForm, isPublic: checked })}
              />
              {t('templates.public')}
            </label>
            <Button
              onClick={handlePublishTemplate}
              disabled={!publishForm.name.trim()}
              className="cursor-pointer gap-2 bg-brand hover:bg-brand-hover"
            >
              <UploadCloud className="h-4 w-4" />
              {t('templates.publish')}
            </Button>
          </div>
          <Input
            value={publishForm.description}
            onChange={(e) => setPublishForm({ ...publishForm, description: e.target.value })}
            placeholder={t('templates.marketDescription')}
            className="md:col-span-4"
          />
        </div>
        {marketTemplates.length > 0 && (
          <div className="grid gap-3 md:grid-cols-3">
            {marketTemplates.map((item) => (
              <div key={item.id} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="truncate text-sm font-semibold">{item.name}</h3>
                  <span className="text-xs text-zinc-400">{item.installCount}</span>
                </div>
                <p className="mb-3 line-clamp-2 text-xs text-zinc-500">{item.description || item.baseTemplate}</p>
                <div className="mb-3 text-xs text-zinc-500">
                  {item.purchased
                    ? '已解锁'
                    : item.canUseMonthlyFreeDownload
                      ? `会员免费提现剩余 ${item.freeDownloads?.remaining ?? 0} 次`
                      : item.product
                        ? `解锁 ${money(item.product.priceCents, item.product.currency)}`
                        : '需要解锁'}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleUseMarketTemplate(item)}
                  disabled={creatingTemplate === item.id}
                  className="w-full cursor-pointer"
                >
                  {creatingTemplate === item.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {item.purchased ? t('templates.useTemplate') : item.canUseMonthlyFreeDownload ? '免费提现并使用' : '解锁并使用'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {TEMPLATES.map((template, idx) => {
          const mockResume = buildMockResume(template);
          const label = getTemplateLabel(template, t);
          const isCreating = creatingTemplate === template;
          const isFirst = idx === 0;

          return (
            <div
              key={template}
              className="group flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white transition-shadow hover:shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            >
              {/* Template name */}
              <div className="flex items-center justify-center gap-2 border-b border-zinc-100 px-4 py-3 text-center dark:border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {label}
                </h3>
                {RECOMMENDED_TEMPLATES.has(template) && (
                  <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-white">
                    {t('templates.recommended')}
                  </span>
                )}
              </div>

              {/* Scaled preview */}
              <div className="relative h-[320px] overflow-hidden bg-zinc-50 dark:bg-zinc-950">
                <div
                  className="absolute left-1/2 top-0 origin-top"
                  style={{
                    width: '794px',
                    transform: 'translateX(-50%) scale(0.28)',
                  }}
                >
                  <ResumePreview resume={mockResume} />
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2 border-t border-zinc-100 px-4 py-3 dark:border-zinc-800">
                <Button
                  {...(isFirst ? { 'data-tour': 'tpl-preview' } : {})}
                  variant="outline"
                  size="sm"
                  className="flex-1 cursor-pointer gap-1.5"
                  onClick={() => setPreviewTemplate(template)}
                >
                  <Eye className="h-3.5 w-3.5" />
                  {t('templates.preview')}
                </Button>
                <Button
                  {...(isFirst ? { 'data-tour': 'tpl-use' } : {})}
                  size="sm"
                  className="flex-1 cursor-pointer gap-1.5 bg-brand hover:bg-brand-hover"
                  onClick={() => handleUseTemplate(template)}
                  disabled={isCreating}
                >
                  {isCreating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t('templates.creating')}
                    </>
                  ) : (
                    t('templates.useTemplate')
                  )}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full-size preview dialog */}
      <Dialog
        open={!!previewTemplate}
        onOpenChange={(open) => {
          if (!open) setPreviewTemplate(null);
        }}
      >
        <DialogContent className="flex h-[90vh] w-[90vw] max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[900px]">
          <DialogHeader className="shrink-0 border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
            <DialogTitle>
              {previewTemplate && getTemplateLabel(previewTemplate, t)}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {previewTemplate && (
              <div className="mx-auto w-full max-w-[794px] p-6">
                <ResumePreview resume={buildMockResume(previewTemplate)} />
              </div>
            )}
          </div>
          <div className="sticky bottom-0 border-t bg-white p-3 dark:bg-background sm:hidden">
            <Button
              className="w-full cursor-pointer bg-brand hover:bg-brand-hover"
              disabled={creatingTemplate === previewTemplate}
              onClick={() => previewTemplate && handleUseTemplate(previewTemplate)}
            >
              {creatingTemplate === previewTemplate ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('templates.creating')}
                </>
              ) : (
                t('templates.useTemplate')
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <TourOverlay tourId="templates" steps={TEMPLATES_TOUR_STEPS} />
    </div>
  );
}
