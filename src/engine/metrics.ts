export interface MetricSample {
  timeMs: number;
  ingressRps: number;
  attemptRps: number;
  retryRps: number;
  queueDepth: number;
  activeWorkers: number;
  workerUtilization: number;
  lateCompletionCount: number;
  shortCircuitedCount: number;
}

export interface MetricEventTimestamp {
  atMs: number;
}

export class MetricsCollector {
  private windowMs: number = 1000; // 1-second rolling window for rates
  private sampleIntervalMs: number = 250; // Record a sample every 250ms
  private nextSampleAtMs: number = 0;

  // Sliding event history for rolling rate calculations
  private ingressTimestamps: number[] = [];
  private attemptTimestamps: number[] = [];
  private retryTimestamps: number[] = [];

  private samples: MetricSample[] = [];

  constructor(sampleIntervalMs: number = 250, windowMs: number = 1000) {
    this.sampleIntervalMs = sampleIntervalMs;
    this.windowMs = windowMs;
  }

  public getNextSampleAtMs = (): number => {
    return this.nextSampleAtMs;
  };

  public recordArrival = (atMs: number): void => {
    this.ingressTimestamps.push(atMs);
  };

  public recordAttempt = (atMs: number, isRetry: boolean): void => {
    this.attemptTimestamps.push(atMs);
    if (isRetry) {
      this.retryTimestamps.push(atMs);
    }
  };

  /**
   * Samples current state and rolls window counters.
   */
  public takeSample = (
    timeMs: number,
    queueDepth: number,
    activeWorkers: number,
    totalConcurrency: number,
    lateCompletionCount: number,
    shortCircuitedCount: number
  ): MetricSample => {
    this.pruneWindows(timeMs);

    const ingressRps = this.ingressTimestamps.length;
    const attemptRps = this.attemptTimestamps.length;
    const retryRps = this.retryTimestamps.length;

    const workerUtilization =
      totalConcurrency > 0 ? Number((activeWorkers / totalConcurrency).toFixed(2)) : 0;

    const sample: MetricSample = {
      timeMs,
      ingressRps,
      attemptRps,
      retryRps,
      queueDepth,
      activeWorkers,
      workerUtilization,
      lateCompletionCount,
      shortCircuitedCount,
    };

    this.samples.push(sample);
    this.nextSampleAtMs = timeMs + this.sampleIntervalMs;
    return sample;
  };

  public getSamples = (): MetricSample[] => {
    return this.samples;
  };

  public clear = (): void => {
    this.ingressTimestamps = [];
    this.attemptTimestamps = [];
    this.retryTimestamps = [];
    this.samples = [];
    this.nextSampleAtMs = 0;
  };

  private pruneWindows = (currentTimeMs: number): void => {
    const cutoff = currentTimeMs - this.windowMs;

    while (this.ingressTimestamps.length > 0 && this.ingressTimestamps[0] < cutoff) {
      this.ingressTimestamps.shift();
    }
    while (this.attemptTimestamps.length > 0 && this.attemptTimestamps[0] < cutoff) {
      this.attemptTimestamps.shift();
    }
    while (this.retryTimestamps.length > 0 && this.retryTimestamps[0] < cutoff) {
      this.retryTimestamps.shift();
    }
  };
}

export const createMetricsCollector = (
  sampleIntervalMs?: number,
  windowMs?: number
): MetricsCollector => {
  return new MetricsCollector(sampleIntervalMs, windowMs);
};
