import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  payExistingOrder,
  payExistingOrderWithMockPayment,
  purchaseProduct,
  purchaseProductWithMockPayment,
  resolveCheckoutUrl,
} from './client-payments';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('client payments', () => {
  it('does not select the mock provider by default and redirects to checkout', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ id: 'order-1' }, 201))
      .mockResolvedValueOnce(jsonResponse({
        provider: 'stripe',
        paymentIntentId: 'pi-1',
        checkoutUrl: 'https://checkout.example.test/session/1',
      }, 201));
    const assign = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', {
      location: {
        href: 'https://jadeai.example/account',
        assign,
      },
    });

    const result = await purchaseProduct({ productId: 'product-1' });

    const intentRequest = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(intentRequest).not.toHaveProperty('provider');
    expect(result.status).toBe('redirected');
    expect(assign).toHaveBeenCalledWith('https://checkout.example.test/session/1');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('confirms only an intent explicitly identified as mock', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        provider: 'mock',
        paymentIntentId: 'mock-pi-1',
        checkoutUrl: null,
      }, 201))
      .mockResolvedValueOnce(jsonResponse({ id: 'order-1', status: 'fulfilled' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await payExistingOrder({ orderId: 'order-1', provider: 'mock' });

    expect(result.status).toBe('completed');
    expect(fetchMock.mock.calls[1][0]).toBe('/api/payments/mock/confirm');
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ provider: 'mock' });
  });

  it('opens hosted checkout in the protected desktop window when available', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      provider: 'stripe',
      paymentIntentId: 'pi-desktop-1',
      checkoutUrl: 'https://checkout.example.test/session/desktop-1',
    }, 201));
    const assign = vi.fn();
    const openCheckout = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', fetchMock);
    vi.stubGlobal('window', {
      jade: { openCheckout },
      location: {
        href: 'https://jadeai.example/account',
        assign,
      },
    });

    const result = await payExistingOrder({ orderId: 'order-desktop-1' });

    expect(result.status).toBe('redirected');
    expect(openCheckout).toHaveBeenCalledWith('https://checkout.example.test/session/desktop-1');
    expect(assign).not.toHaveBeenCalled();
  });

  it('does not report a non-mock intent without checkout as completed', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({
      provider: 'stripe',
      paymentIntentId: 'pi-1',
      checkoutUrl: null,
    }, 201));
    vi.stubGlobal('fetch', fetchMock);

    await expect(payExistingOrder({ orderId: 'order-1' }))
      .rejects.toThrow('支付渠道未返回结算地址');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('accepts secure or same-origin checkout URLs and rejects unsafe URLs', () => {
    expect(resolveCheckoutUrl('/checkout/1', 'http://jadeai.local/account', false))
      .toBe('http://jadeai.local/checkout/1');
    expect(resolveCheckoutUrl('https://pay.example.test/session/1', 'https://jadeai.example/account', false))
      .toBe('https://pay.example.test/session/1');
    expect(resolveCheckoutUrl('http://localhost:4242/session/1', 'http://localhost:3000/account', true))
      .toBe('http://localhost:4242/session/1');

    expect(() => resolveCheckoutUrl('javascript:alert(1)', 'https://jadeai.example/account', true)).toThrow();
    expect(() => resolveCheckoutUrl('data:text/html,test', 'https://jadeai.example/account', true)).toThrow();
    expect(() => resolveCheckoutUrl('http://pay.example.test/session/1', 'https://jadeai.example/account', true)).toThrow();
    expect(() => resolveCheckoutUrl('https://user:pass@pay.example.test/session/1', 'https://jadeai.example/account', true)).toThrow();
  });

  it('keeps the previous exports as compatibility aliases', () => {
    expect(purchaseProductWithMockPayment).toBe(purchaseProduct);
    expect(payExistingOrderWithMockPayment).toBe(payExistingOrder);
  });
});
