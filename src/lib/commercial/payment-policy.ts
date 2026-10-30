type PaymentPolicyEnvironment = Partial<Record<
  'NODE_ENV' | 'APP_ENV' | 'ALLOW_MOCK_PAYMENTS' | 'PAYMENT_PROVIDER',
  string
>>;

export class MockPaymentDisabledError extends Error {
  constructor() {
    super('Mock payments are disabled');
    this.name = 'MockPaymentDisabledError';
  }
}

export function isMockPaymentAllowed(env: PaymentPolicyEnvironment = process.env): boolean {
  const isProduction = env.NODE_ENV === 'production' || env.APP_ENV === 'production';
  return !isProduction && env.ALLOW_MOCK_PAYMENTS === 'true';
}

export function assertPaymentProviderAllowed(
  provider: string,
  env: PaymentPolicyEnvironment = process.env,
): void {
  if (provider === 'mock' && !isMockPaymentAllowed(env)) {
    throw new MockPaymentDisabledError();
  }
}

export function getDefaultPaymentProvider(env: PaymentPolicyEnvironment = process.env): string {
  return env.PAYMENT_PROVIDER?.trim() || 'mock';
}
