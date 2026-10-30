type LogLevel = 'info' | 'warn' | 'error';

const sensitiveKeyPattern = /authorization|cookie|password|secret|token|api[-_]?key/i;

function sanitize(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[truncated]';
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (Array.isArray(value)) return value.map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      sensitiveKeyPattern.test(key) ? '[redacted]' : sanitize(item, depth + 1),
    ]),
  );
}

export function logEvent(level: LogLevel, event: string, context: Record<string, unknown> = {}) {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    service: 'jadeai',
    version: process.env.APP_VERSION || process.env.NEXT_PUBLIC_APP_VERSION || null,
    commit: process.env.GIT_SHA || process.env.NEXT_PUBLIC_GIT_SHA || null,
    ...sanitize(context) as Record<string, unknown>,
  });

  if (level === 'error') console.error(payload);
  else if (level === 'warn') console.warn(payload);
  else console.info(payload);
}
