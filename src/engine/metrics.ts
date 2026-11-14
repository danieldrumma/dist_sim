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
  private ingressHead = 0;
  private attemptHead = 0;
  private retryHead = 0;

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

    const ingressRps = this.ingressTimestamps.length - this.ingressHead;
    const attemptRps = this.attemptTimestamps.length - this.attemptHead;
    const retryRps = this.retryTimestamps.length - this.retryHead;

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
    this.ingressHead = 0;
    this.attemptHead = 0;
    this.retryHead = 0;
    this.samples = [];
    this.nextSampleAtMs = 0;
  };

  private pruneWindows = (currentTimeMs: number): void => {
    const cutoff = currentTimeMs - this.windowMs;

    this.ingressHead = this.advanceHead(this.ingressTimestamps, this.ingressHead, cutoff);
    this.attemptHead = this.advanceHead(this.attemptTimestamps, this.attemptHead, cutoff);
    this.retryHead = this.advanceHead(this.retryTimestamps, this.retryHead, cutoff);
    this.compactTimestamps();
  };

  private advanceHead = (timestamps: number[], head: number, cutoff: number): number => {
    while (head < timestamps.length && timestamps[head] < cutoff) {
      head++;
    }
    return head;
  };

  private compactTimestamps = (): void => {
    const compact = (timestamps: number[], head: number): [number[], number] => {
      // Reclaim old entries occasionally without shifting on every prune.
      if (head > 1024 && head * 2 >= timestamps.length) {
        return [timestamps.slice(head), 0];
      }
      return [timestamps, head];
    };

    [this.ingressTimestamps, this.ingressHead] = compact(this.ingressTimestamps, this.ingressHead);
    [this.attemptTimestamps, this.attemptHead] = compact(this.attemptTimestamps, this.attemptHead);
    [this.retryTimestamps, this.retryHead] = compact(this.retryTimestamps, this.retryHead);
  };
}

export const createMetricsCollector = (
  sampleIntervalMs?: number,
  windowMs?: number
): MetricsCollector => {
  return new MetricsCollector(sampleIntervalMs, windowMs);
};
