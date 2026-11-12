import { RandomStream } from './random';

export type RetryMode = 'none' | 'immediate' | 'exponential';
export type JitterMode = 'none' | 'full';

export interface RetryPolicyConfig {
  mode: RetryMode;
  maxAttempts: number; // Total attempts allowed, including the initial attempt
  baseDelayMs?: number; // Starting wait time (default: 100ms)
  maxDelayMs?: number; // Maximum wait cap (default: 1000ms)
  jitter?: JitterMode; // 'none' = exact backoff, 'full' = random spread (default: 'full')
}

/**
 * Calculates the wait time before sending retry #n.
 *
 * Supported methods:
 * 1. None: Zero wait, but the caller will not dispatch any retries.
 * 2. Immediate: Zero wait (0ms). The next attempt is sent right away.
 * 3. Exponential (No Jitter): Wait time doubles after each failure (base * 2^(n-1)) up to maxDelay.
 *    Problem: Clients that fail together retry together, causing synchronized traffic spikes.
 * 4. Exponential (Full Jitter): Calculates the exponential ceiling, then picks a random delay
 *    between 0 and that ceiling.
 *    Benefit: Spreads retries evenly over time, smoothing out traffic spikes.
 */
export const calculateRetryDelayMs = (
  config: RetryPolicyConfig,
  retryNumber: number, // 1 for first retry, 2 for second retry, etc.
  jitterStream: RandomStream
): number => {
  // Method 1: No retries
  if (config.mode === 'none') {
    return 0;
  }

  // Method 2: Immediate retry (send right away)
  if (config.mode === 'immediate') {
    return 0;
  }

  // Exponential backoff calculation
  const base = config.baseDelayMs ?? 100;
  const max = config.maxDelayMs ?? 1000;

  // Double the delay for each retry: base * 2^(retryNumber - 1)
  const factor = Math.pow(2, Math.max(0, retryNumber - 1));
  const ceiling = Math.min(max, base * factor);

  // Method 3: Exponential with No Jitter (all clients wait the exact ceiling time)
  if (config.jitter === 'none') {
    return ceiling;
  }

  // Method 4: Exponential with Full Jitter (pick a random delay in [0, ceiling])
  return jitterStream.nextUniformRange(0, ceiling);
};
