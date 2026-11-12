import { EngineConfig } from './types';

export interface ScenarioDefinition {
  id: string;
  title: string;
  description: string;
  durationMs: number;
  config: EngineConfig;
}

export const SCENARIO_RETRY_STORM: ScenarioDefinition = {
  id: 'retry-storm',
  title: 'The Retry Storm',
  description:
    'A downstream dependency slows down (3x latency). Timeouts fire, immediate retries multiply offered load, and the queue explodes with wasted work.',
  durationMs: 20000,
  config: {
    seed: 42,
    arrivalRateRps: 40,
    concurrency: 8,
    meanServiceMs: 50,
    timeoutMs: 100,
    retryPolicy: {
      mode: 'immediate',
      maxAttempts: 3,
    },
    scheduledPhases: [
      {
        atMs: 5000,
        healthSetting: { latencyMultiplier: 3.0, failureProbability: 0.0 }, // 150ms mean service
      },
      {
        atMs: 9000,
        healthSetting: { latencyMultiplier: 1.0, failureProbability: 0.0 }, // recovery
      },
    ],
  },
};

export const SCENARIO_THUNDERING_HERD: ScenarioDefinition = {
  id: 'thundering-herd',
  title: 'The Thundering Herd',
  description:
    'A sudden burst of 48 requests causes simultaneous timeouts. Demonstrates how exponential backoff without jitter causes synchronized retry waves, while full jitter spreads retries smoothly.',
  durationMs: 8000,
  config: {
    seed: 73,
    arrivalRateRps: 0,
    burstArrivals: { atMs: 2000, count: 48 },
    concurrency: 4,
    meanServiceMs: 100,
    timeoutMs: 150,
    retryPolicy: {
      mode: 'exponential',
      maxAttempts: 2,
      baseDelayMs: 200,
      maxDelayMs: 400,
      jitter: 'none', // Default to no-jitter to show the herd spike
    },
  },
};

export const SCENARIO_CIRCUIT_BREAKER: ScenarioDefinition = {
  id: 'circuit-breaker',
  title: 'The Circuit Breaker',
  description:
    'Downstream service begins returning 5xx responses during an outage window (4s-7s). Circuit breaker opens to reject calls fast and allow dependency recovery.',
  durationMs: 12000,
  config: {
    seed: 101,
    arrivalRateRps: 25,
    concurrency: 8,
    meanServiceMs: 80,
    timeoutMs: 250,
    retryPolicy: {
      mode: 'exponential',
      maxAttempts: 3,
      baseDelayMs: 100,
      maxDelayMs: 800,
      jitter: 'full',
    },
    circuitBreaker: {
      enabled: true,
      failureThreshold: 5,
      openDurationMs: 1500,
    },
    scheduledPhases: [
      {
        atMs: 4000,
        healthSetting: { latencyMultiplier: 1.0, failureProbability: 1.0 }, // 100% 5xx errors
      },
      {
        atMs: 7000,
        healthSetting: { latencyMultiplier: 1.0, failureProbability: 0.0 }, // recovery
      },
    ],
  },
};

export const SCENARIOS: ScenarioDefinition[] = [
  SCENARIO_RETRY_STORM,
  SCENARIO_THUNDERING_HERD,
  SCENARIO_CIRCUIT_BREAKER,
];
