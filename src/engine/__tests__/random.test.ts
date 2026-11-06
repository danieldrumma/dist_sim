import { describe, it, expect } from 'vitest';
import { SimulationRandom } from '../random';

describe('SimulationRandom', () => {
  it('produces identical sequences for identical master seeds', () => {
    const rng1 = new SimulationRandom(42);
    const rng2 = new SimulationRandom(42);

    for (let i = 0; i < 20; i++) {
      expect(rng1.get('arrival').next()).toBe(rng2.get('arrival').next());
      expect(rng1.get('service').next()).toBe(rng2.get('service').next());
    }
  });

  it('guarantees independent streams (consuming jitter does not affect arrival)', () => {
    const rngA = new SimulationRandom(101);
    const rngB = new SimulationRandom(101);

    // In rngB, consume 50 values from jitter and service streams
    for (let i = 0; i < 50; i++) {
      rngB.get('jitter').next();
      rngB.get('service').next();
    }

    // Arrival sequences must remain completely identical
    for (let i = 0; i < 20; i++) {
      expect(rngA.get('arrival').next()).toBe(rngB.get('arrival').next());
    }
  });

  it('samples bounded uniform strictly within [0.9 * mean, 1.1 * mean]', () => {
    const rng = new SimulationRandom(73);
    const mean = 50;
    for (let i = 0; i < 100; i++) {
      const val = rng.get('service').nextBoundedUniform(mean);
      expect(val).toBeGreaterThanOrEqual(45);
      expect(val).toBeLessThan(55);
    }
  });

  it('samples exponential arrival times with positive intervals', () => {
    const rng = new SimulationRandom(42);
    const rateRps = 40;
    for (let i = 0; i < 50; i++) {
      const interval = rng.get('arrival').nextExponential(rateRps);
      expect(interval).toBeGreaterThan(0);
      expect(Number.isFinite(interval)).toBe(true);
    }
  });
});
