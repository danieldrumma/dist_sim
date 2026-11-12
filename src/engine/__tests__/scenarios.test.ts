import { describe, it, expect } from 'vitest';
import { createSimulation } from '../simulation';
import {
  SCENARIO_RETRY_STORM,
  SCENARIO_THUNDERING_HERD,
  SCENARIO_CIRCUIT_BREAKER,
} from '../scenarios';

describe('Scenario-level Verification', () => {
  it('Scenario 1 (Retry Storm): latency fault triggers timeouts, retry surge, and queue accumulation', () => {
    const engine = createSimulation(SCENARIO_RETRY_STORM.config);

    // Run before fault (0ms to 4000ms): healthy
    engine.advanceTo(4000);
    const snapBeforeFault = engine.getSnapshot();
    expect(snapBeforeFault.currentHealthSetting.latencyMultiplier).toBe(1.0);
    expect(snapBeforeFault.succeededRequestsCount).toBeGreaterThan(0);

    // Run through fault window (5000ms to 9000ms): inspect at 8000ms
    engine.advanceTo(8000);
    const snapDuringFault = engine.getSnapshot();
    expect(snapDuringFault.currentHealthSetting.latencyMultiplier).toBe(3.0);
    expect(snapDuringFault.timedOutAttemptsCount).toBeGreaterThan(0);
    expect(snapDuringFault.retryAttemptsCount).toBeGreaterThan(0);
    expect(snapDuringFault.queueDepth).toBeGreaterThan(0);

    // Run to 20000ms: recovery completed
    engine.advanceTo(20000);
    const snapEnd = engine.getSnapshot();
    expect(snapEnd.currentHealthSetting.latencyMultiplier).toBe(1.0);
    expect(snapEnd.lateCompletionCount).toBeGreaterThan(0);
  });

  it('Scenario 2 (Thundering Herd): changing jitter does not alter request arrivals', () => {
    // Engine A: no jitter
    const engineA = createSimulation(SCENARIO_THUNDERING_HERD.config);

    // Engine B: full jitter
    const configWithJitter = {
      ...SCENARIO_THUNDERING_HERD.config,
      retryPolicy: {
        ...SCENARIO_THUNDERING_HERD.config.retryPolicy,
        jitter: 'full' as const,
      },
    };
    const engineB = createSimulation(configWithJitter);

    engineA.advanceTo(2000);
    engineB.advanceTo(2000);

    // At the exact moment the burst lands, arrivals must be 100% identical
    expect(engineA.getSnapshot().totalArrivals).toBe(engineB.getSnapshot().totalArrivals);
    expect(engineA.getSnapshot().totalArrivals).toBe(48);
  });

  it('Scenario 3 (Circuit Breaker): trips OPEN during outage, short-circuits calls, and recovers to CLOSED', () => {
    const engine = createSimulation(SCENARIO_CIRCUIT_BREAKER.config);

    // Advance to before outage (t = 3500ms): CLOSED and healthy
    engine.advanceTo(3500);
    expect(engine.getSnapshot().breakerState).toBe('CLOSED');
    expect(engine.getSnapshot().shortCircuitedCount).toBe(0);

    // Advance into outage (t = 5000ms): 5xx errors trip breaker to OPEN
    engine.advanceTo(5000);
    const snapMidOutage = engine.getSnapshot();
    expect(snapMidOutage.breakerState).toBe('OPEN');
    expect(snapMidOutage.shortCircuitedCount).toBeGreaterThan(0);

    // Advance to end of simulation (t = 12000ms): after recovery at 7000ms, probe succeeds and resets to CLOSED
    engine.advanceTo(12000);
    const snapEnd = engine.getSnapshot();
    expect(snapEnd.breakerState).toBe('CLOSED');
    expect(snapEnd.succeededRequestsCount).toBeGreaterThan(0);
  });
});
