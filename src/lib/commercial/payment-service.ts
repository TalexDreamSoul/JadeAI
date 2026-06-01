import { fulfillOrder, markCommercialOrderPaid } from './billing-service';
import { orderRepository } from '@/lib/db/repositories/commercial.repository';

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
  orderId: string;
  status: string;
  providerTradeNo?: string;
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

const adapters = new Map<PaymentProvider, PaymentAdapter>([
  [mockPaymentAdapter.provider, mockPaymentAdapter],
]);

function getPaymentAdapter(provider: PaymentProvider) {
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
  const provider = input.provider || 'mock';
  const order = await orderRepository.findByIdForUser(input.orderId, input.userId);
  if (!order) throw new Error('Order not found');
  if (order.status === 'canceled') throw new Error('Order is canceled');
  if (order.status === 'paid' || order.status === 'fulfilling' || order.status === 'fulfilled') throw new Error('Order is already paid');

  const adapter = getPaymentAdapter(provider);
  return adapter.createIntent({
    ...input,
    provider,
    order,
  });
}

export async function confirmCommercialPayment(input: PaymentConfirmInput) {
  const provider = input.provider || 'mock';
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
  const provider = input.provider || 'mock';
  const adapter = getPaymentAdapter(provider);
  const event = await adapter.parseWebhook({ ...input, provider });

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
