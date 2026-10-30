import { fulfillOrder, markCommercialOrderPaid } from './billing-service';
import { assertPaymentProviderAllowed, getDefaultPaymentProvider } from './payment-policy';
import {
  StripePaymentValidationError,
  StripeWebhookPayloadError,
  StripeWebhookVerificationError,
  assertStripeSuccessfulPaymentMatchesOrder,
  createStripeCheckoutSession,
  parseStripeWebhook,
  type StripePaymentWebhookEvent,
} from './stripe-payment';
import {
  notificationStoreRepository,
  orderRepository,
} from '@/lib/db/repositories/commercial.repository';

export type PaymentProvider = 'mock' | 'wechat' | 'alipay' | 'stripe' | string;

type PaymentOrderSnapshot = {
  id: string;
  orderNo: string;
  status: string;
  payableCents: number;
  currency: string;
};

type PaymentIntentInput = {
  userId: string;
  orderId: string;
  provider?: PaymentProvider;
  returnUrl?: string;
  clientContext?: Record<string, unknown>;
};

type PaymentIntentAdapterInput = PaymentIntentInput & {
  provider: PaymentProvider;
  order: PaymentOrderSnapshot;
};

type PaymentIntentResult = {
  provider: PaymentProvider;
  orderId: string;
  paymentIntentId: string;
  clientSecret?: string;
  checkoutUrl?: string | null;
  amountCents: number;
  currency: string;
  status: string;
  rawPayload: Record<string, unknown>;
};

type PaymentConfirmInput = {
  userId: string;
  orderId: string;
  provider?: PaymentProvider;
  paymentIntentId?: string;
  rawPayload?: Record<string, unknown>;
};

type PaymentConfirmResult = {
  provider: PaymentProvider;
  providerTradeNo: string;
  rawPayload: Record<string, unknown>;
};

type PaymentWebhookInput = {
  provider: PaymentProvider;
  rawBody: string;
  headers?: Record<string, string>;
};

type PaymentWebhookEvent = {
  provider: PaymentProvider;
  eventId?: string;
  eventType?: string;
  orderId: string;
  status: string;
  providerTradeNo?: string;
  amountCents?: number;
  currency?: string;
  rawPayload: Record<string, unknown>;
};

type PaymentAdapter = {
  provider: PaymentProvider;
  createIntent(input: PaymentIntentAdapterInput): Promise<PaymentIntentResult>;
  confirm(input: PaymentConfirmInput): Promise<PaymentConfirmResult>;
  parseWebhook(input: PaymentWebhookInput): Promise<PaymentWebhookEvent>;
};

class UnsupportedPaymentProviderError extends Error {
  constructor(provider: string) {
    super(`Unsupported payment provider: ${provider}`);
    this.name = 'UnsupportedPaymentProviderError';
  }
}

export class PaymentWebhookRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentWebhookRequestError';
  }
}

export class StripeClientConfirmationDisabledError extends Error {
  constructor() {
    super('Stripe payments are confirmed only by signed webhooks');
    this.name = 'StripeClientConfirmationDisabledError';
  }
}

const mockPaymentAdapter: PaymentAdapter = {
  provider: 'mock',
  async createIntent(input) {
    return {
      provider: 'mock',
      orderId: input.orderId,
      paymentIntentId: `mock_pi_${crypto.randomUUID()}`,
      clientSecret: `mock_secret_${crypto.randomUUID()}`,
      checkoutUrl: null,
      amountCents: Number(input.order.payableCents || 0),
      currency: input.order.currency || 'CNY',
      status: 'requires_confirmation',
      rawPayload: {
        returnUrl: input.returnUrl || null,
        clientContext: input.clientContext || {},
      },
    };
  },
  async confirm(input) {
    return {
      provider: 'mock',
      providerTradeNo: `mock_${crypto.randomUUID()}`,
      rawPayload: {
        ...(input.rawPayload || {}),
        paymentIntentId: input.paymentIntentId || null,
      },
    };
  },
  async parseWebhook(input) {
    const payload = parseWebhookJson(input.rawBody);
    const orderId = String(payload.orderId || '');
    if (!orderId) throw new Error('orderId is required');
    return {
      provider: 'mock',
      orderId,
      status: String(payload.status || 'succeeded'),
      providerTradeNo: typeof payload.providerTradeNo === 'string'
        ? payload.providerTradeNo
        : `mock_wh_${crypto.randomUUID()}`,
      rawPayload: payload,
    };
  },
};

