import { useCallback, useEffect, useRef, useState } from 'react';
import { createSimulation, SimulationEngine } from '../engine/simulation';
import { EngineConfig, EngineLogEntry, EngineSnapshot } from '../engine/types';
import { ScenarioDefinition } from '../engine/scenarios';
import { RetryPolicyConfig } from '../engine/retryPolicy';
import { CircuitBreakerConfig } from '../engine/circuitBreaker';

export const useSimulationController = (scenario: ScenarioDefinition, speed: number) => {
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [logs, setLogs] = useState<EngineLogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [activeRetryPolicy, setActiveRetryPolicy] = useState<RetryPolicyConfig>(
    scenario.config.retryPolicy
  );
  const [activeBreaker, setActiveBreaker] = useState<CircuitBreakerConfig>(
    scenario.config.circuitBreaker ?? { enabled: false }
  );

  const engineRef = useRef<SimulationEngine | null>(null);
  const lastWallTimeRef = useRef<number | null>(null);
  const lastSnapshotWallTimeRef = useRef<number | null>(null);

  const initEngine = useCallback(
    (retryPolicy = scenario.config.retryPolicy, breaker = scenario.config.circuitBreaker ?? { enabled: false }) => {
      const effectiveConfig: EngineConfig = {
        ...scenario.config,
        retryPolicy,
        circuitBreaker: breaker,
      };

      engineRef.current = createSimulation(effectiveConfig);
      setSnapshot(engineRef.current.getSnapshot());
      setLogs([]);
    },
    [scenario]
  );

  useEffect(() => {
    setActiveRetryPolicy(scenario.config.retryPolicy);
    setActiveBreaker(scenario.config.circuitBreaker ?? { enabled: false });
    setIsRunning(false);
    initEngine();
  }, [scenario, initEngine]);

  useEffect(() => {
    if (!isRunning) {
      lastWallTimeRef.current = null;
      lastSnapshotWallTimeRef.current = null;
      return;
    }

    let animId: number;

    const loop = (wallTime: number) => {
      if (lastWallTimeRef.current === null) {
        lastWallTimeRef.current = wallTime;
      }

      const elapsedRealMs = wallTime - lastWallTimeRef.current;
      lastWallTimeRef.current = wallTime;

      if (engineRef.current && elapsedRealMs > 0) {
        const currentSimMs = engineRef.current.getCurrentTimeMs();
        const targetSimMs = currentSimMs + elapsedRealMs * speed;

        if (targetSimMs >= scenario.durationMs) {
          engineRef.current.advanceTo(scenario.durationMs);
          const finalNewLogs = engineRef.current.drainRecentEvents();
          if (finalNewLogs.length > 0) {
            setLogs((prev) => [...prev, ...finalNewLogs].slice(-300));
          }
          setSnapshot(engineRef.current.getSnapshot());
          setIsRunning(false);
          return;
        }

        engineRef.current.advanceTo(targetSimMs);
        const newLogs = engineRef.current.drainRecentEvents();
        if (newLogs.length > 0) {
          setLogs((prev) => [...prev, ...newLogs].slice(-300));
        }
        if (
          lastSnapshotWallTimeRef.current === null ||
          wallTime - lastSnapshotWallTimeRef.current >= 50
        ) {
          setSnapshot(engineRef.current.getSnapshot());
          lastSnapshotWallTimeRef.current = wallTime;
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, speed, scenario]);

  const togglePlay = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const step100ms = useCallback(() => {
    if (!engineRef.current) return;
    const current = engineRef.current.getCurrentTimeMs();
    const target = Math.min(current + 100, scenario.durationMs);
    engineRef.current.advanceTo(target);
    const newLogs = engineRef.current.drainRecentEvents();
    if (newLogs.length > 0) {
      setLogs((prev) => [...prev, ...newLogs].slice(-300));
    }
    setSnapshot(engineRef.current.getSnapshot());
  }, [scenario]);

  const reset = useCallback(() => {
    setIsRunning(false);
    initEngine(activeRetryPolicy, activeBreaker);
  }, [initEngine, activeRetryPolicy, activeBreaker]);

  return {
    snapshot,
    logs,
    isRunning,
    activeRetryPolicy,
    setActiveRetryPolicy,
    activeBreaker,
    setActiveBreaker,
    togglePlay,
    step100ms,
    reset,
  };
};
