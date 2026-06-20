'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Brush,
  ExternalLink,
  Gift,
  Lock,
  Palette,
  ReceiptText,
  Sparkles,
  Ticket,
  Trophy,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useFingerprint } from '@/hooks/use-fingerprint';
import { payExistingOrderWithMockPayment, purchaseProductWithMockPayment } from '@/lib/commercial/client-payments';
import { BRAND_OPTIONS } from '@/components/layout/brand-switcher';
import { useBrand, type Brand } from '@/components/layout/brand-provider';
import { cn } from '@/lib/utils';

type Product = {
  id: string;
  type: string;
  sku: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  resourceType?: string | null;
  resourceId?: string | null;
};

const MEMBERSHIP_PRODUCT_ORDER: Record<string, number> = {
  pro: 10,
  premium: 20,
  business: 30,
};

type WalletAccount = {
  id: string;
  currency: string;
  balance: number;
  lockedBalance: number;
};

type WalletTransaction = {
  id: string;
  currency: string;
  direction: string;
  amount: number;
  balanceAfter: number;
  source: string;
  description: string;
  createdAt: string | number | Date;
};

type PointsExchangeItem = {
  id: string;
  title: string;
  description: string;
  baseCost: number;
  cost: number;
  reward: {
    type: string;
    currency?: string;
    amount?: number;
    key?: string;
    value?: number;
    expiresInDays?: number;
  };
};

type AIUsageLog = {
  id: string;
  feature: string;
  provider?: string | null;
  model?: string | null;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  creditsCharged: number;
  status: string;
  error?: string | null;
  metadata?: {
    aiModelTier?: {
      requiredTier?: string;
    };
    membershipDeduction?: {
      planKey?: string;
      planName?: string;
      monthlyCredits?: number;
    } | null;
  } | null;
  createdAt: string | number | Date;
};

type Order = {
  id: string;
  orderNo: string;
  status: string;
  payableCents: number;
  currency: string;
  createdAt: string | number | Date;
  items?: OrderItem[];
  payments?: PaymentItem[];
};

type OrderItem = {
  id: string;
  name: string;
  productType: string;
  resourceType?: string | null;
  resourceId?: string | null;
  quantity: number;
  unitPriceCents: number;
  totalCents: number;
};

type PaymentItem = {
  id: string;
  provider: string;
  status: string;
  amountCents: number;
  currency: string;
  paidAt: string | number | Date;
};

type OrderDetail = Order & {
  totalCents: number;
  items: OrderItem[];
  payments: PaymentItem[];
  paidAt?: string | number | Date | null;
  fulfilledAt?: string | number | Date | null;
};

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  status?: string;
  actionUrl?: string | null;
  createdAt: string | number | Date;
};

type QuestionBank = {
  id: string;
  title: string;
  role: string;
  level: string;
  accessLevel: string;
  unlocked: boolean;
  canUseMonthlyFreeDownload?: boolean;
  freeDownloads?: {
    limit: number;
    used: number;
    remaining: number;
  } | null;
  product?: Product | null;
};

type PracticePaperQuestion = {
  id: string;
  bankId: string;
  dimension: string;
  difficulty: string;
  questionType: string;
  prompt: string;
};

type PracticePaper = {
  paperId: string;
  bank: {
    id: string;
    title: string;
    role: string;
    level: string;
  };
  strategy: {
    mode: string;
    selectedCount: number;
    keywords: string[];
  };
  questions: PracticePaperQuestion[];
};

type PracticePaperReport = {
  paperId: string;
  report: {
    averageScore: number;
    correctCount: number;
    total: number;
    summary: string;
    improvements: Array<{ dimension: string; suggestion: string }>;
  };
};

type InterviewQuota = {
  monthly: number;
  extra: number;
  limit: number;
  used: number;
  remaining: number;
  periodStart: string;
};

type PracticeAttempt = {
  id: string;
  bankId: string;
  questionId: string;
  score: number;
  isCorrect: boolean;
  feedback?: string;
  createdAt: string | number | Date;
};

type PracticeFavorite = {
  id: string;
  bankId: string;
  questionId: string;
  createdAt: string | number | Date;
};

type WrongQuestion = {
  id: string;
  bankId: string;
  questionId: string;
  wrongCount: number;
  bestScore: number;
  lastScore: number;
  question?: {
    prompt?: string;
    dimension?: string;
    difficulty?: string;
  } | null;
};

type MembershipProfile = {
  membership?: {
    plan?: {
      key: string;
      name: string;
      tier: number;
    };
  } | null;
  entitlements?: Record<string, unknown>;
};

type DirectEntitlement = {
  id: string;
  key: string;
  value: unknown;
  resourceType?: string | null;
  resourceId?: string | null;
  source: string;
  createdAt: string | number | Date;
  expiresAt?: string | number | Date | null;
};

type GrowthTask = {
  id: string;
  title: string;
  description: string;
  reward: {
    currency: string;
    amount: number;
  };
  claimable: boolean;
  claimed: boolean;
};

type ReferralRelation = {
  id: string;
  status: string;
  rewardStatus: string;
  createdAt: string | number | Date;
};

type LotteryDraw = {
  id: string;
  prizeType: string;
  prizePayload?: {
    title?: string;
    currency?: string;
    amount?: number;
  } | null;
  status: string;
  createdAt: string | number | Date;
};

type GrowthState = {
  referral: {
    code: string;
    inviteCount: number;
    rewardCount: number;
    rewardPolicy?: {
      currency: string;
      baseInviterReward: number;
      inviterRewardAmount: number;
      inviteeRewardAmount: number;
      commissionRate: number;
      planKey: string;
    };
    invitedBy?: ReferralRelation | null;
    relations: ReferralRelation[];
  };
  level: {
    key: string;
    name: string;
    level: number;
    totalPoints: number;
    next?: {
      key: string;
      name: string;
      minPoints: number;
    } | null;
    pointsToNext: number;
    progress: number;
  };
  tasks: GrowthTask[];
  lottery: {
    campaign?: {
      id: string;
      title: string;
      status: string;
    } | null;
    draws: LotteryDraw[];
  };
};

type AccountState = {
  membership: MembershipProfile | null;
  entitlements: DirectEntitlement[];
  wallet: { accounts: WalletAccount[]; transactions: WalletTransaction[] };
  aiUsage: AIUsageLog[];
  orders: Order[];
  products: Product[];
  pointsExchange: {
    discountRate: number;
    planKey: string;
    items: PointsExchangeItem[];
  };
  questionBanks: QuestionBank[];
  interviewQuota: InterviewQuota | null;
  practice: {
    attempts: PracticeAttempt[];
    favorites: PracticeFavorite[];
    wrongQuestions: WrongQuestion[];
  };
  growth: GrowthState | null;
  notifications: NotificationItem[];
};

type AccountNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const ACCOUNT_NAV_ITEMS: AccountNavItem[] = [
  { href: '#account-overview', label: '账户概览', icon: Sparkles },
  { href: '#account-billing', label: '消费记录', icon: ReceiptText },
  { href: '#account-practice', label: '面试资产', icon: Trophy },
  { href: '#account-content', label: '内容与通知', icon: Bell },
  { href: '#account-growth', label: '增长福利', icon: Gift },
  { href: '#account-preferences', label: '偏好设置', icon: Brush },
];

const BRAND_LABELS: Record<Brand, string> = {
  mint: '青绿',
  blue: '蓝色',
  pink: '粉色',
  orange: '橙色',
  purple: '紫色',
};

function headers(fingerprint: string | null): HeadersInit {
  return fingerprint ? { 'x-fingerprint': fingerprint } : {};
}

function money(cents: number, currency = 'CNY') {
  const amount = Number(cents || 0) / 100;
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    currencyDisplay: 'narrowSymbol',
  }).format(amount);
}

function compactDate(value: string | number | Date) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function entitlementExpiryLabel(item: DirectEntitlement) {
  return item.expiresAt ? `${compactDate(item.expiresAt)} 到期` : '永久有效';
}

function localizedActionUrl(actionUrl: string | null | undefined, locale: string) {
  if (!actionUrl?.startsWith('/')) return null;
  return actionUrl.replace(/^\/(zh|en)(?=\/|$)/, `/${locale}`);
}

function walletLabel(currency: string) {
  if (currency === 'AI_CREDIT') return 'AI 点数';
  if (currency === 'POINT') return '积分';
  return currency;
}

function usageStatusLabel(status: string) {
  if (status === 'success') return '成功';
  if (status === 'reserved') return '处理中';
  if (status === 'failed_refunded') return '失败已退回';
  if (status === 'insufficient_credits') return '点数不足';
  if (status === 'legacy_fallback') return '旧额度扣减';
  return status;
}

function orderStatusLabel(status: string) {
  if (status === 'pending_payment') return '待支付';
  if (status === 'paid') return '已支付';
  if (status === 'fulfilling') return '履约中';
  if (status === 'fulfilled') return '已完成';
  if (status === 'canceled') return '已取消';
  return status;
}

function orderStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'fulfilled') return 'default';
  if (status === 'paid' || status === 'fulfilling') return 'secondary';
  if (status === 'canceled') return 'outline';
  if (status === 'pending_payment') return 'destructive';
  return 'outline';
}

function orderItemSummary(order: Order) {
  const items = order.items || [];
  if (!items.length) return '暂无商品明细';

  const names = items.slice(0, 2).map((item) => (
    `${item.name}${item.quantity > 1 ? ` x${item.quantity}` : ''}`
  ));
  const suffix = items.length > 2 ? ` 等 ${items.length} 项` : '';
  return `${names.join(' / ')}${suffix}`;
}

function usageStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (status === 'success') return 'default';
  if (status === 'failed_refunded') return 'secondary';
  if (status === 'insufficient_credits') return 'destructive';
  return 'outline';
}

function planValue(entitlements: Record<string, unknown> | undefined, key: string, fallback = '-') {
  const value = entitlements?.[key];
  if (typeof value === 'boolean') return value ? '已开通' : '未开通';
  if (value === undefined || value === null || value === '') return fallback;
  return String(value);
}