const stripePaymentAdapter: PaymentAdapter = {
  provider: 'stripe',
  async createIntent(input) {
    const session = await createStripeCheckoutSession({ order: input.order });
    return {
      provider: 'stripe',
      orderId: input.orderId,
      paymentIntentId: session.id,
      checkoutUrl: session.url,
      amountCents: session.amountTotal,
      currency: session.currency.toUpperCase(),
      status: session.status,
      rawPayload: {
        checkoutSessionId: session.id,
        paymentStatus: session.paymentStatus,
      },
    };
  },
  async confirm() {
    throw new StripeClientConfirmationDisabledError();
  },
  async parseWebhook(input) {
    const signature = Object.entries(input.headers || {})
      .find(([key]) => key.toLowerCase() === 'stripe-signature')?.[1];
    const event = parseStripeWebhook({
      rawBody: input.rawBody,
      signatureHeader: signature,
    });
    return {
      provider: 'stripe',
      eventId: event.eventId,
      eventType: event.eventType,
      orderId: event.orderId || '',
      status: event.status,
      providerTradeNo: event.providerTradeNo,
      amountCents: event.amountCents,
      currency: event.currency,
      rawPayload: event.rawPayload,
    };
  },
};

const adapters = new Map<PaymentProvider, PaymentAdapter>([
  [mockPaymentAdapter.provider, mockPaymentAdapter],
  [stripePaymentAdapter.provider, stripePaymentAdapter],
]);

function getPaymentAdapter(provider: PaymentProvider) {
  assertPaymentProviderAllowed(provider);
  const adapter = adapters.get(provider);
  if (!adapter) throw new UnsupportedPaymentProviderError(provider);
  return adapter;
}

function parseWebhookJson(rawBody: string): Record<string, unknown> {
  if (!rawBody) return {};
  try {
    const payload = JSON.parse(rawBody);
    return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
  } catch {
    return {};
  }
}

export async function createCommercialPaymentIntent(input: PaymentIntentInput) {
  const provider = input.provider || getDefaultPaymentProvider();
  assertPaymentProviderAllowed(provider);
  const order = await orderRepository.findByIdForUser(input.orderId, input.userId);
  if (!order) throw new Error('Order not found');
  if (order.status === 'canceled') throw new Error('Order is canceled');
  if (order.status === 'paid' || order.status === 'fulfilling' || order.status === 'fulfilled') throw new Error('Order is already paid');
  if (order.status === 'manual_review') throw new Error('Order requires manual review');

  const adapter = getPaymentAdapter(provider);
  return adapter.createIntent({
    ...input,
    provider,
    order,
  });
}

export async function confirmCommercialPayment(input: PaymentConfirmInput) {
  const provider = input.provider || getDefaultPaymentProvider();
  assertPaymentProviderAllowed(provider);
  if (provider === 'stripe') throw new StripeClientConfirmationDisabledError();
  const order = await orderRepository.findByIdForUser(input.orderId, input.userId);
  if (!order) throw new Error('Order not found');
  if (order.status === 'canceled') throw new Error('Order is canceled');
  if (order.status === 'fulfilled' || order.status === 'fulfilling') return order;
  if (order.status === 'paid') {
    await fulfillOrder(input.orderId, input.userId);
    return orderRepository.findByIdForUser(input.orderId, input.userId);
  }

  const adapter = getPaymentAdapter(provider);
  const payment = await adapter.confirm(input);
  await markCommercialOrderPaid({
    userId: input.userId,
    orderId: input.orderId,
    provider: payment.provider,
    providerTradeNo: payment.providerTradeNo,
    rawPayload: payment.rawPayload,
  });

  return orderRepository.findByIdForUser(input.orderId, input.userId);
}

export async function handleCommercialPaymentWebhook(input: PaymentWebhookInput) {
  const provider = input.provider || getDefaultPaymentProvider();
  assertPaymentProviderAllowed(provider);
  const adapter = getPaymentAdapter(provider);
  let event: PaymentWebhookEvent;
  try {
    event = await adapter.parseWebhook({ ...input, provider });
  } catch (error) {
    if (
      error instanceof StripeWebhookVerificationError
      || error instanceof StripeWebhookPayloadError
      || error instanceof StripePaymentValidationError
    ) {
      throw new PaymentWebhookRequestError(error.message);
    }
    throw error;
  }

  if (provider === 'stripe') {
    return handleStripePaymentWebhook(event);
  }

  if (event.status !== 'succeeded') {
    return {
      provider: event.provider,
      status: event.status,
      ignored: true,
      order: null,
    };
  }

  const order = await orderRepository.findById(event.orderId);
  if (!order) throw new Error('Order not found');

  await markCommercialOrderPaid({
    userId: order.userId,
    orderId: order.id,
    provider: event.provider,
    providerTradeNo: event.providerTradeNo,
    rawPayload: event.rawPayload,
  });

  return {
    provider: event.provider,
    status: event.status,
    ignored: false,
    order: await orderRepository.findByIdForUser(order.id, order.userId),
  };
}

