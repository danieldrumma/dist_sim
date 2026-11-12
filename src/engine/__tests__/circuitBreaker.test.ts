import { describe, it, expect } from 'vitest';
import { createCircuitBreaker } from '../circuitBreaker';

describe('CircuitBreaker State Machine', () => {
  it('starts in CLOSED state and allows attempts', () => {
    const cb = createCircuitBreaker({ enabled: true, failureThreshold: 3, openDurationMs: 1000 });
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.canAttempt().allowed).toBe(true);
  });

  it('resets consecutive failures count on timely success', () => {
    const cb = createCircuitBreaker({ enabled: true, failureThreshold: 3, openDurationMs: 1000 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getConsecutiveFailures()).toBe(2);

    cb.recordSuccess();
    expect(cb.getConsecutiveFailures()).toBe(0);
    expect(cb.getState()).toBe('CLOSED');
  });

  it('trips to OPEN after threshold consecutive failures and rejects calls', () => {
    const cb = createCircuitBreaker({ enabled: true, failureThreshold: 3, openDurationMs: 1000 });
    expect(cb.recordFailure()).toBe(false);
    expect(cb.recordFailure()).toBe(false);
    // 3rd failure trips the breaker
    expect(cb.recordFailure()).toBe(true);

    expect(cb.getState()).toBe('OPEN');
    expect(cb.canAttempt().allowed).toBe(false);
  });

  it('transitions from OPEN to HALF_OPEN after cooldown and allows exactly one probe', () => {
    const cb = createCircuitBreaker({ enabled: true, failureThreshold: 2, openDurationMs: 1500 });
    cb.recordFailure();
    cb.recordFailure();
    expect(cb.getState()).toBe('OPEN');

    // Cooldown expires
    cb.handleCooldownExpired();
    expect(cb.getState()).toBe('HALF_OPEN');

    // 1st attempt: probe allowed!
    const first = cb.canAttempt();
    expect(first.allowed).toBe(true);
    expect(first.isHalfOpenProbe).toBe(true);

    // 2nd attempt while probe is in flight: rejected!
    const second = cb.canAttempt();
    expect(second.allowed).toBe(false);
  });

  it('closes breaker if HALF_OPEN probe succeeds', () => {
    const cb = createCircuitBreaker({ enabled: true, failureThreshold: 2, openDurationMs: 1000 });
    cb.recordFailure();
    cb.recordFailure();
    cb.handleCooldownExpired();

    // Probe succeeds
    cb.recordSuccess();
    expect(cb.getState()).toBe('CLOSED');
    expect(cb.getConsecutiveFailures()).toBe(0);
  });

  it('re-opens breaker if HALF_OPEN probe fails', () => {
    const cb = createCircuitBreaker({ enabled: true, failureThreshold: 2, openDurationMs: 1000 });
    cb.recordFailure();
    cb.recordFailure();
    cb.handleCooldownExpired();

    // Probe fails
    const trippedAgain = cb.recordFailure();
    expect(trippedAgain).toBe(true);
    expect(cb.getState()).toBe('OPEN');
  });
});
