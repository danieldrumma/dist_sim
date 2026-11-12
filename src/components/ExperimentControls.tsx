import { CircuitBreakerConfig } from '../engine/circuitBreaker';
import { JitterMode, RetryMode, RetryPolicyConfig } from '../engine/retryPolicy';
import styles from './ExperimentControls.module.css';

interface ExperimentControlsProps {
  retryPolicy: RetryPolicyConfig;
  onUpdateRetryPolicy: (policy: RetryPolicyConfig) => void;
  circuitBreaker: CircuitBreakerConfig;
  onUpdateCircuitBreaker: (cb: CircuitBreakerConfig) => void;
  onApplyAndReset: () => void;
  isPausedOrReset: boolean;
}

export const ExperimentControls = ({
  retryPolicy,
  onUpdateRetryPolicy,
  circuitBreaker,
  onUpdateCircuitBreaker,
  onApplyAndReset,
}: ExperimentControlsProps) => {
  const handleModeChange = (mode: RetryMode, jitter?: JitterMode) => {
    onUpdateRetryPolicy({
      ...retryPolicy,
      mode,
      jitter: jitter ?? retryPolicy.jitter,
    });
  };

  const handleMaxAttemptsChange = (max: number) => {
    onUpdateRetryPolicy({
      ...retryPolicy,
      maxAttempts: max,
    });
  };

  const handleToggleBreaker = () => {
    onUpdateCircuitBreaker({
      ...circuitBreaker,
      enabled: !circuitBreaker.enabled,
    });
  };

  return (
    <div className={styles.container}>
      <div className={styles.topRow}>
        <div>
          <span className={styles.title}>Mitigation & Resilience Policy (Experiment Setup)</span>
          <div className={styles.subtitle}>
            Adjust policies to observe how mitigation strategies alter the failure trace.
          </div>
        </div>

        <button className={styles.btnReplay} onClick={onApplyAndReset}>
          Apply & Replay Seed
        </button>
      </div>

      <div className={styles.controlsGrid}>
        {/* Policy Selector */}
        <div>
          <label className={styles.fieldLabel}>Retry Strategy</label>
          <div className={styles.buttonGroup}>
            <button
              className={`${styles.segmentBtn} ${retryPolicy.mode === 'none' ? styles.segmentBtnActive : ''}`}
              onClick={() => handleModeChange('none')}
            >
              No Retries
            </button>
            <button
              className={`${styles.segmentBtn} ${retryPolicy.mode === 'immediate' ? styles.segmentBtnActive : ''}`}
              onClick={() => handleModeChange('immediate')}
            >
              Immediate
            </button>
            <button
              className={`${styles.segmentBtn} ${
                retryPolicy.mode === 'exponential' && retryPolicy.jitter === 'none'
                  ? styles.segmentBtnActive
                  : ''
              }`}
              onClick={() => handleModeChange('exponential', 'none')}
            >
              Exp (No Jitter)
            </button>
            <button
              className={`${styles.segmentBtn} ${
                retryPolicy.mode === 'exponential' && retryPolicy.jitter === 'full'
                  ? styles.segmentBtnActive
                  : ''
              }`}
              onClick={() => handleModeChange('exponential', 'full')}
            >
              Exp + Full Jitter
            </button>
          </div>
        </div>

        {/* Max Attempts */}
        <div>
          <label className={styles.fieldLabel}>Max Attempts (Including Initial)</label>
          <div className={styles.buttonGroup}>
            {[1, 2, 3, 5].map((count) => (
              <button
                key={count}
                className={`${styles.segmentBtn} ${retryPolicy.maxAttempts === count ? styles.segmentBtnActive : ''}`}
                onClick={() => handleMaxAttemptsChange(count)}
              >
                {count} {count === 1 ? 'attempt' : 'attempts'}
              </button>
            ))}
          </div>
        </div>

        {/* Circuit Breaker Toggle */}
        <div>
          <label className={styles.fieldLabel}>Circuit Breaker Protection</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              className={`${styles.segmentBtn} ${circuitBreaker.enabled ? styles.segmentBtnHealthy : ''}`}
              onClick={handleToggleBreaker}
            >
              {circuitBreaker.enabled ? '✓ Enabled' : 'Disabled'}
            </button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {circuitBreaker.enabled ? '5 errors trips OPEN ➔ 1.5s probe' : 'No dependency protection'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
