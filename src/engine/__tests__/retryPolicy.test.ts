import { describe, it, expect } from 'vitest';
import { calculateRetryDelayMs } from '../retryPolicy';
import { SimulationRandom } from '../random';

describe('calculateRetryDelayMs', () => {
  it('returns 0ms for none and immediate modes', () => {
    const rng = new SimulationRandom(42).get('jitter');

    expect(calculateRetryDelayMs({ mode: 'none', maxAttempts: 1 }, 1, rng)).toBe(0);
    expect(calculateRetryDelayMs({ mode: 'immediate', maxAttempts: 3 }, 1, rng)).toBe(0);
  });

  it('doubles wait time predictably for exponential with no jitter', () => {
    const rng = new SimulationRandom(42).get('jitter');
    const policy = {
      mode: 'exponential' as const,
      maxAttempts: 4,
      baseDelayMs: 100,
      maxDelayMs: 500,
      jitter: 'none' as const,
    };

    // Retry 1: 100 * 2^0 = 100
    expect(calculateRetryDelayMs(policy, 1, rng)).toBe(100);
    // Retry 2: 100 * 2^1 = 200
    expect(calculateRetryDelayMs(policy, 2, rng)).toBe(200);
    // Retry 3: 100 * 2^2 = 400
    expect(calculateRetryDelayMs(policy, 3, rng)).toBe(400);
    // Retry 4: 100 * 2^3 = 800 -> capped at 500
    expect(calculateRetryDelayMs(policy, 4, rng)).toBe(500);
  });

  it('samples full jitter strictly within [0, ceiling]', () => {
    const rng = new SimulationRandom(42).get('jitter');
    const policy = {
      mode: 'exponential' as const,
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      jitter: 'full' as const,
    };

    // Retry 1 ceiling is 100ms
    for (let i = 0; i < 50; i++) {
      const delay = calculateRetryDelayMs(policy, 1, rng);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(100);
    }

    // Retry 2 ceiling is 200ms
    for (let i = 0; i < 50; i++) {
      const delay = calculateRetryDelayMs(policy, 2, rng);
      expect(delay).toBeGreaterThanOrEqual(0);
      expect(delay).toBeLessThanOrEqual(200);
    }
  });
});
