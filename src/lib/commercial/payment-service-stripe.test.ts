import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fulfillOrder: vi.fn(),
  markCommercialOrderPaid: vi.fn(),
  findById: vi.fn(),
  findByIdForUser: vi.fn(),
  findPaymentByProviderTradeNo: vi.fn(),
  recordPaymentState: vi.fn(),
  createOnce: vi.fn(),
}));

vi.mock('./billing-service', () => ({
  fulfillOrder: mocks.fulfillOrder,
  markCommercialOrderPaid: mocks.markCommercialOrderPaid,
}));
vi.mock('@/lib/db/repositories/commercial.repository', () => ({
  orderRepository: {
    findById: mocks.findById,
    findByIdForUser: mocks.findByIdForUser,
    findPaymentByProviderTradeNo: mocks.findPaymentByProviderTradeNo,
    recordPaymentState: mocks.recordPaymentState,
  },
  notificationStoreRepository: {
    createOnce: mocks.createOnce,
  },
}));

import {
  PaymentWebhookRequestError,
  StripeClientConfirmationDisabledError,
  confirmCommercialPayment,
  handleCommercialPaymentWebhook,
} from './payment-service';

const webhookSecret = 'whsec_service_test';

type TestOrder = {
  id: string;
  userId: string;
  orderNo: string;
  status: string;
  payableCents: number;
  currency: string;
};

type TestPayment = {
  orderId: string;
  status: string;
  providerTradeNo: string;
};

let order: TestOrder;
let payment: TestPayment | null;

function stripeRequest(type: string, object: Record<string, unknown>, eventId: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const rawBody = JSON.stringify({ id: eventId, type, livemode: false, data: { object } });
  const digest = createHmac('sha256', webhookSecret).update(`${timestamp}.${rawBody}`).digest('hex');
  return {
    provider: 'stripe',
    rawBody,
    headers: { 'stripe-signature': `t=${timestamp},v1=${digest}` },
  };
}

function paidCheckout(amount = 9900) {
  return stripeRequest('checkout.session.completed', {
    id: 'cs_test_123',
    client_reference_id: order.id,
    payment_intent: 'pi_test_123',
    payment_status: 'paid',
    amount_total: amount,
    currency: 'cny',
    metadata: { order_id: order.id },
  }, 'evt_paid');
}

