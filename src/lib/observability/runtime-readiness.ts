import { canEncryptSecrets } from '@/lib/security/secret-crypto';

interface RuntimeReadinessEnvironment {
  NODE_ENV?: string;
  AUTH_SECRET?: string;
  DATA_ENCRYPTION_KEY?: string;
}

export function getRuntimeConfigurationIssues(
  env: RuntimeReadinessEnvironment = process.env,
) {
  if (env.NODE_ENV !== 'production') return [];

  const authSecret = env.AUTH_SECRET?.trim() || '';
  const normalizedSecret = authSecret.toLowerCase();
  const isPlaceholder = normalizedSecret.includes('change-me')
    || normalizedSecret.includes('replace-me');
  const issues: string[] = [];
  if (authSecret.length < 32 || isPlaceholder) issues.push('AUTH_SECRET');
  if (!canEncryptSecrets(env.DATA_ENCRYPTION_KEY)) issues.push('DATA_ENCRYPTION_KEY');

  return issues;
}