const STRIPE_MANUAL_REVIEW_FROM = [
  'pending_payment',
  'payment_failed',
  'paid',
  'fulfilling',
  'fulfilled',
  'canceled',
  'manual_review',
];

function stripeEvent(event: PaymentWebhookEvent): StripePaymentWebhookEvent {
  return {
    eventId: event.eventId || '',
    eventType: event.eventType || '',
    livemode: event.rawPayload.livemode === true,
    status: event.status as StripePaymentWebhookEvent['status'],
    orderId: event.orderId || undefined,
    providerTradeNo: event.providerTradeNo,
    paymentIntentId: typeof event.rawPayload.paymentIntentId === 'string'
      ? event.rawPayload.paymentIntentId
      : undefined,
    amountCents: event.amountCents,
    currency: event.currency,
    rawPayload: event.rawPayload,
  };
}

async function resolveStripeWebhookOrder(event: PaymentWebhookEvent) {
  let order = event.orderId ? await orderRepository.findById(event.orderId) : null;
  if (!order && event.providerTradeNo) {
    const payment = await orderRepository.findPaymentByProviderTradeNo('stripe', event.providerTradeNo);
    order = payment ? await orderRepository.findById(payment.orderId) : null;
  }
  if (!order) throw new PaymentWebhookRequestError('Stripe webhook order was not found');
  if (event.orderId && event.orderId !== order.id) {
    throw new PaymentWebhookRequestError('Stripe webhook orderId is inconsistent');
  }
  return order;
}

async function notifyStripeEvent(
  order: { id: string; userId: string },
  event: PaymentWebhookEvent,
  type: string,
  title: string,
  description: string,
) {
  const eventId = event.eventId || `${event.eventType}:${event.providerTradeNo}`;
  return notificationStoreRepository.createOnce({
    id: `notification:stripe:${eventId}`,
    userId: order.userId,
    type,
    title,
    description,
    actionUrl: '/zh/account',
    metadata: {
      sourceId: `stripe:${eventId}`,
      orderId: order.id,
      stripeEventId: event.eventId || null,
      stripeEventType: event.eventType || null,
      paymentStatus: event.status,
    },
  });
}

async function recordStripePaymentState(
  order: { id: string; payableCents: number; currency: string },
  event: PaymentWebhookEvent,
  status: string,
  orderTransition?: { from: string[]; to: string; metadata?: Record<string, unknown> },
) {
  return orderRepository.recordPaymentState(order.id, {
    provider: 'stripe',
    providerTradeNo: event.providerTradeNo || `event:${event.eventId}`,
    status,
    amountCents: event.amountCents ?? Number(order.payableCents),
    currency: (event.currency || order.currency).toUpperCase(),
    rawPayload: event.rawPayload,
    orderTransition,
  });
}

async function recordStripeManualReview(
  order: { id: string; userId: string; orderNo: string; payableCents: number; currency: string },
  event: PaymentWebhookEvent,
  paymentStatus: string,
  reason: string,
  notificationTitle: string,
  notificationDescription: string,
) {
  await recordStripePaymentState(order, event, paymentStatus, {
    from: STRIPE_MANUAL_REVIEW_FROM,
    to: 'manual_review',
    metadata: {
      paymentReviewRequired: true,
      paymentReviewReason: reason,
      stripeEventId: event.eventId || null,
      stripeEventType: event.eventType || null,
    },
  });
  await notifyStripeEvent(order, event, 'payment_manual_review', notificationTitle, notificationDescription);
}

