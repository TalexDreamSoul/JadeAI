import type { Instrumentation } from 'next';
import { logEvent } from '@/lib/observability/logger';

export function register() {
  logEvent('info', 'application_started', {
    runtime: process.env.NEXT_RUNTIME || 'nodejs',
  });
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  logEvent('error', 'request_failed', {
    error,
    method: request.method,
    path: request.path,
    route: context.routePath,
    routeType: context.routeType,
  });
};
