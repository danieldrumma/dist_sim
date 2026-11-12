export type BreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  enabled: boolean;
  failureThreshold?: number; // Consecutive failure count to trip OPEN (default: 5)
  openDurationMs?: number; // Time in OPEN state before testing HALF_OPEN (default: 1500ms)
}

export class CircuitBreaker {
  private enabled: boolean;
  private failureThreshold: number;
  private openDurationMs: number;

  private state: BreakerState = 'CLOSED';
  private consecutiveFailures: number = 0;
  private halfOpenProbeInFlight: boolean = false;

  constructor(config: CircuitBreakerConfig) {
    this.enabled = config.enabled;
    this.failureThreshold = config.failureThreshold ?? 5;
    this.openDurationMs = config.openDurationMs ?? 1500;
  }

  public isEnabled = (): boolean => {
    return this.enabled;
  };

  public getState = (): BreakerState => {
    return this.state;
  };

  public getOpenDurationMs = (): number => {
    return this.openDurationMs;
  };

  public getConsecutiveFailures = (): number => {
    return this.consecutiveFailures;
  };

  /**
   * Evaluates if a new attempt is allowed to pass through to the dependency.
   * - CLOSED: Always allowed.
   * - OPEN: Disallowed (short-circuit).
   * - HALF_OPEN: Exactly 1 probe allowed. Subsequent calls are rejected while probe is in flight.
   */
  public canAttempt = (): { allowed: boolean; isHalfOpenProbe: boolean } => {
    if (!this.enabled) {
      return { allowed: true, isHalfOpenProbe: false };
    }

    if (this.state === 'CLOSED') {
      return { allowed: true, isHalfOpenProbe: false };
    }

    if (this.state === 'OPEN') {
      return { allowed: false, isHalfOpenProbe: false };
    }

    // HALF_OPEN: allow exactly one probe attempt
    if (this.state === 'HALF_OPEN') {
      if (!this.halfOpenProbeInFlight) {
        this.halfOpenProbeInFlight = true;
        return { allowed: true, isHalfOpenProbe: true };
      }
      return { allowed: false, isHalfOpenProbe: false };
    }

    return { allowed: false, isHalfOpenProbe: false };
  };

  /**
   * Records a timely successful response from the dependency.
   */
  public recordSuccess = (): void => {
    if (!this.enabled) return;

    this.consecutiveFailures = 0;
    this.halfOpenProbeInFlight = false;
    this.state = 'CLOSED';
  };

  /**
   * Records a dependency attempt failure (client timeout or 5xx service error).
   * Returns true if the breaker just transitioned from CLOSED/HALF_OPEN -> OPEN.
   */
  public recordFailure = (): boolean => {
    if (!this.enabled) return false;

    if (this.state === 'CLOSED') {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.failureThreshold) {
        this.state = 'OPEN';
        this.halfOpenProbeInFlight = false;
        return true;
      }
      return false;
    }

    if (this.state === 'HALF_OPEN') {
      // Canary probe failed -> reopen immediately
      this.state = 'OPEN';
      this.halfOpenProbeInFlight = false;
      return true;
    }

    return false;
  };

  /**
   * Triggered when the cooldown timer expires.
   * Moves state from OPEN to HALF_OPEN to allow one canary probe.
   */
  public handleCooldownExpired = (): void => {
    if (!this.enabled) return;

    if (this.state === 'OPEN') {
      this.state = 'HALF_OPEN';
      this.halfOpenProbeInFlight = false;
    }
  };
}

export const createCircuitBreaker = (config: CircuitBreakerConfig): CircuitBreaker => {
  return new CircuitBreaker(config);
};
