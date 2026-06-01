export const WALLET_CURRENCY_AI_CREDIT = 'AI_CREDIT';
export const WALLET_CURRENCY_POINT = 'POINT';

export type MembershipPlanKey = 'free' | 'pro' | 'premium' | 'business';

export type ProductType =
  | 'membership'
  | 'ai_credit_pack'
  | 'resume_template'
  | 'job_template'
  | 'interview_question_bank'
  | 'interview_mock_pack';

export type ProductSeed = {
  sku: string;
  type: ProductType;
  name: string;
  description: string;
  priceCents: number;
  currency?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
};

export type PlanSeed = {
  key: MembershipPlanKey;
  name: string;
  description: string;
  tier: number;
  priceCents: number;
  entitlements: Record<string, unknown>;
};

export type RedeemCodeSeed = {
  code: string;
  type: string;
  maxClaims: number;
  benefit: Record<string, unknown>;
};

export type ResumeTemplateMarketSeed = {
  key: string;
  name: string;
  description: string;
  baseTemplate: string;
  themeConfig?: Record<string, unknown>;
  customCss?: string;
  priceCents: number;
};

export const MEMBERSHIP_PLANS: PlanSeed[] = [
  {
    key: 'free',
    name: 'Free',
    description: '基础简历编辑、少量 AI 点数和免费题库试用。',
    tier: 0,
    priceCents: 0,
    entitlements: {
      'ai.monthly_credits': 20,
      'ai.model_tier': 'basic',
      'resume.max_count': 3,
      'resume.export.pdf': true,
      'resume.export.docx': false,
      'template.free_download_count': 0,
      'template.discount_rate': 0,
      'job_template.download': false,
      'interview.question_bank.access_level': 'free',
      'interview.mock.monthly_count': 1,
      'promotion.commission_rate': 0,
      'points.exchange.discount_rate': 0,
    },
  },
  {
    key: 'pro',
    name: 'Pro',
    description: '适合主动求职用户，解锁常用模板、职位模板和更多 AI 点数。',
    tier: 10,
    priceCents: 2900,
    entitlements: {
      'ai.monthly_credits': 300,
      'ai.model_tier': 'standard',
      'resume.max_count': 20,
      'resume.export.pdf': true,
      'resume.export.docx': true,
      'template.free_download_count': 5,
      'template.discount_rate': 10,
      'job_template.download': true,
      'interview.question_bank.access_level': 'pro',
      'interview.mock.monthly_count': 10,
      'promotion.commission_rate': 5,
      'points.exchange.discount_rate': 5,
    },
  },
  {
    key: 'premium',
    name: 'Premium',
    description: '面向高频投递和面试准备，开放高级模型、题库和模拟面试。',
    tier: 20,
    priceCents: 6900,
    entitlements: {
      'ai.monthly_credits': 900,
      'ai.model_tier': 'advanced',
      'resume.max_count': 80,
      'resume.export.pdf': true,
      'resume.export.docx': true,
      'template.free_download_count': 20,
      'template.discount_rate': 20,
      'job_template.download': true,
      'interview.question_bank.access_level': 'premium',
      'interview.mock.monthly_count': 40,
      'promotion.commission_rate': 10,
      'points.exchange.discount_rate': 10,
    },
  },
  {
    key: 'business',
    name: 'Business',
    description: '团队招聘辅导和批量简历优化场景，提供更高额度与推广权益。',
    tier: 30,
    priceCents: 19900,
    entitlements: {
      'ai.monthly_credits': 3000,
      'ai.model_tier': 'business',
      'resume.max_count': 300,
      'resume.export.pdf': true,
      'resume.export.docx': true,
      'template.free_download_count': 100,
      'template.discount_rate': 30,
      'job_template.download': true,
      'interview.question_bank.access_level': 'business',
      'interview.mock.monthly_count': 200,
      'promotion.commission_rate': 15,
      'points.exchange.discount_rate': 15,
    },
  },
];

export const PRODUCT_SEEDS: ProductSeed[] = [
  {
    sku: 'membership-pro-monthly',
    type: 'membership',
    name: 'Pro 月度会员',
    description: '解锁 Pro 会员权益 31 天。',
    priceCents: 2900,
    resourceType: 'membership_plan',
    resourceId: 'pro',
    metadata: { durationDays: 31 },
  },
  {
    sku: 'membership-premium-monthly',
    type: 'membership',
    name: 'Premium 月度会员',
    description: '解锁 Premium 会员权益 31 天。',
    priceCents: 6900,
    resourceType: 'membership_plan',
    resourceId: 'premium',
    metadata: { durationDays: 31 },
  },
  {
    sku: 'membership-business-monthly',
    type: 'membership',
    name: 'Business 月度会员',
    description: '解锁 Business 会员权益 31 天。',
    priceCents: 19900,
    resourceType: 'membership_plan',
    resourceId: 'business',
    metadata: { durationDays: 31 },
  },
  {
    sku: 'ai-credit-pack-100',
    type: 'ai_credit_pack',
    name: 'AI 点数包 100',
    description: '购买后到账 100 AI 点数。',
    priceCents: 990,
    metadata: { aiCredits: 100 },
  },
  {
    sku: 'interview-mock-pack-10',
    type: 'interview_mock_pack',
    name: '模拟面试 10 次包',
    description: '购买后解锁 10 次模拟面试权益。',
    priceCents: 1990,
    metadata: { entitlementKey: 'interview.mock.extra_count', count: 10 },
  },
];

