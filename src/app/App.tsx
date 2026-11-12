import { useEffect, useRef, useState } from 'react';
import { createSimulation, SimulationEngine } from '../engine/simulation';
import { EngineConfig, EngineLogEntry, EngineSnapshot } from '../engine/types';
import { SCENARIOS, ScenarioDefinition } from '../engine/scenarios';
import { Header } from '../components/Header';
import { MetricsStrip } from '../components/MetricsStrip';
import { TopologyDiagram } from '../components/TopologyDiagram';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { ExperimentControls } from '../components/ExperimentControls';
import { EventFeed } from '../components/EventFeed';
import { RetryPolicyConfig } from '../engine/retryPolicy';
import { CircuitBreakerConfig } from '../engine/circuitBreaker';
import '../styles/tokens.css';

export const App = () => {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioDefinition>(SCENARIOS[0]);
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [logs, setLogs] = useState<EngineLogEntry[]>([]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);

  const [activeRetryPolicy, setActiveRetryPolicy] = useState<RetryPolicyConfig>(
    selectedScenario.config.retryPolicy
  );
  const [activeBreaker, setActiveBreaker] = useState<CircuitBreakerConfig>(
    selectedScenario.config.circuitBreaker ?? { enabled: false }
  );

  const engineRef = useRef<SimulationEngine | null>(null);
  const lastWallTimeRef = useRef<number | null>(null);

  const initEngine = (
    scenario: ScenarioDefinition = selectedScenario,
    retryOverride?: RetryPolicyConfig,
    breakerOverride?: CircuitBreakerConfig
  ) => {
    const policy = retryOverride ?? scenario.config.retryPolicy;
    const breaker = breakerOverride ?? scenario.config.circuitBreaker ?? { enabled: false };

    const effectiveConfig: EngineConfig = {
      ...scenario.config,
      retryPolicy: policy,
      circuitBreaker: breaker,
    };

    engineRef.current = createSimulation(effectiveConfig);
    setSnapshot(engineRef.current.getSnapshot());
    setLogs([]);
  };

  useEffect(() => {
    setActiveRetryPolicy(selectedScenario.config.retryPolicy);
    setActiveBreaker(selectedScenario.config.circuitBreaker ?? { enabled: false });
    setIsRunning(false);
    initEngine(selectedScenario);
  }, [selectedScenario]);

  useEffect(() => {
    if (!isRunning) {
      lastWallTimeRef.current = null;
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
        const currentSimMs = engineRef.current.getSnapshot().timeMs;
        const targetSimMs = currentSimMs + elapsedRealMs * speed;

        if (targetSimMs >= selectedScenario.durationMs) {
          engineRef.current.advanceTo(selectedScenario.durationMs);
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
        setSnapshot(engineRef.current.getSnapshot());
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, speed, selectedScenario]);

  const handleTogglePlay = () => {
    setIsRunning((prev) => !prev);
  };

  const handleStep100ms = () => {
    if (!engineRef.current) return;
    const current = engineRef.current.getSnapshot().timeMs;
    const target = Math.min(current + 100, selectedScenario.durationMs);
    engineRef.current.advanceTo(target);
    const newLogs = engineRef.current.drainRecentEvents();
    if (newLogs.length > 0) {
      setLogs((prev) => [...prev, ...newLogs].slice(-300));
    }
    setSnapshot(engineRef.current.getSnapshot());
  };

  const handleReset = () => {
    setIsRunning(false);
    initEngine(selectedScenario, activeRetryPolicy, activeBreaker);
  };

  const handleApplyAndReset = () => {
    setIsRunning(false);
    initEngine(selectedScenario, activeRetryPolicy, activeBreaker);
  };

  if (!snapshot) {
    return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Initializing engine...</div>;
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-canvas)', paddingBottom: '2rem' }}>
      {/* Header bar */}
      <Header
        selectedScenario={selectedScenario}
        onSelectScenario={setSelectedScenario}
        isRunning={isRunning}
        onTogglePlay={handleTogglePlay}
        onStep100ms={handleStep100ms}
        onReset={handleReset}
        speed={speed}
        onSpeedChange={setSpeed}
        simTimeMs={snapshot.timeMs}
        maxDurationMs={selectedScenario.durationMs}
      />

      {/* Telemetry Metrics Strip */}
      <MetricsStrip snapshot={snapshot} />

      {/* Topology Diagram (Centerpiece) */}
      <TopologyDiagram snapshot={snapshot} />

      {/* Time-Series Charts (Rates and Queue Depth) */}
      <TimeSeriesChart
        samples={snapshot.metricSamples}
        maxDurationMs={selectedScenario.durationMs}
      />

      {/* Live Terminal Event Stream with Pinned Summary Bar */}
      <EventFeed logs={logs} snapshot={snapshot} />

      {/* Mitigation Experiment Controls */}
      <ExperimentControls
        retryPolicy={activeRetryPolicy}
        onUpdateRetryPolicy={setActiveRetryPolicy}
        circuitBreaker={activeBreaker}
        onUpdateCircuitBreaker={setActiveBreaker}
        onApplyAndReset={handleApplyAndReset}
        isPausedOrReset={!isRunning}
      />
    </div>
  );
};
