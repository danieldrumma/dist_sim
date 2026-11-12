import { describe, it, expect } from 'vitest';
import { createMetricsCollector } from '../metrics';

describe('MetricsCollector', () => {
  it('calculates rolling 1-second rates accurately', () => {
    const metrics = createMetricsCollector(250, 1000);

    // Record arrivals at 100ms, 200ms, 500ms
    metrics.recordArrival(100);
    metrics.recordArrival(200);
    metrics.recordArrival(500);

    // Sample at 600ms: all 3 arrivals are within [0ms, 600ms]
    const sample1 = metrics.takeSample(600, 2, 2, 4, 0, 0);
    expect(sample1.ingressRps).toBe(3);
    expect(sample1.queueDepth).toBe(2);
    expect(sample1.workerUtilization).toBe(0.5); // 2 active / 4 total

    // Record 1 more arrival at 1200ms
    metrics.recordArrival(1200);

    // Sample at 1300ms: cutoff is 300ms (1300 - 1000). Arrivals at 100ms and 200ms have dropped off!
    // Remaining in window: arrival at 500ms and arrival at 1200ms -> 2
    const sample2 = metrics.takeSample(1300, 0, 0, 4, 0, 0);
    expect(sample2.ingressRps).toBe(2);
  });

  it('tracks retry RPS separately from total attempt RPS', () => {
    const metrics = createMetricsCollector(250, 1000);

    metrics.recordAttempt(100, false); // initial attempt
    metrics.recordAttempt(200, false); // initial attempt
    metrics.recordAttempt(300, true);  // retry attempt

    const sample = metrics.takeSample(500, 0, 1, 2, 0, 0);
    expect(sample.attemptRps).toBe(3);
    expect(sample.retryRps).toBe(1);
  });
});
