import { getUserIdFromRequest, resolveUser } from '@/lib/auth/helpers';
import { productEventRepository } from '@/lib/db/repositories/product-event.repository';
import {
  PRODUCT_EVENT_NAMES,
  ProductEventValidationError,
  hashAnonymousFingerprint,
  normalizeProductEventFingerprint,
  parseProductEvent,
  type ParsedProductEvent,
  type ProductEventMetadata,
  type ProductEventName,
} from './product-event';
import { buildProductFunnels } from './product-funnel';

export type ProductEventActor = {
  userId: string | null;
  anonymousId: string | null;
  rateLimitKey: string;
};

export async function resolveProductEventActor(request: Request): Promise<ProductEventActor | null> {
  const fingerprint = normalizeProductEventFingerprint(getUserIdFromRequest(request));
  const user = await resolveUser(fingerprint);
  if (user) {
    return { userId: user.id, anonymousId: null, rateLimitKey: `user:${user.id}` };
  }
  if (!fingerprint) return null;
  const anonymousId = hashAnonymousFingerprint(fingerprint);
  return { userId: null, anonymousId, rateLimitKey: `anonymous:${anonymousId}` };
}

export async function persistProductEvents(actor: ProductEventActor, events: ParsedProductEvent[]) {
  return productEventRepository.createMany(events.map((event) => ({
    eventName: event.eventName,
    userId: actor.userId,
    anonymousId: actor.anonymousId,
    metadata: event.metadata,
  })));
}

export async function recordProductEventSafely(input: {
  eventName: ProductEventName;
  userId?: string | null;
  fingerprint?: string | null;
  metadata?: ProductEventMetadata;
}) {
  try {
    const fingerprint = input.userId ? null : normalizeProductEventFingerprint(input.fingerprint);
    const anonymousId = fingerprint ? hashAnonymousFingerprint(fingerprint) : null;
    if (!input.userId && !anonymousId) return null;
    const event = parseProductEvent({ eventName: input.eventName, metadata: input.metadata || {} });
    const rows = await productEventRepository.createMany([{
      eventName: event.eventName,
      userId: input.userId || null,
      anonymousId,
      metadata: event.metadata,
    }]);
    return rows[0] || null;
  } catch (error) {
    const message = error instanceof ProductEventValidationError ? error.message : 'storage failed';
    console.warn(`[product-events] ${input.eventName} was not recorded: ${message}`);
    return null;
  }
}

export async function getProductFunnel(days: 7 | 30, now = new Date()) {
  const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1_000);
  const rows = await productEventRepository.listDistinctActorsByEvent({
    eventNames: [...PRODUCT_EVENT_NAMES],
    since,
    until: now,
  });
  return {
    days,
    since: since.toISOString(),
    until: now.toISOString(),
    ...buildProductFunnels(rows),
  };
}
