import type { ProductEventName } from './product-event';

export type ProductEventActorRow = {
  eventName: string;
  userId: string | null;
  anonymousId: string | null;
  firstOccurredAt: Date | number | string | null;
};

type FunnelDefinition = {
  key: 'career' | 'commerce';
  label: string;
  steps: Array<{
    key: string;
    label: string;
    eventNames: ProductEventName[];
  }>;
};

export const PRODUCT_FUNNEL_DEFINITIONS: FunnelDefinition[] = [
  {
    key: 'career',
    label: '求职闭环',
    steps: [
      { key: 'resume_ready', label: '创建 / 导入简历', eventNames: ['resume_created', 'resume_imported'] },
      { key: 'jd_analyzed', label: '完成 JD 分析', eventNames: ['jd_analyzed'] },
      { key: 'tailored_resume_created', label: '生成专项简历', eventNames: ['tailored_resume_created'] },
      { key: 'resume_exported', label: '导出简历', eventNames: ['resume_exported'] },
      { key: 'mock_interview_started', label: '开始模拟面试', eventNames: ['mock_interview_started'] },
      { key: 'mock_interview_completed', label: '完成模拟面试', eventNames: ['mock_interview_completed'] },
      { key: 'application_created', label: '创建投递记录', eventNames: ['application_created'] },
      { key: 'application_result_recorded', label: '回填投递结果', eventNames: ['application_result_recorded'] },
    ],
  },
  {
    key: 'commerce',
    label: '商业闭环',
    steps: [
      { key: 'checkout_started', label: '开始结算', eventNames: ['checkout_started'] },
      { key: 'payment_succeeded', label: '支付成功', eventNames: ['payment_succeeded'] },
    ],
  },
];

function actorKey(row: ProductEventActorRow) {
  if (row.userId) return `user:${row.userId}`;
  if (row.anonymousId) return `anonymous:${row.anonymousId}`;
  return null;
}

function percentage(numerator: number, denominator: number) {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1_000) / 10;
}

function timestampInMilliseconds(value: ProductEventActorRow['firstOccurredAt']) {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
  }

  const normalized = typeof value === 'string' ? value.trim() : value;
  if (normalized === null || normalized === '') return null;

  const numeric = typeof normalized === 'number' ? normalized : Number(normalized);
  if (Number.isFinite(numeric)) {
    return Math.abs(numeric) < 1_000_000_000_000 ? numeric * 1_000 : numeric;
  }

  if (typeof normalized !== 'string') return null;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function buildProductFunnels(rows: ProductEventActorRow[]) {
  const actorsByEvent = new Map<string, Map<string, number>>();
  const allActors = new Set<string>();

  for (const row of rows) {
    const actor = actorKey(row);
    if (!actor) continue;
    allActors.add(actor);
    const firstOccurredAt = timestampInMilliseconds(row.firstOccurredAt);
    if (firstOccurredAt === null) continue;
    const actors = actorsByEvent.get(row.eventName) || new Map<string, number>();
    const existing = actors.get(actor);
    if (existing === undefined || firstOccurredAt < existing) actors.set(actor, firstOccurredAt);
    actorsByEvent.set(row.eventName, actors);
  }

  const funnels = PRODUCT_FUNNEL_DEFINITIONS.map((funnel) => {
    const stepActors = funnel.steps.map((step) => {
      const actors = new Map<string, number>();
      for (const eventName of step.eventNames) {
        for (const [actor, firstOccurredAt] of actorsByEvent.get(eventName) || []) {
          const existing = actors.get(actor);
          if (existing === undefined || firstOccurredAt < existing) actors.set(actor, firstOccurredAt);
        }
      }
      return actors;
    });
    const stepCounts: number[] = [];
    let cohort = new Map(stepActors[0] || []);
    for (let index = 0; index < stepActors.length; index += 1) {
      if (index > 0) {
        const currentActors = stepActors[index];
        const nextCohort = new Map<string, number>();
        for (const [actor, previousOccurredAt] of cohort) {
          const currentOccurredAt = currentActors.get(actor);
          if (currentOccurredAt !== undefined && currentOccurredAt >= previousOccurredAt) {
            nextCohort.set(actor, currentOccurredAt);
          }
        }
        cohort = nextCohort;
      }
      stepCounts.push(cohort.size);
    }
    const firstCount = stepCounts[0] || 0;

    return {
      key: funnel.key,
      label: funnel.label,
      steps: funnel.steps.map((step, index) => ({
        ...step,
        actors: stepCounts[index],
        conversionFromPrevious: index === 0 ? null : percentage(stepCounts[index], stepCounts[index - 1]),
        conversionFromStart: index === 0 ? (firstCount > 0 ? 100 : null) : percentage(stepCounts[index], firstCount),
      })),
    };
  });

  return { uniqueActors: allActors.size, funnels };
}