async function handleStripePaymentWebhook(event: PaymentWebhookEvent) {
  if (event.status === 'ignored') {
    return {
      provider: 'stripe',
      status: event.status,
      ignored: true,
      order: null,
    };
  }

  const order = await resolveStripeWebhookOrder(event);
  const normalized = stripeEvent(event);

  if (event.status === 'succeeded') {
    try {
      assertStripeSuccessfulPaymentMatchesOrder(normalized, order);
    } catch (error) {
      if (!(error instanceof StripePaymentValidationError)) throw error;
      await recordStripeManualReview(
        order,
        event,
        'validation_failed',
        error.message,
        '支付信息需要核对',
        `订单 ${order.orderNo} 的支付金额或币种校验失败，已暂停履约并进入人工复核。`,
      );
      throw new PaymentWebhookRequestError(error.message);
    }

    const existingPayment = await orderRepository.findPaymentByProviderTradeNo(
      'stripe',
      event.providerTradeNo!,
    );
    if (existingPayment && existingPayment.orderId !== order.id) {
      throw new Error('Stripe payment is already linked to another order');
    }
    if (existingPayment?.status === 'succeeded') {
      if (order.status === 'paid') await fulfillOrder(order.id, order.userId);
      return {
        provider: 'stripe',
        status: event.status,
        ignored: false,
        replayed: true,
        order: await orderRepository.findByIdForUser(order.id, order.userId),
      };
    }
    if (existingPayment && ['refunded', 'partially_refunded', 'disputed', 'validation_failed'].includes(existingPayment.status)) {
      return {
        provider: 'stripe',
        status: existingPayment.status,
        ignored: false,
        replayed: true,
        manualReview: true,
        order: await orderRepository.findByIdForUser(order.id, order.userId),
      };
    }
    if (
      ['paid', 'fulfilling', 'fulfilled'].includes(order.status)
      && existingPayment?.status !== 'succeeded'
    ) {
      await recordStripeManualReview(
        order,
        event,
        'duplicate_succeeded',
        'A second successful Stripe payment was received for an already paid order',
        '订单收到重复付款',
        `订单 ${order.orderNo} 收到另一笔成功付款，已进入人工退款复核。`,
      );
      return {
        provider: 'stripe',
        status: 'duplicate_succeeded',
        ignored: false,
        manualReview: true,
        order: await orderRepository.findByIdForUser(order.id, order.userId),
      };
    }

    await markCommercialOrderPaid({
      userId: order.userId,
      orderId: order.id,
      provider: 'stripe',
      providerTradeNo: event.providerTradeNo,
      rawPayload: event.rawPayload,
    });
    return {
      provider: 'stripe',
      status: event.status,
      ignored: false,
      replayed: false,
      order: await orderRepository.findByIdForUser(order.id, order.userId),
    };
  }

  if (event.status === 'processing') {
    await recordStripePaymentState(order, event, 'processing');
  } else if (event.status === 'failed') {
    await recordStripePaymentState(order, event, 'failed', {
      from: ['pending_payment', 'payment_failed'],
      to: 'payment_failed',
      metadata: { lastPaymentStatus: 'failed', stripeEventId: event.eventId || null },
    });
    await notifyStripeEvent(
      order,
      event,
      'payment_failed',
      '支付失败',
      `订单 ${order.orderNo} 支付失败，请重新发起支付。`,
    );
  } else if (event.status === 'expired') {
    await recordStripePaymentState(order, event, 'expired', {
      from: ['pending_payment', 'payment_failed'],
      to: 'canceled',
      metadata: { cancelReason: 'stripe_checkout_expired', stripeEventId: event.eventId || null },
    });
    await notifyStripeEvent(
      order,
      event,
      'payment_expired',
      '支付会话已过期',
      `订单 ${order.orderNo} 的支付会话已过期，订单已关闭。`,
    );
  } else if (event.status === 'refunded' || event.status === 'partially_refunded') {
    await recordStripeManualReview(
      order,
      event,
      event.status,
      'Stripe reported a refund; granted benefits require manual reconciliation',
      event.status === 'refunded' ? '退款已记录' : '部分退款已记录',
      `订单 ${order.orderNo} 的退款已记录。相关权益未自动回收，正在人工复核。`,
    );
  } else if (event.status === 'disputed') {
    await recordStripeManualReview(
      order,
      event,
      'disputed',
      'Stripe reported a payment dispute; granted benefits require manual reconciliation',
      '支付争议处理中',
      `订单 ${order.orderNo} 出现支付争议。相关权益未自动变更，正在人工复核。`,
    );
  }

  return {
    provider: 'stripe',
    status: event.status,
    ignored: false,
    manualReview: ['refunded', 'partially_refunded', 'disputed'].includes(event.status),
    order: await orderRepository.findByIdForUser(order.id, order.userId),
  };
}
