import { EngineSnapshot } from '../engine/types';
import styles from './MetricsStrip.module.css';

interface MetricsStripProps {
  snapshot: EngineSnapshot;
}

export const MetricsStrip = ({ snapshot }: MetricsStripProps) => {
  const latestMetric =
    snapshot.metricSamples.length > 0
      ? snapshot.metricSamples[snapshot.metricSamples.length - 1]
      : null;

  const ingressRps = latestMetric ? latestMetric.ingressRps : 0;
  const attemptRps = latestMetric ? latestMetric.attemptRps : 0;
  const retryRps = latestMetric ? latestMetric.retryRps : 0;

  const retryMultiplier =
    snapshot.totalArrivals > 0
      ? (snapshot.totalAttempts / snapshot.totalArrivals).toFixed(2)
      : '1.00';

  const isDegraded = snapshot.currentHealthSetting.latencyMultiplier > 1.0;
  const isOutage = snapshot.currentHealthSetting.failureProbability > 0;

  const getBreakerDotClass = () => {
    if (snapshot.breakerState === 'OPEN') return styles.dotDanger;
    if (snapshot.breakerState === 'HALF_OPEN') return styles.dotWarning;
    return styles.dotHealthy;
  };

  const getBreakerTextClass = () => {
    if (snapshot.breakerState === 'OPEN') return styles.valueDanger;
    if (snapshot.breakerState === 'HALF_OPEN') return styles.valueWarning;
    return styles.valueHealthy;
  };

  return (
    <div className={styles.grid}>
      {/* Ingress RPS */}
      <div className={styles.card}>
        <span className={styles.label}>Ingress Rate</span>
        <div className={styles.value}>
          {ingressRps} <span className={styles.unit}>req/s</span>
        </div>
        <div className={styles.subtext}>{snapshot.totalArrivals} total</div>
      </div>

      {/* Attempt RPS */}
      <div className={styles.card}>
        <span className={styles.label}>Attempt Volume</span>
        <div className={`${styles.value} ${retryRps > 0 ? styles.valueWarning : ''}`}>
          {attemptRps} <span className={styles.unit}>att/s</span>
        </div>
        <div className={styles.subtext}>{retryRps} retries/s</div>
      </div>

      {/* Retry Multiplier */}
      <div className={styles.card}>
        <span className={styles.label}>Retry Multiplier</span>
        <div className={`${styles.value} ${Number(retryMultiplier) > 1.2 ? styles.valueWarning : ''}`}>
          {retryMultiplier}x
        </div>
        <div className={styles.subtext}>{snapshot.retryAttemptsCount} retries total</div>
      </div>

      {/* Queue Depth */}
      <div className={styles.card}>
        <span className={styles.label}>Queue Depth</span>
        <div className={`${styles.value} ${snapshot.queueDepth > 10 ? styles.valueDanger : ''}`}>
          {snapshot.queueDepth}
        </div>
        <div className={styles.subtext}>waiting attempts</div>
      </div>

      {/* Wasted Work */}
      <div className={styles.card}>
        <span className={styles.label}>Wasted Work</span>
        <div className={`${styles.value} ${snapshot.lateCompletionCount > 0 ? styles.valueDanger : ''}`}>
          {snapshot.lateCompletionCount}
        </div>
        <div className={styles.subtext}>{snapshot.timedOutAttemptsCount} timeouts</div>
      </div>

      {/* Circuit Breaker Status */}
      <div className={styles.card}>
        <span className={styles.label}>Circuit Breaker</span>
        <div className={styles.breakerRow}>
          <span className={`${styles.statusDot} ${getBreakerDotClass()}`} />
          <span className={`${styles.value} ${getBreakerTextClass()}`} style={{ fontSize: '1.05rem' }}>
            {snapshot.breakerState}
          </span>
        </div>
        <div className={styles.subtext}>{snapshot.shortCircuitedCount} rejected (0ms)</div>
      </div>

      {/* Dependency Health */}
      <div className={styles.card}>
        <span className={styles.label}>Dependency State</span>
        <div
          className={`${styles.value} ${
            isOutage ? styles.valueDanger : isDegraded ? styles.valueWarning : styles.valueHealthy
          }`}
          style={{ fontSize: '0.95rem', marginTop: '0.2rem' }}
        >
          {isOutage ? '5XX OUTAGE' : isDegraded ? `${snapshot.currentHealthSetting.latencyMultiplier}x LATENCY` : 'NORMAL'}
        </div>
        <div className={styles.subtext}>
          {snapshot.activeWorkers} / {snapshot.workers.length} workers active
        </div>
      </div>
    </div>
  );
};
