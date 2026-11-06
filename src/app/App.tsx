import { useEffect, useRef, useState } from 'react';
import { createSimulation, SimulationEngine } from '../engine/simulation';
import { EngineSnapshot } from '../engine/types';

export const App = () => {
  const [snapshot, setSnapshot] = useState<EngineSnapshot | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [speed, setSpeed] = useState<number>(1);

  const engineRef = useRef<SimulationEngine | null>(null);
  const lastWallTimeRef = useRef<number | null>(null);

  const initEngine = () => {
    engineRef.current = createSimulation({
      seed: 42,
      arrivalRateRps: 20,
      concurrency: 4,
      meanServiceMs: 80,
    });
    setSnapshot(engineRef.current.getSnapshot());
  };

  useEffect(() => {
    initEngine();
  }, []);

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
        engineRef.current.advanceTo(targetSimMs);
        setSnapshot(engineRef.current.getSnapshot());
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [isRunning, speed]);

  const handleTogglePlay = () => {
    setIsRunning((prev) => !prev);
  };

  const handleStep100ms = () => {
    if (!engineRef.current) return;
    const current = engineRef.current.getSnapshot().timeMs;
    engineRef.current.advanceTo(current + 100);
    setSnapshot(engineRef.current.getSnapshot());
  };

  const handleReset = () => {
    setIsRunning(false);
    initEngine();
  };

  const handleSlower = () => {
    setSpeed((s) => Math.max(0.1, Number((s - 0.1).toFixed(1))));
  };

  const handleFaster = () => {
    setSpeed((s) => Math.min(3.0, Number((s + 0.1).toFixed(1))));
  };

  if (!snapshot) {
    return <div>Initializing engine...</div>;
  }

  return (
    <div style={{ padding: '2rem', fontFamily: 'monospace', maxWidth: '800px' }}>
      <h2>Dist Sim — Engine Foundation Preview</h2>
      <p style={{ color: '#666' }}>
        Healthy baseline traffic preview (Seed: 42 | Concurrency: 4 | Mean Service: 80ms | Arrival: 20 rps)
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', margin: '1.5rem 0' }}>
        <button onClick={handleTogglePlay} style={{ padding: '0.5rem 1rem', cursor: 'pointer' }}>
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

      <div style={{ background: '#f4f4f4', padding: '1rem', borderRadius: '6px' }}>
        <div><strong>Simulated Time:</strong> {Math.round(snapshot.timeMs)} ms</div>
        <div><strong>Total Arrivals:</strong> {snapshot.totalArrivals}</div>
        <div><strong>Total Attempts:</strong> {snapshot.totalAttempts}</div>
        <div><strong>Completed Services:</strong> {snapshot.completedServiceCount}</div>
        <div><strong>FIFO Queue Depth:</strong> {snapshot.queueDepth}</div>
        <div><strong>Active Workers:</strong> {snapshot.activeWorkers} / {snapshot.workers.length}</div>
      </div>

      <div style={{ marginTop: '1.5rem' }}>
        <h4>Worker Slots:</h4>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
          {snapshot.workers.map((w) => (
            <div
              key={w.id}
              style={{
                border: '1px solid #ccc',
                padding: '0.75rem',
                borderRadius: '4px',
                background: w.busy ? '#e0f7fa' : '#fafafa',
              }}
            >
              <div><strong>Worker {w.id}</strong></div>
              <div>Status: {w.busy ? 'BUSY' : 'IDLE'}</div>
              {w.busy && (
                <>
                  <div style={{ fontSize: '0.85em' }}>Attempt: #{w.currentAttemptId}</div>
                  <div style={{ fontSize: '0.85em' }}>
                    Finishes: {Math.round(w.finishesAtMs || 0)} ms
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
