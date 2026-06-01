import { addLanguageModelUsages } from '@/lib/ai/generate-json';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const usage = addLanguageModelUsages(
  {
    inputTokens: 100,
    inputTokenDetails: {
      noCacheTokens: 80,
      cacheReadTokens: 15,
      cacheWriteTokens: 5,
    },
    outputTokens: 30,
    outputTokenDetails: {
      textTokens: 20,
      reasoningTokens: 10,
    },
    totalTokens: 130,
    reasoningTokens: 10,
    cachedInputTokens: 15,
  },
  {
    inputTokens: 40,
    inputTokenDetails: {
      noCacheTokens: 35,
      cacheReadTokens: 5,
      cacheWriteTokens: undefined,
    },
    outputTokens: 12,
    outputTokenDetails: {
      textTokens: 12,
      reasoningTokens: undefined,
    },
    totalTokens: 52,
    cachedInputTokens: 5,
  },
);

assert(usage?.inputTokens === 140, `expected inputTokens=140, got ${usage?.inputTokens}`);
assert(usage?.outputTokens === 42, `expected outputTokens=42, got ${usage?.outputTokens}`);
assert(usage?.totalTokens === 182, `expected totalTokens=182, got ${usage?.totalTokens}`);
assert(usage?.inputTokenDetails.noCacheTokens === 115, `expected noCacheTokens=115, got ${usage?.inputTokenDetails.noCacheTokens}`);
assert(usage?.inputTokenDetails.cacheReadTokens === 20, `expected cacheReadTokens=20, got ${usage?.inputTokenDetails.cacheReadTokens}`);
assert(usage?.inputTokenDetails.cacheWriteTokens === 5, `expected cacheWriteTokens=5, got ${usage?.inputTokenDetails.cacheWriteTokens}`);
assert(usage?.outputTokenDetails.textTokens === 32, `expected textTokens=32, got ${usage?.outputTokenDetails.textTokens}`);
assert(usage?.outputTokenDetails.reasoningTokens === 10, `expected reasoningTokens=10, got ${usage?.outputTokenDetails.reasoningTokens}`);
assert(usage?.reasoningTokens === 10, `expected deprecated reasoningTokens=10, got ${usage?.reasoningTokens}`);
assert(usage?.cachedInputTokens === 20, `expected deprecated cachedInputTokens=20, got ${usage?.cachedInputTokens}`);

console.log('[smoke] ai json usage aggregation passed');
