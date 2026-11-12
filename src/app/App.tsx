import { useEffect, useRef, useState } from 'react';
import { createSimulation, SimulationEngine } from '../engine/simulation';
import { EngineSnapshot } from '../engine/types';
import { SCENARIOS, ScenarioDefinition } from '../engine/scenarios';

export const App = () => {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioDefinition>(SCENARIOS[0]);
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);

  const engineRef = useRef<SimulationEngine | null>(null);
  const lastWallTimeRef = useRef<number | null>(null);

  const initEngine = (scenario: ScenarioDefinition = selectedScenario) => {
    engineRef.current = createSimulation(scenario.config);
    setSnapshot(engineRef.current.getSnapshot());
  };

  useEffect(() => {
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
          setSnapshot(engineRef.current.getSnapshot());
          setIsRunning(false);
          return;
        }

        engineRef.current.advanceTo(targetSimMs);
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
    setSnapshot(engineRef.current.getSnapshot());
  };

  const handleReset = () => {
    setIsRunning(false);
    initEngine(selectedScenario);
  };

  const handleSlower = () => {
    setSpeed((s) => Math.max(0.1, Number((s - 0.1).toFixed(1))));
  };

  const handleFaster = () => {
    setSpeed((s) => Math.min(3.0, Number((s + 0.1).toFixed(1))));
  };

  const handleSelectScenario = (id: string) => {
    const s = SCENARIOS.find((item) => item.id === id);
    if (s) {
      setIsRunning(false);
      setSelectedScenario(s);
    }
  };

  if (!snapshot) {
    return <div>Initializing engine...</div>;
  }

  const isDegraded = snapshot.currentHealthSetting.latencyMultiplier > 1.0;
  const isOutage = snapshot.currentHealthSetting.failureProbability > 0;

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: '850px' }}>
      <h2>Dist Sim — Reliability Engineering Playground</h2>

      {/* Scenario Selector */}
      <div style={{ margin: '1rem 0' }}>
        <label style={{ fontWeight: 'bold', marginRight: '0.5rem' }}>Select Scenario:</label>
        <select
          value={selectedScenario.id}
          onChange={(e) => handleSelectScenario(e.target.value)}
          style={{ padding: '0.4rem 0.8rem', fontSize: '0.95rem' }}
        >
          {SCENARIOS.map((sc) => (
            <option key={sc.id} value={sc.id}>
              {sc.title} ({sc.durationMs / 1000}s)
            </option>
          ))}
        </select>
        <p style={{ color: '#555', marginTop: '0.5rem' }}>{selectedScenario.description}</p>
      </div>

      {/* Control Strip */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', margin: '1.5rem 0' }}>
        <button onClick={handleTogglePlay} style={{ padding: '0.5rem 1.25rem', cursor: 'pointer' }}>
          {isRunning ? 'Pause' : 'Play'}
        </button>
        <button onClick={handleStep100ms} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
          Step +100ms
        </button>
        <button onClick={handleReset} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
          Reset
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <button onClick={handleSlower} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer' }}>
            -0.1x
          </button>
          <span style={{ minWidth: '4rem', textAlign: 'center' }}>{speed.toFixed(1)}x</span>
          <button onClick={handleFaster} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer' }}>
            +0.1x
          </button>
        </div>
      </div>

      {/* Health Status Indicator */}
      <div
        style={{
          padding: '0.6rem 1rem',
          borderRadius: '4px',
          marginBottom: '1rem',
          background: isOutage ? '#ffebee' : isDegraded ? '#fff3e0' : '#e8f5e9',
          color: isOutage ? '#c62828' : isDegraded ? '#ef6c00' : '#2e7d32',
          fontWeight: 'bold',
        }}
      >
        System Health:{' '}
        {isOutage
          ? 'OUTAGE (100% 5xx Failure Active)'
          : isDegraded
            ? `DEGRADED (${snapshot.currentHealthSetting.latencyMultiplier}x Latency Active)`
            : 'HEALTHY'}
      </div>

      {/* Metrics Card */}
      <div style={{ background: '#f4f4f4', padding: '1rem', borderRadius: '6px' }}>
        <div>
          <strong>Simulated Time:</strong> {Math.round(snapshot.timeMs)} / {selectedScenario.durationMs} ms
        </div>
        <div>
          <strong>Total Arrivals:</strong> {snapshot.totalArrivals}
        </div>
        <div>
          <strong>Total Attempts:</strong> {snapshot.totalAttempts} ({snapshot.retryAttemptsCount} retries)
        </div>
        <div>
          <strong>Succeeded Requests:</strong> {snapshot.succeededRequestsCount}
        </div>
        <div>
          <strong>Failed Requests:</strong> {snapshot.failedRequestsCount}
        </div>
        <div>
          <strong>5xx Service Errors:</strong> {snapshot.serviceErrorCount}
        </div>
        <div>
          <strong>Timed-Out Attempts:</strong> {snapshot.timedOutAttemptsCount}
        </div>
        <div>
          <strong>Late / Wasted Work:</strong> {snapshot.lateCompletionCount}
        </div>
        <div>
          <strong>FIFO Queue Depth:</strong> {snapshot.queueDepth}
        </div>
        <div>
          <strong>Active Workers:</strong> {snapshot.activeWorkers} / {snapshot.workers.length}
        </div>
      </div>

      {/* Worker Slots */}
      <div style={{ marginTop: '1.5rem' }}>
        <h4>Payment Service Worker Slots ({snapshot.workers.length} total):</h4>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${snapshot.workers.length}, 1fr)`, gap: '0.5rem' }}>
          {snapshot.workers.map((w) => (
            <div
              key={w.id}
              style={{
                border: '1px solid #ccc',
                padding: '0.5rem',
                borderRadius: '4px',
                textAlign: 'center',
                background: w.busy ? '#e0f7fa' : '#fafafa',
              }}
            >
              <div><strong>#{w.id}</strong></div>
              <div style={{ fontSize: '0.85em', color: w.busy ? '#00796b' : '#757575' }}>
                {w.busy ? 'BUSY' : 'IDLE'}
              </div>
              {w.busy && (
                <div style={{ fontSize: '0.75em', marginTop: '0.25rem' }}>
                  Att #{w.currentAttemptId}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
