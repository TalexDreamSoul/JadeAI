import { createHmac, timingSafeEqual } from 'node:crypto';

type JsonRecord = Record<string, unknown>;
type StripeEnvironment = Record<string, string | undefined>;

export type StripeWebhookStatus =
  | 'succeeded'
  | 'processing'
  | 'failed'
  | 'expired'
  | 'refunded'
  | 'partially_refunded'
  | 'disputed'
  | 'ignored';

export type StripePaymentWebhookEvent = {
  eventId: string;
  eventType: string;
  livemode: boolean;
  status: StripeWebhookStatus;
  orderId?: string;
  providerTradeNo?: string;
  paymentIntentId?: string;
  amountCents?: number;
  currency?: string;
  rawPayload: JsonRecord;
};

export type StripeOrderSnapshot = {
  id: string;
  orderNo: string;
  payableCents: number;
  currency: string;
};

export class StripeConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeConfigurationError';
  }
}

export class StripeApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeApiError';
  }
}

export class StripeWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeWebhookVerificationError';
  }
}

export class StripeWebhookPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeWebhookPayloadError';
  }
}

export class StripePaymentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripePaymentValidationError';
  }
}

function record(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function integerValue(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : undefined;
}

function expandableId(value: unknown): string | undefined {
  return typeof value === 'string' ? stringValue(value) : stringValue(record(value).id);
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function requiredEnvironmentValue(env: StripeEnvironment, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new StripeConfigurationError(`${key} is required`);
  return value;
}

function isProductionEnvironment(env: StripeEnvironment): boolean {
  return env.NODE_ENV === 'production' || env.APP_ENV === 'production';
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === '127.0.0.1'
    || hostname === '[::1]';
}

function stripeApiBaseUrl(env: StripeEnvironment): string {
  const raw = (env.STRIPE_API_BASE_URL || 'https://api.stripe.com').trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new StripeConfigurationError('STRIPE_API_BASE_URL must be an absolute URL');
  }

  const loopbackHttp = !isProductionEnvironment(env)
    && url.protocol === 'http:'
    && isLoopbackHostname(url.hostname);
  if ((url.protocol !== 'https:' && !loopbackHttp) || url.username || url.password || url.search || url.hash) {
    throw new StripeConfigurationError(
      'STRIPE_API_BASE_URL must use HTTPS without credentials, query, or fragment; test environments may use loopback HTTP',
    );
  }
  return url.toString().replace(/\/+$/, '');
}

function checkoutRedirectUrl(env: StripeEnvironment, key: string): string {
  const raw = requiredEnvironmentValue(env, key);
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new StripeConfigurationError(`${key} must be an absolute URL`);
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    throw new StripeConfigurationError(`${key} must be a public HTTP(S) URL without credentials`);
  }
  if (isProductionEnvironment(env) && url.protocol !== 'https:') {
    throw new StripeConfigurationError(`${key} must use HTTPS in production`);
  }
  return url.toString();
}

export function isStripeLivemodeExpected(env: StripeEnvironment = process.env): boolean {
  const configured = env.STRIPE_EXPECT_LIVEMODE?.trim().toLowerCase();
  if (configured) {
    if (configured !== 'true' && configured !== 'false') {
      throw new StripeConfigurationError('STRIPE_EXPECT_LIVEMODE must be true or false');
    }
    return configured === 'true';
  }
  return isProductionEnvironment(env);
}

export function assertStripeWebhookMode(
  event: Pick<StripePaymentWebhookEvent, 'livemode'>,
  env: StripeEnvironment = process.env,
): void {
  if (event.livemode !== isStripeLivemodeExpected(env)) {
    throw new StripePaymentValidationError('Stripe webhook livemode does not match this environment');
  }
}

