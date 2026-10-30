import { NextRequest, NextResponse } from 'next/server';
import {
  ProductEventValidationError,
  parseProductEventBatch,
  productEventRateLimiter,
} from '@/lib/analytics/product-event';
import {
  persistProductEvents,
  resolveProductEventActor,
} from '@/lib/analytics/product-event-service';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 32 * 1024;

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'Event payload is too large' }, { status: 413 });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const events = parseProductEventBatch(payload);
    const actor = await resolveProductEventActor(request);
    if (!actor) {
      return NextResponse.json({ error: 'User session or fingerprint is required' }, { status: 400 });
    }

    const rateLimit = productEventRateLimiter.consume(actor.rateLimitKey, events.length);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Event rate limit exceeded', retryAfterSeconds: rateLimit.retryAfterSeconds },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    await persistProductEvents(actor, events);
    return NextResponse.json({ accepted: events.length }, { status: 202 });
  } catch (error) {
    if (error instanceof ProductEventValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error('POST /api/events error:', error);
    return NextResponse.json({ error: 'Event ingestion failed' }, { status: 500 });
  }
}