beforeEach(() => {
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', webhookSecret);
  vi.stubEnv('STRIPE_EXPECT_LIVEMODE', 'false');
  order = {
    id: 'order-123',
    userId: 'user-123',
    orderNo: 'JADE-123',
    status: 'pending_payment',
    payableCents: 9900,
    currency: 'CNY',
  };
  payment = null;

  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.findById.mockImplementation(async (id: string) => id === order.id ? { ...order } : null);
  mocks.findByIdForUser.mockImplementation(async (id: string, userId: string) => (
    id === order.id && userId === order.userId ? { ...order, payments: payment ? [{ ...payment }] : [] } : null
  ));
  mocks.findPaymentByProviderTradeNo.mockImplementation(async (_provider: string, tradeNo: string) => (
    payment?.providerTradeNo === tradeNo ? { ...payment } : null
  ));
  mocks.recordPaymentState.mockImplementation(async (_orderId: string, input: {
    providerTradeNo: string;
    status: string;
    orderTransition?: { from: string[]; to: string };
  }) => {
    payment = { orderId: order.id, status: input.status, providerTradeNo: input.providerTradeNo };
    if (input.orderTransition?.from.includes(order.status)) order.status = input.orderTransition.to;
    return { ...order };
  });
  mocks.markCommercialOrderPaid.mockImplementation(async (input: { providerTradeNo?: string }) => {
    payment = {
      orderId: order.id,
      status: 'succeeded',
      providerTradeNo: input.providerTradeNo || '',
    };
    order.status = 'fulfilled';
  });
  mocks.createOnce.mockResolvedValue({ id: 'notification-id', created: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Stripe payment service webhook state machine', () => {
  it('does not allow a client to confirm Stripe payment', async () => {
    await expect(confirmCommercialPayment({
      userId: order.userId,
      orderId: order.id,
      provider: 'stripe',
    })).rejects.toBeInstanceOf(StripeClientConfirmationDisabledError);
    expect(mocks.markCommercialOrderPaid).not.toHaveBeenCalled();
  });

  it('fulfills a signed payment once and treats replay as idempotent', async () => {
    const request = paidCheckout();
    const first = await handleCommercialPaymentWebhook(request);
    const replay = await handleCommercialPaymentWebhook(request);

    expect(first).toMatchObject({ status: 'succeeded', replayed: false });
    expect(replay).toMatchObject({ status: 'succeeded', replayed: true });
    expect(mocks.markCommercialOrderPaid).toHaveBeenCalledTimes(1);
  });

  it('routes a second successful payment to manual review when it already has a pending record', async () => {
    order.status = 'fulfilled';
    payment = { orderId: order.id, status: 'processing', providerTradeNo: 'pi_test_123' };

    const result = await handleCommercialPaymentWebhook(paidCheckout());

    expect(result).toMatchObject({ status: 'duplicate_succeeded', manualReview: true });
    expect(mocks.recordPaymentState).toHaveBeenCalledWith(order.id, expect.objectContaining({
      status: 'duplicate_succeeded',
      orderTransition: expect.objectContaining({ to: 'manual_review' }),
    }));
    expect(order.status).toBe('manual_review');
    expect(mocks.markCommercialOrderPaid).not.toHaveBeenCalled();
  });

  it('records an expired Checkout Session and closes the order', async () => {
    const result = await handleCommercialPaymentWebhook(stripeRequest('checkout.session.expired', {
      id: 'cs_expired',
      amount_total: 9900,
      currency: 'cny',
      metadata: { order_id: order.id },
    }, 'evt_expired'));

    expect(result).toMatchObject({ status: 'expired' });
    expect(mocks.recordPaymentState).toHaveBeenCalledWith(order.id, expect.objectContaining({
      status: 'expired',
      orderTransition: expect.objectContaining({ to: 'canceled' }),
    }));
    expect(order.status).toBe('canceled');
    expect(mocks.createOnce).toHaveBeenCalledTimes(1);
  });

  it('places a signed amount mismatch into manual review without fulfillment', async () => {
    await expect(handleCommercialPaymentWebhook(paidCheckout(1)))
      .rejects.toBeInstanceOf(PaymentWebhookRequestError);

    expect(mocks.recordPaymentState).toHaveBeenCalledWith(order.id, expect.objectContaining({
      status: 'validation_failed',
      orderTransition: expect.objectContaining({ to: 'manual_review' }),
    }));
    expect(order.status).toBe('manual_review');
    expect(mocks.markCommercialOrderPaid).not.toHaveBeenCalled();
  });

  it.each([
    ['charge.refunded', 'refunded', {
      id: 'ch_test_123',
      payment_intent: 'pi_test_123',
      amount: 9900,
      amount_refunded: 9900,
      currency: 'cny',
    }],
    ['charge.dispute.created', 'disputed', {
      id: 'dp_test_123',
      payment_intent: 'pi_test_123',
      amount: 9900,
      currency: 'cny',
      reason: 'fraudulent',
    }],
  ])('records %s as %s and requires manual review', async (eventType, expectedStatus, object) => {
    order.status = 'fulfilled';
    payment = { orderId: order.id, status: 'succeeded', providerTradeNo: 'pi_test_123' };

    const result = await handleCommercialPaymentWebhook(stripeRequest(eventType, object, `evt_${expectedStatus}`));

    expect(result).toMatchObject({ status: expectedStatus, manualReview: true });
    expect(mocks.recordPaymentState).toHaveBeenCalledWith(order.id, expect.objectContaining({
      status: expectedStatus,
      orderTransition: expect.objectContaining({ to: 'manual_review' }),
    }));
    expect(order.status).toBe('manual_review');
  });
});
