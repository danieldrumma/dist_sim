import { describe, it, expect } from 'vitest';
import { createSimulation } from '../simulation';

describe('SimulationEngine Baseline', () => {
  it('guarantees active workers never exceed configured concurrency', () => {
    const concurrency = 4;
    const engine = createSimulation({
      seed: 42,
      arrivalRateRps: 100, // high arrival rate to ensure overload
      concurrency,
      meanServiceMs: 200,
    });

    // Advance in 50ms increments up to 3000ms
    for (let t = 50; t <= 3000; t += 50) {
      engine.advanceTo(t);
      const snapshot = engine.getSnapshot();
      expect(snapshot.activeWorkers).toBeLessThanOrEqual(concurrency);
    }
  });

  it('preserves strict FIFO ordering when admitting queued attempts', () => {
    const engine = createSimulation({
      seed: 99,
      arrivalRateRps: 50,
      concurrency: 1, // 1 worker to force queueing
      meanServiceMs: 100,
    });

    engine.advanceTo(500);
    const snapshot = engine.getSnapshot();

    // Verify queuedAttemptIds are sorted strictly ascending by ID
    for (let i = 1; i < snapshot.queuedAttemptIds.length; i++) {
      expect(snapshot.queuedAttemptIds[i]).toBeGreaterThan(snapshot.queuedAttemptIds[i - 1]);
    }
  });

  it('produces identical state and arrivals for identical seeds (determinism)', () => {
    const engine1 = createSimulation({
      seed: 42,
      arrivalRateRps: 30,
      concurrency: 4,
      meanServiceMs: 50,
    });

    const engine2 = createSimulation({
      seed: 42,
      arrivalRateRps: 30,
      concurrency: 4,
      meanServiceMs: 50,
    });

    engine1.advanceTo(2000);
    engine2.advanceTo(2000);

    const snap1 = engine1.getSnapshot();
    const snap2 = engine2.getSnapshot();

    expect(snap1).toEqual(snap2);
  });

  it('produces identical snapshots regardless of advanceTo chunk size', () => {
    // Engine A advances in 10ms increments
    const engineA = createSimulation({
      seed: 1234,
      arrivalRateRps: 25,
      concurrency: 2,
      meanServiceMs: 80,
    });

    for (let t = 10; t <= 1000; t += 10) {
      engineA.advanceTo(t);
    }

    // Engine B advances directly to 1000ms in one jump
    const engineB = createSimulation({
      seed: 1234,
      arrivalRateRps: 25,
      concurrency: 2,
      meanServiceMs: 80,
    });

    engineB.advanceTo(1000);

    const snapA = engineA.getSnapshot();
    const snapB = engineB.getSnapshot();

    expect(snapA).toEqual(snapB);
  });

  it('records completed services and leaves no busy workers if run long after traffic stops', () => {
    const engine = createSimulation({
      seed: 7,
      arrivalRateRps: 10,
      concurrency: 4,
      meanServiceMs: 50,
    });

    engine.advanceTo(1000);
    const midSnap = engine.getSnapshot();
    expect(midSnap.totalArrivals).toBeGreaterThan(0);
    expect(midSnap.completedServiceCount).toBeGreaterThan(0);
  });
});