export async function createStripeCheckoutSession(
  input: { order: StripeOrderSnapshot },
  options: { env?: StripeEnvironment; fetchImpl?: typeof fetch } = {},
) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || fetch;
  const secretKey = requiredEnvironmentValue(env, 'STRIPE_SECRET_KEY');
  const apiBaseUrl = stripeApiBaseUrl(env);
  const successUrl = checkoutRedirectUrl(env, 'STRIPE_CHECKOUT_SUCCESS_URL');
  const cancelUrl = checkoutRedirectUrl(env, 'STRIPE_CHECKOUT_CANCEL_URL');
  const amountCents = Number(input.order.payableCents);
  const currency = input.order.currency.trim().toLowerCase();

  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new StripeConfigurationError('Stripe Checkout requires a positive integer order amount');
  }
  if (!/^[a-z]{3}$/.test(currency)) {
    throw new StripeConfigurationError('Stripe Checkout requires a three-letter currency code');
  }

  const body = new URLSearchParams({
    mode: 'payment',
    success_url: successUrl,
    cancel_url: cancelUrl,
    client_reference_id: input.order.id,
    'metadata[order_id]': input.order.id,
    'payment_intent_data[metadata][order_id]': input.order.id,
    'line_items[0][price_data][currency]': currency,
    'line_items[0][price_data][unit_amount]': String(amountCents),
    'line_items[0][price_data][product_data][name]': `JadeAI Order ${input.order.orderNo}`,
    'line_items[0][quantity]': '1',
  });

  const response = await fetchImpl(`${apiBaseUrl}/v1/checkout/sessions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': `checkout-session:${input.order.id}`,
    },
    body,
    signal: AbortSignal.timeout(positiveInteger(env.STRIPE_API_TIMEOUT_MS, 10_000)),
  });
  const payload = record(await response.json().catch(() => ({})));
  if (!response.ok) {
    const message = stringValue(record(payload.error).message) || `HTTP ${response.status}`;
    throw new StripeApiError(`Stripe Checkout request failed: ${message}`);
  }

  const id = stringValue(payload.id);
  const checkoutUrl = stringValue(payload.url);
  const returnedAmount = integerValue(payload.amount_total);
  const returnedCurrency = stringValue(payload.currency)?.toLowerCase();
  if (!id || !checkoutUrl) throw new StripeApiError('Stripe Checkout response is missing id or url');
  if (returnedAmount !== amountCents || returnedCurrency !== currency) {
    throw new StripeApiError('Stripe Checkout response amount or currency does not match the order');
  }

  return {
    id,
    url: checkoutUrl,
    amountTotal: returnedAmount,
    currency: returnedCurrency,
    status: stringValue(payload.status) || 'open',
    paymentStatus: stringValue(payload.payment_status) || 'unpaid',
  };
}

export function verifyStripeWebhookSignature(input: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  secret: string;
  nowSeconds?: number;
  toleranceSeconds?: number;
}): number {
  if (!input.secret) throw new StripeConfigurationError('STRIPE_WEBHOOK_SECRET is required');
  if (!input.signatureHeader) throw new StripeWebhookVerificationError('Stripe-Signature header is required');

  const values = input.signatureHeader.split(',').map((part) => part.trim().split('=', 2));
  const timestampRaw = values.find(([key]) => key === 't')?.[1];
  const signatures = values
    .filter(([key]) => key === 'v1')
    .map(([, value]) => value)
    .filter((value): value is string => Boolean(value && /^[a-f0-9]{64}$/i.test(value)));
  const timestamp = Number(timestampRaw);
  if (!Number.isSafeInteger(timestamp) || timestamp <= 0 || signatures.length === 0) {
    throw new StripeWebhookVerificationError('Stripe-Signature header is malformed');
  }

  const nowSeconds = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const toleranceSeconds = input.toleranceSeconds ?? 300;
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) {
    throw new StripeWebhookVerificationError('Stripe webhook timestamp is outside the allowed tolerance');
  }

  const expected = createHmac('sha256', input.secret)
    .update(`${timestamp}.${input.rawBody}`, 'utf8')
    .digest();
  const valid = signatures.some((signature) => {
    const actual = Buffer.from(signature, 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  });
  if (!valid) throw new StripeWebhookVerificationError('Stripe webhook signature is invalid');
  return timestamp;
}

export function parseStripeWebhook(input: {
  rawBody: string;
  signatureHeader: string | null | undefined;
  env?: StripeEnvironment;
  nowSeconds?: number;
}): StripePaymentWebhookEvent {
  const env = input.env || process.env;
  verifyStripeWebhookSignature({
    rawBody: input.rawBody,
    signatureHeader: input.signatureHeader,
    secret: requiredEnvironmentValue(env, 'STRIPE_WEBHOOK_SECRET'),
    nowSeconds: input.nowSeconds,
    toleranceSeconds: positiveInteger(env.STRIPE_WEBHOOK_TOLERANCE_SECONDS, 300),
  });

  let payload: JsonRecord;
  try {
    payload = record(JSON.parse(input.rawBody));
  } catch {
    throw new StripeWebhookPayloadError('Stripe webhook body is not valid JSON');
  }

  const eventId = stringValue(payload.id);
  const eventType = stringValue(payload.type);
  const object = record(record(payload.data).object);
  const objectId = stringValue(object.id);
  if (!eventId || !eventType || !objectId) {
    throw new StripeWebhookPayloadError('Stripe webhook is missing event or object identifiers');
  }

  const metadata = record(object.metadata);
  const orderId = stringValue(metadata.order_id)
    || stringValue(metadata.orderId)
    || stringValue(object.client_reference_id);
  const paymentIntentId = expandableId(object.payment_intent);
  let status: StripeWebhookStatus = 'ignored';
  let providerTradeNo = paymentIntentId || objectId;
  let amountCents = integerValue(object.amount_total)
    ?? integerValue(object.amount)
    ?? integerValue(object.amount_received);
  const currency = stringValue(object.currency)?.toLowerCase();

  if (eventType === 'checkout.session.completed') {
    status = object.payment_status === 'paid' ? 'succeeded' : 'processing';
  } else if (eventType === 'checkout.session.async_payment_succeeded') {
    status = object.payment_status === 'paid' ? 'succeeded' : 'processing';
  } else if (eventType === 'checkout.session.async_payment_failed' || eventType === 'payment_intent.payment_failed') {
    status = 'failed';
  } else if (eventType === 'checkout.session.expired') {
    status = 'expired';
    providerTradeNo = objectId;
  } else if (eventType === 'charge.refunded') {
    const amount = integerValue(object.amount);
    const amountRefunded = integerValue(object.amount_refunded);
    status = amount !== undefined && amountRefunded !== undefined && amountRefunded < amount
      ? 'partially_refunded'
      : 'refunded';
    amountCents = amountRefunded ?? amount;
  } else if (eventType.startsWith('charge.dispute.')) {
    status = 'disputed';
  }

  const event = {
    eventId,
    eventType,
    livemode: payload.livemode === true,
    status,
    orderId,
    providerTradeNo,
    paymentIntentId,
    amountCents,
    currency,
    rawPayload: {
      eventId,
      eventType,
      objectId,
      livemode: payload.livemode === true,
      orderId: orderId || null,
      paymentIntentId: paymentIntentId || null,
      paymentStatus: stringValue(object.payment_status) || null,
      objectStatus: stringValue(object.status) || null,
      amountCents: amountCents ?? null,
      currency: currency || null,
      failureCode: stringValue(record(object.last_payment_error).code) || null,
      disputeReason: stringValue(object.reason) || null,
    },
  } satisfies StripePaymentWebhookEvent;
  assertStripeWebhookMode(event, env);
  return event;
}

export function assertStripeSuccessfulPaymentMatchesOrder(
  event: StripePaymentWebhookEvent,
  order: StripeOrderSnapshot,
): void {
  if (event.status !== 'succeeded') {
    throw new StripePaymentValidationError('Stripe event is not a successful payment');
  }
  if (!event.orderId || event.orderId !== order.id) {
    throw new StripePaymentValidationError('Stripe orderId does not match the order');
  }
  if (!event.paymentIntentId || event.providerTradeNo !== event.paymentIntentId) {
    throw new StripePaymentValidationError('Stripe payment_intent is required');
  }
  if (event.amountCents !== Number(order.payableCents)) {
    throw new StripePaymentValidationError('Stripe amount_total does not match the order');
  }
  if (!event.currency || event.currency.toUpperCase() !== order.currency.toUpperCase()) {
    throw new StripePaymentValidationError('Stripe currency does not match the order');
  }
}