export default function AccountPage() {
  const locale = useLocale();
  const { brand, setBrand } = useBrand();
  const { fingerprint, isLoading: fpLoading } = useFingerprint();
  const [state, setState] = useState<AccountState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [busyExchangeId, setBusyExchangeId] = useState<string | null>(null);
  const exchangeRequestIdsRef = useRef<Record<string, string>>({});
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [growthBusy, setGrowthBusy] = useState<string | null>(null);
  const [growthMessage, setGrowthMessage] = useState('');
  const [practicePaper, setPracticePaper] = useState<PracticePaper | null>(null);
  const [practiceReport, setPracticeReport] = useState<PracticePaperReport | null>(null);
  const [practiceBusy, setPracticeBusy] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);
  const [orderDetailLoading, setOrderDetailLoading] = useState(false);
  const [error, setError] = useState('');

  const requestHeaders = useMemo(() => headers(fingerprint), [fingerprint]);

  const load = useCallback(async () => {
    if (fpLoading) return;
    setLoading(true);
    setError('');
    try {
      const [membershipRes, entitlementRes, walletRes, aiUsageRes, ordersRes, productsRes, pointsExchangeRes, banksRes, interviewRes, practiceRes, growthRes, notificationsRes] = await Promise.all([
        fetch('/api/membership/me', { headers: requestHeaders }),
        fetch('/api/entitlements', { headers: requestHeaders }),
        fetch('/api/wallet', { headers: requestHeaders }),
        fetch('/api/ai/usage?limit=8', { headers: requestHeaders }),
        fetch('/api/orders?limit=8', { headers: requestHeaders }),
        fetch('/api/products', { headers: requestHeaders }),
        fetch('/api/points/exchange', { headers: requestHeaders }),
        fetch('/api/interview/question-banks', { headers: requestHeaders }),
        fetch('/api/interview', { headers: requestHeaders }),
        fetch('/api/interview/practice?limit=8', { headers: requestHeaders }),
        fetch('/api/growth', { headers: requestHeaders }),
        fetch('/api/notifications?limit=8', { headers: requestHeaders }),
      ]);

      if (!membershipRes.ok || !entitlementRes.ok || !walletRes.ok || !aiUsageRes.ok || !ordersRes.ok || !productsRes.ok || !pointsExchangeRes.ok || !banksRes.ok || !interviewRes.ok || !practiceRes.ok || !growthRes.ok || !notificationsRes.ok) {
        throw new Error('个人主页数据加载失败');
      }

      const [membership, entitlementProfile, wallet, aiUsage, orders, products, pointsExchange, banks, interview, practice, growth, notifications] = await Promise.all([
        membershipRes.json(),
        entitlementRes.json(),
        walletRes.json(),
        aiUsageRes.json(),
        ordersRes.json(),
        productsRes.json(),
        pointsExchangeRes.json(),
        banksRes.json(),
        interviewRes.json(),
        practiceRes.json(),
        growthRes.json(),
        notificationsRes.json(),
      ]);

      setState({
        membership,
        entitlements: Array.isArray(entitlementProfile.directEntitlements) ? entitlementProfile.directEntitlements : [],
        wallet: {
          accounts: Array.isArray(wallet.accounts) ? wallet.accounts : [],
          transactions: Array.isArray(wallet.transactions) ? wallet.transactions : [],
        },
        aiUsage: Array.isArray(aiUsage.usage) ? aiUsage.usage : [],
        orders: Array.isArray(orders.orders) ? orders.orders : [],
        products: Array.isArray(products.products) ? products.products : [],
        pointsExchange: {
          discountRate: Number(pointsExchange.discountRate || 0),
          planKey: String(pointsExchange.planKey || 'free'),
          items: Array.isArray(pointsExchange.items) ? pointsExchange.items : [],
        },
        questionBanks: Array.isArray(banks.banks) ? banks.banks : [],
        interviewQuota: interview?.quota || null,
        practice: {
          attempts: Array.isArray(practice.attempts) ? practice.attempts : [],
          favorites: Array.isArray(practice.favorites) ? practice.favorites : [],
          wrongQuestions: Array.isArray(practice.wrongQuestions) ? practice.wrongQuestions : [],
        },
        growth: growth && typeof growth === 'object' ? growth : null,
        notifications: Array.isArray(notifications.notifications) ? notifications.notifications : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : '个人主页数据加载失败');
    } finally {
      setLoading(false);
    }
  }, [fpLoading, requestHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  const buyProduct = async (product: Product) => {
    setBusyProductId(product.id);
    setError('');
    try {
      await purchaseProductWithMockPayment({
        productId: product.id,
        headers: requestHeaders,
        clientContext: { source: 'account' },
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '购买失败');
    } finally {
      setBusyProductId(null);
    }
  };

  const openOrderDetail = async (orderId: string) => {
    setOrderDetailLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/orders/${orderId}`, { headers: requestHeaders });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload.error || '订单详情加载失败'));
      setSelectedOrder(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : '订单详情加载失败');
    } finally {
      setOrderDetailLoading(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    setBusyProductId(orderId);
    setError('');
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { ...requestHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'cancel', reason: 'user_cancel' }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload.error || '订单取消失败'));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((current) => current ? { ...current, status: 'canceled' } : current);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '订单取消失败');
    } finally {
      setBusyProductId(null);
    }
  };

  const payOrder = async (orderId: string) => {
    setBusyProductId(orderId);
    setError('');
    try {
      await payExistingOrderWithMockPayment({
        orderId,
        headers: requestHeaders,
        clientContext: { source: 'account_order' },
      });
      if (selectedOrder?.id === orderId) {
        await openOrderDetail(orderId);
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '支付失败');
    } finally {
      setBusyProductId(null);
    }
  };

  const unlockQuestionBank = async (bank: QuestionBank, product?: Product | null) => {
    if (bank.unlocked) return;
    const targetProduct = product || bank.product;
    setBusyProductId(targetProduct?.id || bank.id);
    setError('');
    try {
      const unlockRes = await fetch(`/api/interview/question-banks/${bank.id}`, {
        headers: requestHeaders,
      });
      if (unlockRes.ok) {
        await load();
        return;
      }
      if (unlockRes.status !== 402 || !targetProduct?.id) {
        const payload = await unlockRes.json().catch(() => ({}));
        throw new Error(String(payload.error || '题库解锁失败'));
      }

      await buyProduct(targetProduct);
    } catch (err) {
      setError(err instanceof Error ? err.message : '题库解锁失败');
    } finally {
      setBusyProductId(null);
    }
  };

  const claimRedeemCode = async () => {
    const code = redeemCode.trim();
    if (!code) return;
    setRedeemBusy(true);
    setRedeemMessage('');
    setError('');
    try {
      const res = await fetch('/api/redeem-codes/claim', {
        method: 'POST',
        headers: { ...requestHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload.error || '兑换失败'));
      setRedeemCode('');
      setRedeemMessage('福利已到账');
      await load();
    } catch (err) {
      setRedeemMessage('');
      setError(err instanceof Error ? err.message : '兑换失败');
    } finally {
      setRedeemBusy(false);
    }
  };

  const claimGrowthTask = async (taskId: string) => {
    setGrowthBusy(taskId);
    setGrowthMessage('');
    setError('');
    try {
      const res = await fetch('/api/growth/tasks/claim', {
        method: 'POST',
        headers: { ...requestHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload.error || '任务领取失败'));
      setGrowthMessage('任务奖励已到账');
      await load();
    } catch (err) {
      setGrowthMessage('');
      setError(err instanceof Error ? err.message : '任务领取失败');
    } finally {
      setGrowthBusy(null);
    }
  };

  const bindInviteCode = async () => {
    const code = inviteCode.trim();
    if (!code) return;
    setGrowthBusy('bind-referral');
    setGrowthMessage('');
    setError('');
    try {
      const res = await fetch('/api/growth/referrals/bind', {
        method: 'POST',
        headers: { ...requestHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload.error || '邀请码绑定失败'));
      setInviteCode('');
      setGrowthMessage('邀请码奖励已到账');
      await load();
    } catch (err) {
      setGrowthMessage('');
      setError(err instanceof Error ? err.message : '邀请码绑定失败');
    } finally {
      setGrowthBusy(null);
    }
  };

  const drawLottery = async () => {
    setGrowthBusy('lottery-draw');
    setGrowthMessage('');
    setError('');
    try {
      const res = await fetch('/api/growth/lottery/draw', {
        method: 'POST',
        headers: requestHeaders,
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload.error || '抽奖失败'));
      const prizeTitle = payload.prize?.title ? String(payload.prize.title) : '抽奖完成';
      setGrowthMessage(prizeTitle);
      await load();
    } catch (err) {
      setGrowthMessage('');
      setError(err instanceof Error ? err.message : '抽奖失败');
    } finally {
      setGrowthBusy(null);
    }
  };

  const exchangePoints = async (item: PointsExchangeItem) => {
    if (exchangeRequestIdsRef.current[item.id]) return;
    const requestId = crypto.randomUUID();
    exchangeRequestIdsRef.current[item.id] = requestId;
    setBusyExchangeId(item.id);
    setError('');
    try {
      const res = await fetch('/api/points/exchange', {
        method: 'POST',
        headers: { ...requestHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, requestId }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload.error || '积分兑换失败'));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '积分兑换失败');
    } finally {
      delete exchangeRequestIdsRef.current[item.id];
      setBusyExchangeId(null);
    }
  };

  const markNotificationsRead = async (ids?: string[]) => {
    setError('');
    try {
      const res = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { ...requestHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) throw new Error('消息标记失败');
      setState((current) => current
        ? {
            ...current,
            notifications: current.notifications.map((item) => (
              !ids || ids.includes(item.id)
                ? { ...item, status: 'read' }
                : item
            )),
          }
        : current);
    } catch (err) {
      setError(err instanceof Error ? err.message : '消息标记失败');
    }
  };

  const generatePracticePaper = async (bank: QuestionBank) => {
    setPracticeBusy(bank.id);
    setPracticeReport(null);
    setError('');
    try {
      const res = await fetch('/api/interview/practice/papers', {
        method: 'POST',
        headers: { ...requestHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bankId: bank.id,
          count: 3,
          targetRole: bank.role,
          jobDescription: `${bank.role} ${bank.level} interview practice`,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload.error || '套题生成失败'));
      setPracticePaper(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : '套题生成失败');
    } finally {
      setPracticeBusy(null);
    }
  };

  const startPracticeFromPurchasedContent = async (bank: QuestionBank) => {
    document.getElementById('question-bank-practice')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await generatePracticePaper(bank);
  };

  const submitPracticePaperSample = async () => {
    if (!practicePaper) return;
    setPracticeBusy(practicePaper.paperId);
    setError('');
    try {
      const res = await fetch('/api/interview/practice/papers', {
        method: 'POST',
        headers: { ...requestHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit',
          bankId: practicePaper.bank.id,
          paperId: practicePaper.paperId,
          targetRole: practicePaper.bank.role,
          answers: practicePaper.questions.map((question) => ({
            questionId: question.id,
            answer: `我会先澄清目标和指标，再结合 ${question.dimension} 给出方案、取舍、风险和验证方式。`,
          })),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(String(payload.error || '套题提交失败'));
      setPracticeReport(payload);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '套题提交失败');
    } finally {
      setPracticeBusy(null);
    }
  };

  const downloadJobTemplateAsset = async (item: DirectEntitlement) => {
    if (item.resourceType !== 'job_template' || !item.resourceId) return;
    setBusyProductId(item.id);
    setError('');
    try {
      const res = await fetch(`/api/career/job-templates/${item.resourceId}/download?format=md`, {
        headers: requestHeaders,
      });
      const text = await res.text();
      if (!res.ok) {
        const payload = (() => {
          try { return JSON.parse(text); } catch { return null; }
        })();
        throw new Error(String(payload?.error || '职位模板下载失败'));
      }

      const blob = new Blob([text], { type: res.headers.get('content-type') || 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.resourceId}.md`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '职位模板下载失败');
    } finally {
      setBusyProductId(null);
    }
  };

  const downloadResumeTemplateAsset = async (item: DirectEntitlement) => {
    if (item.resourceType !== 'resume_template' || !item.resourceId) return;
    setBusyProductId(item.id);
    setError('');
    try {
      const res = await fetch(`/api/templates/${item.resourceId}/download`, {
        headers: requestHeaders,
      });
      const text = await res.text();
      if (!res.ok) {
        const payload = text ? JSON.parse(text) : {};
        throw new Error(String(payload.error || '简历模板下载失败'));
      }
      const blob = new Blob([text], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.resourceId}.resume-template.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '简历模板下载失败');
    } finally {
      setBusyProductId(null);
    }
  };

  const membershipProducts = (state?.products.filter((product) => product.type === 'membership') ?? [])
    .sort((a, b) => {
      const aOrder = MEMBERSHIP_PRODUCT_ORDER[a.resourceId || ''] ?? Number.MAX_SAFE_INTEGER;
      const bOrder = MEMBERSHIP_PRODUCT_ORDER[b.resourceId || ''] ?? Number.MAX_SAFE_INTEGER;
      return aOrder - bOrder || a.priceCents - b.priceCents;
    });
  const creditProducts = state?.products.filter((product) => product.type === 'ai_credit_pack' || product.type === 'interview_mock_pack') ?? [];
  const contentProducts = state?.products.filter((product) => product.type === 'interview_question_bank' || product.type === 'resume_template' || product.type === 'job_template') ?? [];
  const aiAccount = state?.wallet.accounts.find((account) => account.currency === 'AI_CREDIT');
  const pointsAccount = state?.wallet.accounts.find((account) => account.currency === 'POINT');
  const entitlements = state?.membership?.entitlements;
  const plan = state?.membership?.membership?.plan;
  const purchasedContent = state?.entitlements.filter((item) => item.resourceType && item.resourceId) ?? [];
  const extraEntitlements = state?.entitlements.filter((item) => !item.resourceType || !item.resourceId) ?? [];
  const practice = state?.practice ?? { attempts: [], favorites: [], wrongQuestions: [] };
  const interviewQuota = state?.interviewQuota;
  const growth = state?.growth;

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-6">
      <section className="flex flex-col gap-4 border-b border-zinc-200 pb-6 dark:border-zinc-800 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">个人主页</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-500 dark:text-zinc-400">
            查看会员、AI 点数、订单、题库权限和通知状态。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="rounded-md px-2.5 py-1">
            当前会员：{plan?.name || 'Free'}
          </Badge>
          <Badge variant="outline" className="rounded-md px-2.5 py-1">
            AI 点数：{aiAccount?.balance ?? 0}
          </Badge>
        </div>
      </section>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="grid min-w-0 gap-5 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
          <nav className="flex w-full max-w-full gap-1 overflow-x-auto rounded-xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 lg:flex-col lg:overflow-visible">
            {ACCOUNT_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="flex h-9 flex-none items-center gap-2 rounded-md px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50 lg:w-full"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </a>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 max-w-full space-y-8">
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
              <Skeleton className="h-40" />
            </div>
          ) : (
            <>
          <section id="account-overview" className="scroll-mt-24 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand" />
                  <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">会员权益</h2>
                </div>
                <Badge variant="secondary" className="rounded-md">{plan?.key || 'free'}</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ['AI 月额度', planValue(entitlements, 'ai.monthly_credits', '0')],
                  ['模型等级', planValue(entitlements, 'ai.model_tier', 'basic')],
                  ['简历数量', planValue(entitlements, 'resume.max_count', '3')],
                  ['DOCX 导出', planValue(entitlements, 'resume.export.docx', '未开通')],
                  ['模板免费下载', planValue(entitlements, 'template.free_download_count', '0')],
                  ['题库等级', planValue(entitlements, 'interview.question_bank.access_level', 'free')],
                  ['模拟面试', planValue(entitlements, 'interview.mock.monthly_count', '0')],
                  ['推广返利', `${planValue(entitlements, 'promotion.commission_rate', '0')}%`],
                  ['积分兑换折扣', `${planValue(entitlements, 'points.exchange.discount_rate', '0')}%`],
                ].map(([label, value]) => (
                  <div key={label} className="border-l border-zinc-200 pl-3 dark:border-zinc-800">
                    <div className="text-xs text-zinc-500">{label}</div>
                    <div className="mt-1 text-sm font-medium text-zinc-950 dark:text-zinc-50">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {membershipProducts.map((product) => (
                  <Button
                    key={product.id}
                    size="sm"
                    variant={product.resourceId === plan?.key ? 'outline' : 'default'}
                    disabled={busyProductId === product.id || product.resourceId === plan?.key}
                    onClick={() => buyProduct(product)}
                    className="cursor-pointer"
                  >
                    {product.resourceId === plan?.key ? '当前套餐' : `${product.name} ${money(product.priceCents, product.currency)}`}
                  </Button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-5 flex items-center gap-2">
                <WalletCards className="h-4 w-4 text-brand" />
                <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">钱包</h2>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                  <div className="text-xs text-zinc-500">AI 点数</div>
                  <div className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{aiAccount?.balance ?? 0}</div>
                </div>
                <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                  <div className="text-xs text-zinc-500">积分</div>
                  <div className="mt-1 text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{pointsAccount?.balance ?? 0}</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {creditProducts.map((product) => (
                  <Button
                    key={product.id}
                    size="sm"
                    variant="outline"
                    disabled={busyProductId === product.id}
                    onClick={() => buyProduct(product)}
                    className="cursor-pointer"
                  >
                    {product.name}
                  </Button>
                ))}
              </div>
              <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">积分兑换</div>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      当前会员兑换折扣 {state?.pointsExchange.discountRate ?? 0}%
                    </div>
                  </div>
                </div>
                <div className="grid gap-2">
                  {(state?.pointsExchange.items.length ? state.pointsExchange.items : []).map((item) => (
                    <div key={item.id} className="rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{item.title}</div>
                          <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">{item.description}</div>
                          <div className="mt-1 text-xs text-zinc-500">
                            {item.cost} 积分
                            {item.cost < item.baseCost ? ` · 原价 ${item.baseCost}` : ''}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyExchangeId === item.id || Number(pointsAccount?.balance || 0) < item.cost}
                          onClick={() => exchangePoints(item)}
                        >
                          兑换
                        </Button>
                      </div>
                    </div>
                  ))}
                  {!state?.pointsExchange.items.length && <div className="py-4 text-sm text-zinc-500">暂无兑换福利</div>}
                </div>
              </div>
            </div>
          </section>

          <section id="account-billing" className="scroll-mt-24 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand" />
              <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">AI 消耗记录</h2>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {(state?.aiUsage.length ? state.aiUsage : []).map((usage) => (
                <div key={usage.id} className="grid gap-3 py-3 text-sm md:grid-cols-[1fr_auto] md:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-zinc-950 dark:text-zinc-50">{usage.feature}</span>
                      <Badge variant={usageStatusVariant(usage.status)} className="rounded-md">
                        {usageStatusLabel(usage.status)}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {[usage.provider, usage.model, compactDate(usage.createdAt)].filter(Boolean).join(' · ')}
                    </div>
                    {(usage.metadata?.membershipDeduction || usage.metadata?.aiModelTier) && (
                      <div className="mt-1 text-xs text-zinc-500">
                        {[
                          usage.metadata.membershipDeduction?.planName || usage.metadata.membershipDeduction?.planKey,
                          usage.metadata.membershipDeduction?.monthlyCredits !== undefined
                            ? `月额度 ${usage.metadata.membershipDeduction.monthlyCredits}`
                            : '',
                          usage.metadata.aiModelTier?.requiredTier ? `模型等级 ${usage.metadata.aiModelTier.requiredTier}` : '',
                        ].filter(Boolean).join(' · ')}
                      </div>
                    )}
                    {usage.error && (
                      <div className="mt-1 line-clamp-2 text-xs text-red-600 dark:text-red-400">{usage.error}</div>
                    )}
                  </div>
                  <div className="text-left text-xs text-zinc-500 md:text-right">
                    <div className="font-medium text-zinc-950 dark:text-zinc-50">{usage.creditsCharged} AI 点数</div>
                    <div>{usage.totalTokens || 0} tokens</div>
                  </div>
                </div>
              ))}
              {!state?.aiUsage.length && <div className="py-8 text-sm text-zinc-500">暂无 AI 消耗记录</div>}
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 flex items-center gap-2">
                <ReceiptText className="h-4 w-4 text-brand" />
                <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">订单</h2>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {(state?.orders.length ? state.orders : []).map((order) => (
                  <div
                    key={order.id}
                    className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm"
                  >
                    <div>
                      <button
                        type="button"
                        className="cursor-pointer text-left font-medium text-zinc-950 hover:text-brand dark:text-zinc-50"
                        onClick={() => openOrderDetail(order.id)}
                      >
                        {order.orderNo}
                      </button>
                      <div className="mt-0.5 text-xs text-zinc-500">{compactDate(order.createdAt)}</div>
                      <div className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{orderItemSummary(order)}</div>
                      {!!order.payments?.length && (
                        <div className="mt-0.5 text-[11px] text-zinc-400">
                          支付记录 {order.payments.length} 条
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-medium">{money(order.payableCents, order.currency)}</div>
                      <div className="mt-1 flex justify-end gap-2">
                        <Badge variant={orderStatusVariant(order.status)} className="rounded-md">{orderStatusLabel(order.status)}</Badge>
                        {order.status === 'pending_payment' && (
                          <>
                            <button
                              type="button"
                              className="text-xs text-brand hover:text-brand/80"
                              disabled={busyProductId === order.id}
                              onClick={() => payOrder(order.id)}
                            >
                              继续支付
                            </button>
                            <button
                              type="button"
                              className="text-xs text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50"
                              disabled={busyProductId === order.id}
                              onClick={() => cancelOrder(order.id)}
                            >
                              取消
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {!state?.orders.length && <div className="py-8 text-sm text-zinc-500">暂无订单</div>}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 flex items-center gap-2">
                <Ticket className="h-4 w-4 text-brand" />
                <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">钱包流水</h2>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {(state?.wallet.transactions.length ? state.wallet.transactions : []).slice(0, 8).map((transaction) => (
                  <div key={transaction.id} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm">
                    <div>
                      <div className="font-medium text-zinc-950 dark:text-zinc-50">
                        {transaction.description || transaction.source}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">{compactDate(transaction.createdAt)}</div>
                    </div>
                    <div className={transaction.direction === 'credit' ? 'text-emerald-600' : 'text-zinc-950 dark:text-zinc-50'}>
                      {transaction.direction === 'credit' ? '+' : '-'}{transaction.amount} {walletLabel(transaction.currency)}
                    </div>
                  </div>
                ))}
                {!state?.wallet.transactions.length && <div className="py-8 text-sm text-zinc-500">暂无流水</div>}
              </div>
            </div>
          </section>

          <section id="account-practice" className="scroll-mt-24 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div id="question-bank-practice" className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 flex items-center gap-2">
                <Lock className="h-4 w-4 text-brand" />
                <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">面试题库权限</h2>
              </div>
              <div className="space-y-3">
                {state?.questionBanks.map((bank) => {
                  const product = bank.product || contentProducts.find((item) => item.resourceType === 'interview_question_bank' && item.resourceId === bank.id);
                  return (
                    <div key={bank.id} className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-3 dark:border-zinc-800">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">{bank.title}</div>
                        <div className="mt-0.5 text-xs text-zinc-500">{bank.role} · {bank.level} · {bank.accessLevel}</div>
                      </div>
	                      {bank.unlocked ? (
	                        <div className="flex shrink-0 items-center gap-2">
	                          <Button
	                            size="sm"
	                            variant="outline"
	                            disabled={practiceBusy === bank.id}
	                            onClick={() => generatePracticePaper(bank)}
	                          >
	                            生成套题
	                          </Button>
	                          <Badge className="rounded-md bg-emerald-600">已解锁</Badge>
	                        </div>
	                      ) : product ? (
	                        <Button
	                          size="sm"
                          variant="outline"
                          disabled={busyProductId === product.id || busyProductId === bank.id}
                          onClick={() => unlockQuestionBank(bank, product)}
                        >
                          解锁 {money(product.priceCents, product.currency)}
                        </Button>
                      ) : (
                        <Badge variant="outline" className="rounded-md">未解锁</Badge>
                      )}
                    </div>
	                  );
	                })}
	              </div>
	              {practicePaper && (
	                <div className="mt-4 rounded-md border border-zinc-100 p-3 dark:border-zinc-800">
	                  <div className="flex flex-wrap items-center justify-between gap-3">
	                    <div>
	                      <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">
	                        {practicePaper.bank.title} · {practicePaper.strategy.selectedCount} 题
	                      </div>
	                      <div className="mt-0.5 text-xs text-zinc-500">
	                        {practicePaper.strategy.mode} · {practicePaper.strategy.keywords.slice(0, 4).join(' / ') || '默认组卷'}
	                      </div>
	                    </div>
	                    <Button
	                      size="sm"
	                      disabled={practiceBusy === practicePaper.paperId}
	                      onClick={submitPracticePaperSample}
	                    >
	                      提交示例答案
	                    </Button>
	                  </div>
	                  <div className="mt-3 space-y-2">
	                    {practicePaper.questions.map((question) => (
	                      <div key={question.id} className="rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
	                        <div className="line-clamp-2 text-zinc-950 dark:text-zinc-50">{question.prompt}</div>
	                        <div className="mt-1 text-xs text-zinc-500">{question.dimension} · {question.difficulty}</div>
	                      </div>
	                    ))}
	                  </div>
	                </div>
	              )}
	              {practiceReport && (
	                <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
	                  <div className="font-medium">
	                    套题报告：{practiceReport.report.averageScore} 分 · 正确 {practiceReport.report.correctCount}/{practiceReport.report.total}
	                  </div>
	                  <div className="mt-1 text-xs">{practiceReport.report.summary}</div>
	                  {practiceReport.report.improvements.length > 0 && (
	                    <div className="mt-2 text-xs">
	                      待加强：{practiceReport.report.improvements.map((item) => item.dimension).join(' / ')}
	                    </div>
	                  )}
	                </div>
	              )}
	            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-brand" />
                <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">面试练习资产</h2>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                  <div className="text-xs text-zinc-500">模拟面试</div>
                  <div className="mt-1 text-xl font-semibold text-zinc-950 dark:text-zinc-50">
                    {interviewQuota ? `${interviewQuota.remaining}/${interviewQuota.limit}` : '-'}
                  </div>
                  {interviewQuota && (
                    <div className="mt-1 text-[11px] text-zinc-500">
                      已用 {interviewQuota.used} · 额外 {interviewQuota.extra}
                    </div>
                  )}
                </div>
                <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                  <div className="text-xs text-zinc-500">收藏题目</div>
                  <div className="mt-1 text-xl font-semibold text-zinc-950 dark:text-zinc-50">{practice.favorites.length}</div>
                </div>
                <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                  <div className="text-xs text-zinc-500">错题数</div>
                  <div className="mt-1 text-xl font-semibold text-zinc-950 dark:text-zinc-50">{practice.wrongQuestions.length}</div>
                </div>
              </div>

              <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
                {practice.attempts.slice(0, 4).map((attempt) => (
                  <div key={attempt.id} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm">
                    <div>
                      <div className="font-medium text-zinc-950 dark:text-zinc-50">
                        {attempt.feedback || '练习记录'}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">{compactDate(attempt.createdAt)}</div>
                    </div>
                    <Badge variant={attempt.isCorrect ? 'default' : 'outline'} className="h-fit rounded-md">
                      {attempt.score} 分
                    </Badge>
                  </div>
                ))}
                {!practice.attempts.length && <div className="py-8 text-sm text-zinc-500">暂无练习记录</div>}
              </div>

              {practice.wrongQuestions.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="text-xs font-medium text-zinc-500">错题本</div>
                  {practice.wrongQuestions.slice(0, 3).map((item) => (
                    <div key={item.id} className="rounded-md border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800">
                      <div className="line-clamp-2 text-zinc-950 dark:text-zinc-50">
                        {item.question?.prompt || item.questionId}
                      </div>
                      <div className="mt-1 text-xs text-zinc-500">
                        错 {item.wrongCount} 次 · 最高 {item.bestScore} 分 · 最近 {item.lastScore} 分
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>

          <section id="account-content" className="scroll-mt-24 grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-brand" />
                  <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">消息通知</h2>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!state?.notifications.some((item) => item.status !== 'read')}
                  onClick={() => markNotificationsRead()}
                >
                  全部已读
                </Button>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {(state?.notifications.length ? state.notifications : []).slice(0, 8).map((item) => (
                  <div key={item.id} className="py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={`h-2 w-2 shrink-0 rounded-full ${item.status === 'read' ? 'bg-zinc-200' : 'bg-brand'}`} />
                        <div className="truncate font-medium text-zinc-950 dark:text-zinc-50">{item.title}</div>
                      </div>
                      {item.status !== 'read' && (
                        <button
                          type="button"
                          className="shrink-0 text-xs text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-50"
                          onClick={() => markNotificationsRead([item.id])}
                        >
                          标记已读
                        </button>
                      )}
                    </div>
                    {item.description && <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">{item.description}</div>}
                    <div className="mt-1 flex items-center gap-2 text-[11px] text-zinc-400">
                      <span>{compactDate(item.createdAt)}</span>
                      {localizedActionUrl(item.actionUrl, locale) && (
                        <a
                          href={localizedActionUrl(item.actionUrl, locale) || undefined}
                          className="inline-flex items-center gap-1 text-brand hover:text-brand/80"
                        >
                          查看
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
                {!state?.notifications.length && <div className="py-8 text-sm text-zinc-500">暂无通知</div>}
              </div>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 flex items-center gap-2">
                <Gift className="h-4 w-4 text-brand" />
                <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">已购内容</h2>
              </div>
              <div className="space-y-3">
                {purchasedContent.map((item) => {
                  const product = contentProducts.find((product) => product.resourceType === item.resourceType && product.resourceId === item.resourceId);
                  const questionBank = item.resourceType === 'interview_question_bank'
                    ? state?.questionBanks.find((bank) => bank.id === item.resourceId)
                    : null;
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-md border border-zinc-100 px-3 py-3 dark:border-zinc-800">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-zinc-950 dark:text-zinc-50">
                          {product?.name || item.key}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          {item.resourceType} · {compactDate(item.createdAt)} · {entitlementExpiryLabel(item)}
                        </div>
                      </div>
	                      {item.resourceType === 'job_template' ? (
	                        <Button
	                          size="sm"
	                          variant="outline"
	                          disabled={busyProductId === item.id}
	                          onClick={() => downloadJobTemplateAsset(item)}
	                        >
	                          下载
	                        </Button>
	                      ) : item.resourceType === 'resume_template' ? (
	                        <Button
	                          size="sm"
	                          variant="outline"
	                          disabled={busyProductId === item.id}
	                          onClick={() => downloadResumeTemplateAsset(item)}
	                        >
	                          下载
	                        </Button>
	                      ) : item.resourceType === 'interview_question_bank' && questionBank ? (
	                        <Button
	                          size="sm"
	                          variant="outline"
	                          disabled={practiceBusy === questionBank.id}
	                          onClick={() => startPracticeFromPurchasedContent(questionBank)}
	                        >
	                          练习
	                        </Button>
	                      ) : (
	                        <Badge className="rounded-md bg-emerald-600">已解锁</Badge>
	                      )}
	                    </div>
                  );
                })}
                {!purchasedContent.length && <div className="py-8 text-sm text-zinc-500">暂无已购模板或题库</div>}
              </div>
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 flex items-center gap-2">
                <Ticket className="h-4 w-4 text-brand" />
                <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">兑换福利</h2>
              </div>
              <div className="flex gap-2">
                <Input
                  value={redeemCode}
                  onChange={(event) => setRedeemCode(event.target.value)}
                  placeholder="输入兑换码"
                  className="uppercase"
                />
                <Button disabled={redeemBusy || !redeemCode.trim()} onClick={claimRedeemCode}>
                  领取
                </Button>
              </div>
              {redeemMessage && <div className="mt-3 text-sm text-emerald-600">{redeemMessage}</div>}
              <div className="mt-4 space-y-2">
                {extraEntitlements.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-900">
                    <span className="truncate text-zinc-700 dark:text-zinc-200">{item.key}</span>
                    <span className="text-xs text-zinc-500">{item.expiresAt ? entitlementExpiryLabel(item) : item.source}</span>
                  </div>
                ))}
                {!extraEntitlements.length && <div className="py-6 text-sm text-zinc-500">暂无额外福利</div>}
              </div>
            </div>
          </section>

          <section id="account-growth" className="scroll-mt-24 grid gap-4 xl:grid-cols-3">
            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 flex items-center gap-2">
                <Users className="h-4 w-4 text-brand" />
                <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">推广中心</h2>
              </div>
              <div className="mb-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs text-zinc-500">成长等级</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                      Lv.{growth?.level.level ?? 1} {growth?.level.name || '求职新手'}
                    </div>
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    累计 {growth?.level.totalPoints ?? 0} 积分
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${Math.min(100, Math.max(0, growth?.level.progress ?? 0))}%` }}
                  />
                </div>
                <div className="mt-2 text-xs text-zinc-500">
                  {growth?.level.next
                    ? `距离 ${growth.level.next.name} 还差 ${growth.level.pointsToNext} 积分`
                    : '已达到当前最高成长等级'}
                </div>
              </div>
              <div className="rounded-md bg-zinc-50 p-3 dark:bg-zinc-900">
                <div className="text-xs text-zinc-500">我的邀请码</div>
                <div className="mt-1 break-all font-mono text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {growth?.referral.code || '-'}
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-zinc-500">邀请人数</div>
                  <div className="mt-1 font-semibold">{growth?.referral.inviteCount ?? 0}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500">奖励次数</div>
                  <div className="mt-1 font-semibold">{growth?.referral.rewardCount ?? 0}</div>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-zinc-200 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">
                <div className="font-medium text-zinc-900 dark:text-zinc-100">
                  单次邀请奖励 {growth?.referral.rewardPolicy?.inviterRewardAmount ?? 100} 积分
                </div>
                <div className="mt-1">
                  当前会员返利加成 {growth?.referral.rewardPolicy?.commissionRate ?? 0}% ，新人绑定奖励 {growth?.referral.rewardPolicy?.inviteeRewardAmount ?? 50} 积分。
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Input
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value)}
                  placeholder="绑定邀请码"
                />
                <Button
                  variant="outline"
                  disabled={growthBusy === 'bind-referral' || !inviteCode.trim() || Boolean(growth?.referral.invitedBy)}
                  onClick={bindInviteCode}
                >
                  绑定
                </Button>
              </div>
              {growth?.referral.invitedBy && <div className="mt-2 text-xs text-zinc-500">已绑定邀请关系</div>}
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 flex items-center gap-2">
                <Gift className="h-4 w-4 text-brand" />
                <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">福利任务</h2>
              </div>
              <div className="space-y-3">
                {(growth?.tasks.length ? growth.tasks : []).map((task) => (
                  <div key={task.id} className="rounded-md border border-zinc-100 px-3 py-3 dark:border-zinc-800">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{task.title}</div>
                        <div className="mt-0.5 text-xs leading-relaxed text-zinc-500">{task.description}</div>
                        <div className="mt-1 text-xs text-zinc-500">
                          +{task.reward.amount} {walletLabel(task.reward.currency)}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant={task.claimed ? 'outline' : 'default'}
                        disabled={task.claimed || !task.claimable || growthBusy === task.id}
                        onClick={() => claimGrowthTask(task.id)}
                      >
                        {task.claimed ? '已领取' : task.claimable ? '领取' : '未完成'}
                      </Button>
                    </div>
                  </div>
                ))}
                {!growth?.tasks.length && <div className="py-8 text-sm text-zinc-500">暂无福利任务</div>}
              </div>
              {growthMessage && <div className="mt-3 text-sm text-emerald-600">{growthMessage}</div>}
            </div>

            <div className="rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-brand" />
                  <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">抽奖记录</h2>
                </div>
                <Button size="sm" variant="outline" disabled={growthBusy === 'lottery-draw'} onClick={drawLottery}>
                  抽奖
                </Button>
              </div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {(growth?.lottery.draws.length ? growth.lottery.draws : []).slice(0, 5).map((draw) => (
                  <div key={draw.id} className="grid grid-cols-[1fr_auto] gap-3 py-3 text-sm">
                    <div>
                      <div className="font-medium text-zinc-950 dark:text-zinc-50">
                        {draw.prizePayload?.title || draw.prizeType}
                      </div>
                      <div className="mt-0.5 text-xs text-zinc-500">{compactDate(draw.createdAt)}</div>
                    </div>
                    <Badge variant="outline" className="h-fit rounded-md">{draw.status}</Badge>
                  </div>
                ))}
                {!growth?.lottery.draws.length && <div className="py-8 text-sm text-zinc-500">暂无抽奖记录</div>}
              </div>
            </div>
          </section>

          <section id="account-preferences" className="scroll-mt-24 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-brand" />
                <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-50">主题色</h2>
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                当前主题色：{BRAND_LABELS[brand]}
              </p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {BRAND_OPTIONS.map((option) => {
                const active = brand === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setBrand(option.id)}
                    className={cn(
                      'flex h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 text-sm font-medium transition-colors',
                      active
                        ? 'border-zinc-900 bg-zinc-950 text-white dark:border-zinc-100 dark:bg-zinc-50 dark:text-zinc-950'
                        : 'border-zinc-200 text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900'
                    )}
                    aria-pressed={active}
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full"
                      style={{ backgroundColor: option.swatch }}
                    />
                    <span>{BRAND_LABELS[option.id]}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <Dialog open={Boolean(selectedOrder)} onOpenChange={(open) => !open && setSelectedOrder(null)}>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle className="flex items-center justify-between gap-3">
                  <span>订单详情</span>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedOrder(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </DialogTitle>
              </DialogHeader>
              {orderDetailLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-24" />
                </div>
              ) : selectedOrder ? (
                <div className="space-y-5">
                  <div className="grid gap-3 rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-900 sm:grid-cols-3">
                    <div>
                      <div className="text-xs text-zinc-500">订单号</div>
                      <div className="mt-1 font-medium text-zinc-950 dark:text-zinc-50">{selectedOrder.orderNo}</div>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">状态</div>
                      <Badge variant={orderStatusVariant(selectedOrder.status)} className="mt-1 rounded-md">{orderStatusLabel(selectedOrder.status)}</Badge>
                    </div>
                    <div>
                      <div className="text-xs text-zinc-500">应付</div>
                      <div className="mt-1 font-medium text-zinc-950 dark:text-zinc-50">
                        {money(selectedOrder.payableCents, selectedOrder.currency)}
                      </div>
                    </div>
                  </div>
                  {selectedOrder.status === 'pending_payment' && (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        disabled={busyProductId === selectedOrder.id}
                        onClick={() => payOrder(selectedOrder.id)}
                      >
                        继续支付
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busyProductId === selectedOrder.id}
                        onClick={() => cancelOrder(selectedOrder.id)}
                      >
                        取消订单
                      </Button>
                    </div>
                  )}

                  <div>
                    <div className="mb-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">商品明细</div>
                    <div className="divide-y divide-zinc-100 rounded-md border border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
                      {selectedOrder.items.map((item) => (
                        <div key={item.id} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-3 text-sm">
                          <div className="min-w-0">
                            <div className="truncate font-medium text-zinc-950 dark:text-zinc-50">{item.name}</div>
                            <div className="mt-0.5 text-xs text-zinc-500">
                              {[item.productType, item.resourceType, item.resourceId].filter(Boolean).join(' · ')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{money(item.totalCents, selectedOrder.currency)}</div>
                            <div className="mt-0.5 text-xs text-zinc-500">x{item.quantity}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-sm font-medium text-zinc-950 dark:text-zinc-50">支付记录</div>
                    <div className="divide-y divide-zinc-100 rounded-md border border-zinc-100 dark:divide-zinc-800 dark:border-zinc-800">
                      {selectedOrder.payments.length ? selectedOrder.payments.map((payment) => (
                        <div key={payment.id} className="grid grid-cols-[1fr_auto] gap-3 px-3 py-3 text-sm">
                          <div>
                            <div className="font-medium text-zinc-950 dark:text-zinc-50">{payment.provider}</div>
                            <div className="mt-0.5 text-xs text-zinc-500">{compactDate(payment.paidAt)}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{money(payment.amountCents, payment.currency)}</div>
                            <Badge variant="outline" className="mt-1 rounded-md">{payment.status}</Badge>
                          </div>
                        </div>
                      )) : (
                        <div className="px-3 py-6 text-sm text-zinc-500">暂无支付记录</div>
                      )}
                    </div>
                  </div>
                </div>
              ) : null}
            </DialogContent>
          </Dialog>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
