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

export async function purchaseProductWithMockPayment(input: PurchaseProductInput) {
  const provider = input.provider || 'mock';
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

  const payment = await payExistingOrderWithMockPayment({
    orderId: order.id,
    headers,
    provider,
    returnUrl: input.returnUrl,
    clientContext: input.clientContext,
  });

  return {
    order,
    ...payment,
  };
}

export async function payExistingOrderWithMockPayment(input: PayExistingOrderInput) {
  const provider = input.provider || 'mock';
  const headers = {
    ...normalizeHeaders(input.headers),
    'Content-Type': 'application/json',
  };

  const intentRes = await fetch('/api/payments/intent', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      orderId: input.orderId,
      provider,
      returnUrl: input.returnUrl,
      clientContext: input.clientContext || {},
    }),
  });
  if (!intentRes.ok) throw new Error(await readPaymentError(intentRes, '创建支付单失败'));
  const intent = await intentRes.json();

  const payRes = await fetch('/api/payments/confirm', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      orderId: input.orderId,
      provider,
      paymentIntentId: intent.paymentIntentId,
    }),
  });
  if (!payRes.ok) throw new Error(await readPaymentError(payRes, '支付确认失败'));

  return {
    intent,
    confirmation: await payRes.json(),
  };
}
