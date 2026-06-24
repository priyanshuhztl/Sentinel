import type { RequestRecord } from './types';

interface PricingTier {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
}

export function getPricing(model: string): PricingTier {
  if (/haiku/i.test(model)) {
    return { input: 0.80, output: 4.00, cacheCreation: 1.00, cacheRead: 0.08 };
  }
  if (/opus/i.test(model)) {
    return { input: 15.00, output: 75.00, cacheCreation: 18.75, cacheRead: 1.50 };
  }
  // Sonnet default
  return { input: 3.00, output: 15.00, cacheCreation: 3.75, cacheRead: 0.30 };
}

export function calcCost(
  r: Pick<RequestRecord, 'model' | 'inputTokens' | 'outputTokens' | 'cacheCreationTokens' | 'cacheReadTokens'>
): number {
  const p = getPricing(r.model);
  return (
    r.inputTokens * p.input +
    r.outputTokens * p.output +
    r.cacheCreationTokens * p.cacheCreation +
    r.cacheReadTokens * p.cacheRead
  ) / 1_000_000;
}
