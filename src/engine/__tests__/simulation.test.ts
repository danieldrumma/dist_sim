import { describe, it, expect } from 'vitest';
import { createSimulation } from '../simulation';

describe('SimulationEngine Baseline & Concurrency', () => {
  it('guarantees active workers never exceed configured concurrency', () => {
    const concurrency = 4;
    const engine = createSimulation({
      seed: 42,
      arrivalRateRps: 100, // high arrival rate to ensure overload
      concurrency,
      meanServiceMs: 200,
      timeoutMs: 500,
      retryPolicy: 'none',
      maxAttempts: 1,
    });

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
      concurrency: 1,
      meanServiceMs: 100,
      timeoutMs: 1000,
      retryPolicy: 'none',
      maxAttempts: 1,
    });

    engine.advanceTo(500);
    const snapshot = engine.getSnapshot();

    for (let i = 1; i < snapshot.queuedAttemptIds.length; i++) {
      expect(snapshot.queuedAttemptIds[i]).toBeGreaterThan(snapshot.queuedAttemptIds[i - 1]);
    }
  });

  it('produces identical state and arrivals for identical seeds (determinism)', () => {
    const baseConfig = {
      seed: 42,
      arrivalRateRps: 30,
      concurrency: 4,
      meanServiceMs: 50,
      timeoutMs: 200,
      retryPolicy: 'none' as const,
      maxAttempts: 1,
    };

    const engine1 = createSimulation(baseConfig);
    const engine2 = createSimulation(baseConfig);

    engine1.advanceTo(2000);
    engine2.advanceTo(2000);

    expect(engine1.getSnapshot()).toEqual(engine2.getSnapshot());
  });

  it('produces identical snapshots regardless of advanceTo chunk size', () => {
    const config = {
      seed: 1234,
      arrivalRateRps: 25,
      concurrency: 2,
      meanServiceMs: 80,
      timeoutMs: 150,
      retryPolicy: 'none' as const,
      maxAttempts: 1,
    };

    const engineA = createSimulation(config);
    for (let t = 10; t <= 1000; t += 10) {
      engineA.advanceTo(t);
    }

    const engineB = createSimulation(config);
    engineB.advanceTo(1000);

    expect(engineA.getSnapshot()).toEqual(engineB.getSnapshot());
  });
});

describe('SimulationEngine Timeouts, Late Work & Retries', () => {
  it('triggers client timeout when service duration exceeds timeout deadline', () => {
    // Mean service 100ms, timeout 50ms -> service will definitely exceed timeout
    const engine = createSimulation({
      seed: 1,
      arrivalRateRps: 10,
      concurrency: 2,
      meanServiceMs: 100,
      timeoutMs: 50,
      retryPolicy: 'none',
      maxAttempts: 1,
    });

    engine.advanceTo(70);
    const snap = engine.getSnapshot();

    expect(snap.timedOutAttemptsCount).toBeGreaterThan(0);
    expect(snap.failedRequestsCount).toBeGreaterThan(0);
  });

  it('does NOT cancel server work on timeout: worker stays occupied and late completion is counted', () => {
    // 1 worker, 100ms service, 30ms timeout.
    // The attempt times out at 30ms, but worker finishes ~100ms.
    const engine = createSimulation({
      seed: 42,
      arrivalRateRps: 0, // no subsequent arrivals; only the initial arrival at t=0
      concurrency: 1,
      meanServiceMs: 100,
      timeoutMs: 30,
      retryPolicy: 'none',
      maxAttempts: 1,
    });

    // At t = 50ms: attempt has timed out, but worker must STILL be busy processing it!
    engine.advanceTo(50);
    const at50 = engine.getSnapshot();
    expect(at50.timedOutAttemptsCount).toBe(1);
    expect(at50.activeWorkers).toBe(1);
    expect(at50.lateCompletionCount).toBe(0);
    expect(at50.failedRequestsCount).toBe(1);
    expect(at50.succeededRequestsCount).toBe(0);

    // At t = 150ms: worker finishes late work
    engine.advanceTo(150);
    const at150 = engine.getSnapshot();
    expect(at150.activeWorkers).toBe(0);
    expect(at150.lateCompletionCount).toBe(1);
    // Late completion must NOT turn failed request into success!
    expect(at150.succeededRequestsCount).toBe(0);
    expect(at150.failedRequestsCount).toBe(1);
  });

  it('immediate retry policy dispatches retry attempts up to maxAttempts', () => {
    // 1 arrival at t=0, service ~100ms, timeout 20ms, maxAttempts = 3
    const engine = createSimulation({
      seed: 42,
      arrivalRateRps: 0,
      concurrency: 1,
      meanServiceMs: 100,
      timeoutMs: 20,
      retryPolicy: 'immediate',
      maxAttempts: 3,
    });

    // Advance to 100ms: attempt 1 times out at 20ms, attempt 2 at 40ms, attempt 3 at 60ms
    engine.advanceTo(100);
    const snap = engine.getSnapshot();

    // Exactly 3 total attempts created (original + 2 retries)
    expect(snap.totalAttempts).toBe(3);
    expect(snap.retryAttemptsCount).toBe(2);
    expect(snap.timedOutAttemptsCount).toBe(3);
    expect(snap.failedRequestsCount).toBe(1);
  });
});
