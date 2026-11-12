import { EngineSnapshot } from '../engine/types';
import styles from './TopologyDiagram.module.css';

interface TopologyDiagramProps {
  snapshot: EngineSnapshot;
}

export const TopologyDiagram = ({ snapshot }: TopologyDiagramProps) => {
  const isBreakerOpen = snapshot.breakerState === 'OPEN';
  const isBreakerHalfOpen = snapshot.breakerState === 'HALF_OPEN';
  const isDegraded = snapshot.currentHealthSetting.latencyMultiplier > 1.0;
  const isOutage = snapshot.currentHealthSetting.failureProbability > 0;

  const maxVisibleQueueSlots = 24;
  const visibleQueueCount = Math.min(snapshot.queueDepth, maxVisibleQueueSlots);
  const overflowQueueCount = Math.max(0, snapshot.queueDepth - maxVisibleQueueSlots);

  const getNodeCardStatusClass = () => {
    if (isOutage || isBreakerOpen) return styles.nodeCardOutage;
    if (isDegraded || isBreakerHalfOpen) return styles.nodeCardDegraded;
    return styles.nodeCardHealthy;
  };

  const getBreakerBadgeClass = () => {
    if (isBreakerOpen) return styles.badgeOpen;
    if (isBreakerHalfOpen) return styles.badgeHalfOpen;
    return styles.badgeClosed;
  };

  return (
    <div className={styles.container}>
      <div className={styles.headerRow}>
        <span className={styles.title}>Topology // Checkout API ➔ Payment Service</span>

        <div className={styles.legend}>
          <div className={styles.legendItem}>
            <span className={styles.dotInitial} />
            <span>Initial Attempt</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.dotRetry} />
            <span>Retry Attempt</span>
          </div>
          <div className={styles.legendItem}>
            <span className={styles.dotWasted} />
            <span>Wasted Work</span>
          </div>
        </div>
      </div>

      <div className={styles.diagramGrid}>
        {/* ================= 1. CHECKOUT API (Left Card) ================= */}
        <div className={styles.nodeCard}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.nodeName}>Checkout API</div>
              <div className={styles.nodeRole}>Caller (Client Service)</div>
            </div>
          </div>

          <div className={styles.metricSection}>
            <span className={styles.sectionLabel}>Admitted Ingress</span>
            <div className={styles.bigValue}>{snapshot.totalArrivals}</div>
          </div>

          <div className={styles.metricSection}>
            <span className={styles.sectionLabel}>Client Outcomes</span>
            <div className={styles.outcomesRow}>
              <div className={styles.outcomeItem}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>SUCCEEDED</span>
                <span className={styles.outcomeSuccess}>✓ {snapshot.succeededRequestsCount}</span>
              </div>
              <div className={styles.outcomeItem}>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>FAILED</span>
                <span className={styles.outcomeFail}>✗ {snapshot.failedRequestsCount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= 2. TRANSIT PIPELINE (Center SVG) ================= */}
        <div className={styles.transitPipeContainer}>
          <svg className={styles.transitSvg} viewBox="0 0 200 48" preserveAspectRatio="none">
            <defs>
              <linearGradient id="pipeGlow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
                <stop
                  offset="100%"
                  stopColor={isBreakerOpen ? '#ef4444' : isDegraded ? '#f59e0b' : '#06b6d4'}
                  stopOpacity="0.8"
                />
              </linearGradient>
            </defs>

            {/* Base Pipe Channel */}
            <line x1="6" y1="24" x2="194" y2="24" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="12" strokeLinecap="round" />

            {/* Active Data Flow Line */}
            <line
              x1="6"
              y1="24"
              x2="194"
              y2="24"
              stroke="url(#pipeGlow)"
              strokeWidth="2.5"
              strokeDasharray={snapshot.retryAttemptsCount > 0 ? '6,4' : '8,6'}
              strokeLinecap="round"
            />

            {/* Moving In-Flight Attempt Particles */}
            {snapshot.recentTransitParticles.map((particle) => {
              const elapsed = snapshot.timeMs - particle.dispatchedAtMs;
              const progress = Math.min(1, Math.max(0, elapsed / 500));
              const xPos = 10 + progress * 175;
              const color = particle.rejected
                ? '#ef4444'
                : particle.isRetry
                  ? '#f59e0b'
                  : '#06b6d4';

              return (
                <circle
                  key={particle.attemptId}
                  cx={xPos}
                  cy="24"
                  r={particle.isRetry ? '4' : '3'}
                  fill={color}
                  opacity={1 - progress * 0.25}
                />
              );
            })}

            {/* Gate indicator at end */}
            <circle
              cx="192"
              cy="24"
              r="7"
              fill={isBreakerOpen ? '#ef4444' : isBreakerHalfOpen ? '#f59e0b' : '#10b981'}
            />
          </svg>

          <span className={styles.transitLabel}>
            {isBreakerOpen ? 'GATE OPEN (Short-Circuit)' : 'ATTEMPT TRANSIT PATH'}
          </span>
        </div>

        {/* ================= 3. PAYMENT SERVICE (Right Card) ================= */}
        <div className={`${styles.nodeCard} ${getNodeCardStatusClass()}`}>
          <div className={styles.cardHeader}>
            <div>
              <div className={styles.nodeName}>Payment Service</div>
              <div className={styles.nodeRole}>Finite Dependency Pool</div>
            </div>

            <span className={`${styles.breakerBadge} ${getBreakerBadgeClass()}`}>
              {snapshot.breakerState}
            </span>
          </div>

          {/* FIFO Queue Tube */}
          <div className={styles.metricSection}>
            <span className={styles.sectionLabel}>
              FIFO Waiting Queue ({snapshot.queueDepth} waiting)
            </span>

            <div className={styles.queueTube}>
              {snapshot.queueDepth === 0 ? (
                <span className={styles.queueEmptyText}>Queue Empty (No Backlog)</span>
              ) : (
                <>
                  {Array.from({ length: visibleQueueCount }).map((_, idx) => (
                    <div
                      key={idx}
                      className={`${styles.queueBlock} ${
                        snapshot.currentHealthSetting.latencyMultiplier > 1 ? styles.queueBlockWarning : ''
                      }`}
                    />
                  ))}
                  {overflowQueueCount > 0 && (
                    <span className={styles.queueOverflowText}>+{overflowQueueCount}</span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Worker Threads Grid (2 rows x 4 cols) */}
          <div className={styles.metricSection}>
            <span className={styles.sectionLabel}>
              Worker Threads ({snapshot.activeWorkers} / {snapshot.workers.length} active)
            </span>

            <div className={styles.workersGrid}>
              {snapshot.workers.map((w) => (
                <div
                  key={w.id}
                  className={`${styles.workerBox} ${
                    w.busy ? (isOutage ? styles.workerOutage : styles.workerBusy) : ''
                  }`}
                >
                  <span className={styles.workerId}>W{w.id}</span>
                  <span className={`${styles.workerStatus} ${!w.busy ? styles.workerIdle : ''}`}>
                    {w.busy ? `Att #${w.currentAttemptId}` : 'IDLE'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
