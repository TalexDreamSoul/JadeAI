import { and, gte, inArray, lte, min } from 'drizzle-orm';
import { db } from '../index';
import { productEvents } from '../schema';
import type { ProductEventName, ProductEventMetadata } from '@/lib/analytics/product-event';

type ProductEventInsert = {
  eventName: ProductEventName;
  userId: string | null;
  anonymousId: string | null;
  metadata: ProductEventMetadata;
};

export const productEventRepository = {
  async createMany(events: ProductEventInsert[]) {
    if (events.length === 0) return [];
    return db
      .insert(productEvents)
      .values(events.map((event) => ({
        id: crypto.randomUUID(),
        eventName: event.eventName,
        userId: event.userId,
        anonymousId: event.anonymousId,
        metadata: event.metadata,
      })))
      .returning({ id: productEvents.id });
  },

  async listDistinctActorsByEvent(input: {
    eventNames: ProductEventName[];
    since: Date;
    until: Date;
  }) {
    if (input.eventNames.length === 0) return [];
    return db
      .select({
        eventName: productEvents.eventName,
        userId: productEvents.userId,
        anonymousId: productEvents.anonymousId,
        firstOccurredAt: min(productEvents.createdAt),
      })
      .from(productEvents)
      .where(and(
        inArray(productEvents.eventName, input.eventNames),
        gte(productEvents.createdAt, input.since),
        lte(productEvents.createdAt, input.until),
      ))
      .groupBy(productEvents.eventName, productEvents.userId, productEvents.anonymousId);
  },
};
