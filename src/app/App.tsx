import { useState } from 'react';
import { SCENARIOS, ScenarioDefinition } from '../engine/scenarios';
import { Header } from '../components/Header';
import { MetricsStrip } from '../components/MetricsStrip';
import { TopologyDiagram } from '../components/TopologyDiagram';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { ExperimentControls } from '../components/ExperimentControls';
import { EventFeed } from '../components/EventFeed';
import { useSimulationController } from './useSimulationController';
import '../styles/tokens.css';

export const App = () => {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioDefinition>(SCENARIOS[0]);
  const [speed, setSpeed] = useState<number>(1);
  const {
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
  } = useSimulationController(selectedScenario, speed);

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
        onTogglePlay={togglePlay}
        onStep100ms={step100ms}
        onReset={reset}
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
        sampleCount={snapshot.metricSamples.length}
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
        onApplyAndReset={reset}
        isPausedOrReset={!isRunning}
      />
    </div>
  );
};