export const REDEEM_CODE_SEEDS: RedeemCodeSeed[] = [
  {
    code: 'JADEAI-PRO-TRIAL',
    type: 'benefit',
    maxClaims: 1000,
    benefit: {
      items: [
        { type: 'membership', planKey: 'pro', durationDays: 7 },
        { type: 'wallet', currency: WALLET_CURRENCY_AI_CREDIT, amount: 100, description: 'Pro 试用 AI 点数' },
        { type: 'wallet', currency: WALLET_CURRENCY_POINT, amount: 300, description: 'Pro 试用积分' },
      ],
    },
  },
  {
    code: 'INTERVIEW-BOOST',
    type: 'benefit',
    maxClaims: 1000,
    benefit: {
      items: [
        { type: 'entitlement', key: 'interview.mock.extra_count', value: 5, expiresInDays: 30 },
        { type: 'wallet', currency: WALLET_CURRENCY_AI_CREDIT, amount: 30, description: '面试冲刺 AI 点数' },
      ],
    },
  },
];

export const RESUME_TEMPLATE_MARKET_SEEDS: ResumeTemplateMarketSeed[] = [
  {
    key: 'pro-developer-dark',
    name: '高级工程师深色侧栏模板',
    description: '适合中高级研发、AI 工程师和技术负责人，强调项目成果、技术栈和工程影响力。',
    baseTemplate: 'developer',
    priceCents: 990,
    themeConfig: {
      primaryColor: '#111827',
      accentColor: '#2563eb',
      fontFamily: 'Inter',
      fontSize: 'medium',
      sectionSpacing: 16,
    },
  },
  {
    key: 'premium-executive-clean',
    name: '高管顾问精英模板',
    description: '适合管理岗、咨询、金融和商业负责人，突出领导力、业务结果和履历层次。',
    baseTemplate: 'executive',
    priceCents: 1290,
    themeConfig: {
      primaryColor: '#1f2937',
      accentColor: '#b45309',
      fontFamily: 'Inter',
      fontSize: 'medium',
      sectionSpacing: 18,
    },
  },
  {
    key: 'ats-international-compact',
    name: 'ATS 国际投递模板',
    description: '适合英文简历、外企投递和系统筛选场景，版式克制、结构清晰、关键词友好。',
    baseTemplate: 'ats',
    priceCents: 690,
    themeConfig: {
      primaryColor: '#0f172a',
      accentColor: '#0f766e',
      fontFamily: 'Inter',
      fontSize: 'small',
      sectionSpacing: 12,
    },
  },
];

export const QUESTION_BANK_SEEDS = [
  {
    key: 'frontend-react-mid',
    title: '前端 React 中级面试题库',
    description: '覆盖 React、工程化、性能优化、浏览器和项目复盘。',
    industry: '互联网',
    role: '前端工程师',
    level: 'mid',
    companyType: '互联网',
    accessLevel: 'pro',
    questions: [
      {
        dimension: 'framework',
        difficulty: 'medium',
        questionType: 'open',
        prompt: 'React 组件频繁重渲染时，你会如何定位和优化？',
        referenceAnswer: '从 Profiler、组件边界、状态粒度、memo/useMemo/useCallback、列表 key、上下文拆分和数据缓存层逐步定位。',
        rubric: {
          excellent: '能结合性能工具、状态设计和真实业务权衡说明。',
          pass: '能说出 memo、useMemo、useCallback 和减少无效状态更新。',
        },
        keywords: ['Profiler', 'memo', 'state colocation', 'context split'],
        followUpStrategy: { askForExample: true, requireTradeoff: true },
      },
      {
        dimension: 'engineering',
        difficulty: 'medium',
        questionType: 'scenario',
        prompt: '如果一个线上页面首屏很慢，你会按什么顺序排查？',
        referenceAnswer: '先确认指标和复现，再看网络瀑布、JS 体积、渲染阻塞、接口延迟、缓存策略、图片和字体，最后建立监控闭环。',
        rubric: {
          excellent: '能区分 LCP/TTFB/INP，并能提出可验证的优化实验。',
          pass: '能覆盖资源、接口、渲染和缓存几个主要方向。',
        },
        keywords: ['LCP', 'TTFB', 'bundle', 'cache', 'waterfall'],
        followUpStrategy: { askMetricFirst: true },
      },
    ],
  },
  {
    key: 'backend-node-senior',
    title: '后端 Node.js 高级面试题库',
    description: '覆盖 API 设计、数据库一致性、任务队列、稳定性和系统设计。',
    industry: '互联网',
    role: '后端工程师',
    level: 'senior',
    companyType: '互联网',
    accessLevel: 'premium',
    questions: [
      {
        dimension: 'system_design',
        difficulty: 'hard',
        questionType: 'scenario',
        prompt: '设计一个 AI 调用计费系统时，如何保证扣费、失败退款和并发安全？',
        referenceAnswer: '使用账户账本、事务、幂等键、预扣/确认/退款状态机，并记录用量日志和审计信息。',
        rubric: {
          excellent: '能说明账本不可变、余额派生/缓存、幂等和失败补偿。',
          pass: '能说出事务扣费、失败返还和日志记录。',
        },
        keywords: ['ledger', 'idempotency', 'transaction', 'refund', 'audit'],
        followUpStrategy: { askForRaceCondition: true },
      },
    ],
  },
];
