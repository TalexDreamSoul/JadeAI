import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  StripeConfigurationError,
  StripePaymentValidationError,
  StripeWebhookVerificationError,
  assertStripeSuccessfulPaymentMatchesOrder,
  createStripeCheckoutSession,
  isStripeLivemodeExpected,
  parseStripeWebhook,
  verifyStripeWebhookSignature,
} from './stripe-payment';

const webhookSecret = 'whsec_test_secret';
const timestamp = 1_700_000_000;

function signature(rawBody: string, at = timestamp) {
  const digest = createHmac('sha256', webhookSecret).update(`${at}.${rawBody}`).digest('hex');
  return `t=${at},v1=${digest}`;
}

function checkoutEvent(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    id: 'evt_checkout',
    type: 'checkout.session.completed',
    livemode: false,
    data: {
      object: {
        id: 'cs_test_123',
        client_reference_id: 'order-123',
        payment_intent: 'pi_test_123',
        payment_status: 'paid',
        amount_total: 9900,
        currency: 'cny',
        metadata: { order_id: 'order-123' },
        ...overrides,
      },
    },
  });
}

describe('Stripe Checkout', () => {
  it('creates a form-encoded Checkout Session bound to the order', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      id: 'cs_test_123',
      url: 'https://checkout.stripe.com/c/pay/cs_test_123',
      amount_total: 9900,
      currency: 'cny',
      status: 'open',
      payment_status: 'unpaid',
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const result = await createStripeCheckoutSession({
      order: { id: 'order-123', orderNo: 'JADE-123', payableCents: 9900, currency: 'CNY' },
    }, {
      env: {
        NODE_ENV: 'test',
        STRIPE_SECRET_KEY: 'sk_test_secret',
        STRIPE_API_BASE_URL: 'http://127.0.0.1:12111/',
        STRIPE_CHECKOUT_SUCCESS_URL: 'https://example.test/account?checkout=success',
        STRIPE_CHECKOUT_CANCEL_URL: 'https://example.test/account?checkout=cancel',
      },
      fetchImpl,
    });

    expect(result.id).toBe('cs_test_123');
    expect(fetchImpl.mock.calls[0][0]).toBe('http://127.0.0.1:12111/v1/checkout/sessions');
    const [, request] = fetchImpl.mock.calls[0];
    const body = request?.body as URLSearchParams;
    expect(body.get('client_reference_id')).toBe('order-123');
    expect(body.get('metadata[order_id]')).toBe('order-123');
    expect(body.get('payment_intent_data[metadata][order_id]')).toBe('order-123');
    expect(body.get('line_items[0][price_data][unit_amount]')).toBe('9900');
    expect(request?.headers).toMatchObject({
      Authorization: 'Bearer sk_test_secret',
      'Idempotency-Key': 'checkout-session:order-123',
    });
  });

  it('requires an HTTPS Stripe API base URL in production', async () => {
    const fetchImpl = vi.fn<typeof fetch>();

    await expect(createStripeCheckoutSession({
      order: { id: 'order-123', orderNo: 'JADE-123', payableCents: 9900, currency: 'CNY' },
    }, {
      env: {
        NODE_ENV: 'production',
        STRIPE_SECRET_KEY: 'sk_live_secret',
        STRIPE_API_BASE_URL: 'http://127.0.0.1:12111',
        STRIPE_CHECKOUT_SUCCESS_URL: 'https://example.test/account?checkout=success',
        STRIPE_CHECKOUT_CANCEL_URL: 'https://example.test/account?checkout=cancel',
      },
      fetchImpl,
    })).rejects.toBeInstanceOf(StripeConfigurationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('Stripe webhook verification and normalization', () => {
  it('rejects an invalid expected livemode value', () => {
    expect(() => isStripeLivemodeExpected({
      STRIPE_EXPECT_LIVEMODE: 'ture',
    })).toThrow(StripeConfigurationError);
  });

  it('accepts a valid signature and rejects stale signatures', () => {
    const rawBody = checkoutEvent();
    expect(verifyStripeWebhookSignature({
      rawBody,
      signatureHeader: signature(rawBody),
      secret: webhookSecret,
      nowSeconds: timestamp,
    })).toBe(timestamp);
    expect(() => verifyStripeWebhookSignature({
      rawBody,
      signatureHeader: signature(rawBody),
      secret: webhookSecret,
      nowSeconds: timestamp + 301,
      toleranceSeconds: 300,
    })).toThrow(StripeWebhookVerificationError);
  });

  it('rejects an invalid signature', () => {
    const rawBody = checkoutEvent();
    expect(() => verifyStripeWebhookSignature({
      rawBody,
      signatureHeader: `t=${timestamp},v1=${'0'.repeat(64)}`,
      secret: webhookSecret,
      nowSeconds: timestamp,
    })).toThrow(StripeWebhookVerificationError);
  });

  it('normalizes paid and expired Checkout events', () => {
    const paidBody = checkoutEvent();
    const paid = parseStripeWebhook({
      rawBody: paidBody,
      signatureHeader: signature(paidBody),
      env: { NODE_ENV: 'test', STRIPE_WEBHOOK_SECRET: webhookSecret },
      nowSeconds: timestamp,
    });
    expect(paid).toMatchObject({
      status: 'succeeded',
      orderId: 'order-123',
      providerTradeNo: 'pi_test_123',
      amountCents: 9900,
      currency: 'cny',
    });

    const expiredBody = JSON.stringify({
      id: 'evt_expired',
      type: 'checkout.session.expired',
      livemode: false,
      data: { object: { id: 'cs_expired', amount_total: 9900, currency: 'cny', metadata: { order_id: 'order-123' } } },
    });
    const expired = parseStripeWebhook({
      rawBody: expiredBody,
      signatureHeader: signature(expiredBody),
      env: { NODE_ENV: 'test', STRIPE_WEBHOOK_SECRET: webhookSecret },
      nowSeconds: timestamp,
    });
    expect(expired).toMatchObject({ status: 'expired', orderId: 'order-123', providerTradeNo: 'cs_expired' });
  });

  it('rejects a signed successful event with a tampered amount', () => {
    const rawBody = checkoutEvent({ amount_total: 1 });
    const event = parseStripeWebhook({
      rawBody,
      signatureHeader: signature(rawBody),
      env: { NODE_ENV: 'test', STRIPE_WEBHOOK_SECRET: webhookSecret },
      nowSeconds: timestamp,
    });
    expect(() => assertStripeSuccessfulPaymentMatchesOrder(event, {
      id: 'order-123',
      orderNo: 'JADE-123',
      payableCents: 9900,
      currency: 'CNY',
    })).toThrow(StripePaymentValidationError);
  });
});
