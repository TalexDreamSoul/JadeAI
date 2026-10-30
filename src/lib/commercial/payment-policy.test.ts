import { describe, expect, it } from 'vitest';
import {
  MockPaymentDisabledError,
  assertPaymentProviderAllowed,
  getDefaultPaymentProvider,
  isMockPaymentAllowed,
} from './payment-policy';

describe('mock payment policy', () => {
  it('requires an explicit flag outside production', () => {
    expect(isMockPaymentAllowed({ NODE_ENV: 'development', APP_ENV: '', ALLOW_MOCK_PAYMENTS: undefined })).toBe(false);
    expect(isMockPaymentAllowed({ NODE_ENV: 'test', APP_ENV: '', ALLOW_MOCK_PAYMENTS: 'true' })).toBe(true);
  });

  it('cannot be enabled in a production runtime', () => {
    expect(isMockPaymentAllowed({ NODE_ENV: 'production', APP_ENV: '', ALLOW_MOCK_PAYMENTS: 'true' })).toBe(false);
    expect(isMockPaymentAllowed({ NODE_ENV: 'test', APP_ENV: 'production', ALLOW_MOCK_PAYMENTS: 'true' })).toBe(false);
  });

  it('rejects only the mock provider when disabled', () => {
    expect(() => assertPaymentProviderAllowed('mock', {
      NODE_ENV: 'development',
      APP_ENV: '',
      ALLOW_MOCK_PAYMENTS: 'false',
    })).toThrow(MockPaymentDisabledError);
    expect(() => assertPaymentProviderAllowed('stripe', {
      NODE_ENV: 'production',
      APP_ENV: 'production',
      ALLOW_MOCK_PAYMENTS: 'false',
    })).not.toThrow();
  });

  it('uses an explicit default provider', () => {
    expect(getDefaultPaymentProvider({ PAYMENT_PROVIDER: ' stripe ' })).toBe('stripe');
    expect(getDefaultPaymentProvider({})).toBe('mock');
  });
});
