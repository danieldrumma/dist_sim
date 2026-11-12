import { ScenarioDefinition, SCENARIOS } from '../engine/scenarios';
import styles from './Header.module.css';

interface HeaderProps {
  selectedScenario: ScenarioDefinition;
  onSelectScenario: (scenario: ScenarioDefinition) => void;
  isRunning: boolean;
  onTogglePlay: () => void;
  onStep100ms: () => void;
  onReset: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  simTimeMs: number;
  maxDurationMs: number;
}

export const Header = ({
  selectedScenario,
  onSelectScenario,
  isRunning,
  onTogglePlay,
  onStep100ms,
  onReset,
  speed,
  onSpeedChange,
  simTimeMs,
  maxDurationMs,
}: HeaderProps) => {
  const progressPercent = Math.min(100, (simTimeMs / maxDurationMs) * 100);

  return (
    <header className={styles.header}>
      <div className={styles.topRow}>
        {/* Brand & Scenario */}
        <div className={styles.brandGroup}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span className={styles.brandTitle}>Dist Sim</span>
              <span className={styles.badge}>LAB-01</span>
            </div>
            <div className={styles.subtitle}>Reliability Engineering Playground</div>
          </div>

          <div className={styles.divider} />

          {/* Scenario Select */}
          <div className={styles.selectWrapper}>
            <select
              className={styles.scenarioSelect}
              value={selectedScenario.id}
              onChange={(e) => {
                const sc = SCENARIOS.find((s) => s.id === e.target.value);
                if (sc) onSelectScenario(sc);
              }}
            >
              {SCENARIOS.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  {sc.title} ({sc.durationMs / 1000}s)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Playback Controls */}
        <div className={styles.controlsGroup}>
          <div className={styles.timeCounter}>
            {(simTimeMs / 1000).toFixed(2)}s / {(maxDurationMs / 1000).toFixed(0)}s
          </div>

          <div className={styles.speedStepper}>
            <button
              className={styles.speedButton}
              onClick={() => onSpeedChange(Math.max(0.1, Number((speed - 0.1).toFixed(1))))}
            >
              -
            </button>
            <span className={styles.speedLabel}>{speed.toFixed(1)}x</span>
            <button
              className={styles.speedButton}
              onClick={() => onSpeedChange(Math.min(3.0, Number((speed + 0.1).toFixed(1))))}
            >
              +
            </button>
          </div>

          <button className={styles.btnSecondary} onClick={onStep100ms}>
            +100ms
          </button>

          <button className={styles.btnSecondary} onClick={onReset}>
            Reset
          </button>

          <button
            className={`${styles.btnPrimary} ${isRunning ? styles.btnPause : styles.btnRun}`}
            onClick={onTogglePlay}
          >
            {isRunning ? 'Pause' : 'Run Simulation'}
          </button>
        </div>
      </div>

      {/* Progress Track */}
      <div className={styles.progressBarTrack}>
        <div className={styles.progressBarFill} style={{ width: `${progressPercent}%` }} />
      </div>
    </header>
  );
};
