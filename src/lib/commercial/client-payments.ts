type PurchaseProductInput = {
  productId: string;
  headers?: HeadersInit;
  provider?: string;
  quantity?: number;
  returnUrl?: string;
  clientContext?: Record<string, unknown>;
};

type PayExistingOrderInput = {
  orderId: string;
  headers?: HeadersInit;
  provider?: string;
  returnUrl?: string;
  clientContext?: Record<string, unknown>;
};

type PaymentIntent = {
  provider?: unknown;
  checkoutUrl?: unknown;
  paymentIntentId?: unknown;
  [key: string]: unknown;
};

export type ClientPaymentResult =
  | {
      status: 'completed';
      intent: PaymentIntent;
      confirmation: unknown;
    }
  | {
      status: 'redirected';
      intent: PaymentIntent;
      checkoutUrl: string;
    };

function normalizeHeaders(headers?: HeadersInit): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

async function readPaymentError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null);
  if (payload && typeof payload === 'object' && 'error' in payload) {
    return String(payload.error || fallback);
  }
  return fallback;
}

function isLocalHostname(hostname: string) {
  return hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname === '127.0.0.1'
    || hostname === '[::1]';
}

export function resolveCheckoutUrl(
  checkoutUrl: string,
  currentUrl: string,
  isDevelopment = process.env.NODE_ENV !== 'production',
) {
  const value = checkoutUrl.trim();
  if (!value) throw new Error('支付渠道未返回有效的结算地址');

  let base: URL;
  let target: URL;
  try {
    base = new URL(currentUrl);
    target = new URL(value, base);
  } catch {
    throw new Error('支付渠道返回了无效的结算地址');
  }

  if (target.username || target.password) {
    throw new Error('支付渠道返回的结算地址包含不安全的凭据');
  }

  const hasExplicitOrigin = /^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value) || value.startsWith('//');
  const isSameOriginRelative = !hasExplicitOrigin && target.origin === base.origin;
  const isSecure = target.protocol === 'https:';
  const isDevelopmentHttp = isDevelopment
    && target.protocol === 'http:'
    && (target.origin === base.origin || isLocalHostname(target.hostname));

  if (!isSecure && !isSameOriginRelative && !isDevelopmentHttp) {
    throw new Error('支付渠道返回了不安全的结算地址');
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    throw new Error('支付渠道返回了不支持的结算地址');
  }

  return target.href;
}

export async function purchaseProduct(input: PurchaseProductInput) {
  const headers = {
    ...normalizeHeaders(input.headers),
    'Content-Type': 'application/json',
  };

  const orderRes = await fetch('/api/orders', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      items: [{ productId: input.productId, quantity: input.quantity || 1 }],
    }),
  });
  if (!orderRes.ok) throw new Error(await readPaymentError(orderRes, '创建订单失败'));
  const order = await orderRes.json();

  const payment = await payExistingOrder({
    orderId: order.id,
    headers,
    provider: input.provider,
    returnUrl: input.returnUrl,
    clientContext: input.clientContext,
  });

  return {
    order,
    ...payment,
  };
}

export async function payExistingOrder(input: PayExistingOrderInput): Promise<ClientPaymentResult> {
  const headers = {
    ...normalizeHeaders(input.headers),
    'Content-Type': 'application/json',
  };
  const provider = input.provider?.trim();

  const intentRes = await fetch('/api/payments/intent', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      orderId: input.orderId,
      ...(provider ? { provider } : {}),
      returnUrl: input.returnUrl,
      clientContext: input.clientContext || {},
    }),
  });
  if (!intentRes.ok) throw new Error(await readPaymentError(intentRes, '创建支付单失败'));
  const intent = await intentRes.json() as PaymentIntent;

  if (typeof intent.checkoutUrl === 'string' && intent.checkoutUrl.trim()) {
    if (typeof window === 'undefined') throw new Error('当前环境无法打开支付结算页');
    const checkoutUrl = resolveCheckoutUrl(intent.checkoutUrl, window.location.href);
    if (window.jade?.openCheckout) {
      await window.jade.openCheckout(checkoutUrl);
    } else {
      window.location.assign(checkoutUrl);
    }
    return { status: 'redirected', intent, checkoutUrl };
  }

  if (intent.provider !== 'mock') {
    throw new Error('支付渠道未返回结算地址，请稍后重试');
  }

  const payRes = await fetch('/api/payments/mock/confirm', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      orderId: input.orderId,
      paymentIntentId: intent.paymentIntentId,
    }),
  });
  if (!payRes.ok) throw new Error(await readPaymentError(payRes, '支付确认失败'));

  return {
    status: 'completed',
    intent,
    confirmation: await payRes.json(),
  };
}

export const purchaseProductWithMockPayment = purchaseProduct;
export const payExistingOrderWithMockPayment = payExistingOrder;
