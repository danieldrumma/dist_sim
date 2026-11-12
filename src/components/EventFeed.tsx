import { useEffect, useRef } from 'react';
import { EngineLogEntry, EngineSnapshot } from '../engine/types';
import styles from './EventFeed.module.css';

interface EventFeedProps {
  logs: EngineLogEntry[];
  snapshot: EngineSnapshot;
}

export const EventFeed = ({ logs, snapshot }: EventFeedProps) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef<boolean>(true);

  // Auto-scroll to bottom as new events fly in
  useEffect(() => {
    if (autoScrollRef.current && terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const handleScroll = () => {
    if (!terminalRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = terminalRef.current;
    // If user scrolled up by more than 30px, disable auto-scroll
    autoScrollRef.current = scrollHeight - (scrollTop + clientHeight) < 30;
  };

  const getBadgeClass = (category: EngineLogEntry['category']) => {
    return styles[`badge${category}`] || styles.badgeINGRESS;
  };

  return (
    <div className={styles.container}>
      {/* Feed Header */}
      <div className={styles.headerRow}>
        <div className={styles.titleGroup}>
          <span className={styles.liveDot} />
          <span className={styles.title}>Live Telemetry & Event Stream</span>
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
          {logs.length} events logged
        </div>
      </div>

      {/* Terminal Viewport */}
      <div className={styles.terminalWindow} ref={terminalRef} onScroll={handleScroll}>
        {logs.length === 0 ? (
          <div className={styles.emptyState}>Simulation initialized. Run simulation to stream events...</div>
        ) : (
          logs.map((entry) => (
            <div key={entry.id} className={styles.logRow}>
              <span className={styles.timestamp}>[{(entry.timeMs / 1000).toFixed(2)}s]</span>
              <span className={`${styles.badge} ${getBadgeClass(entry.category)}`}>
                {entry.category}
              </span>
              <span
                className={`${styles.message} ${
                  entry.level === 'error' || entry.level === 'warn' ? styles.msgHighlight : ''
                }`}
              >
                {entry.message}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Pinned Telemetry Summary Bar */}
      <div className={styles.summaryBar}>
        <div className={styles.summaryGroup}>
          <div className={styles.summaryItem}>
            <span>Arrivals:</span>
            <span className={styles.statVal}>{snapshot.totalArrivals}</span>
          </div>
          <div className={styles.summaryItem}>
            <span>Attempts:</span>
            <span className={styles.statVal}>{snapshot.totalAttempts}</span>
          </div>
          <div className={styles.summaryItem}>
            <span>Succeeded:</span>
            <span className={styles.statVal} style={{ color: 'var(--color-healthy)' }}>
              {snapshot.succeededRequestsCount}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span>Timeouts:</span>
            <span className={styles.statVal} style={{ color: snapshot.timedOutAttemptsCount > 0 ? 'var(--color-warning)' : 'inherit' }}>
              {snapshot.timedOutAttemptsCount}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span>Retries:</span>
            <span className={styles.statVal} style={{ color: snapshot.retryAttemptsCount > 0 ? 'var(--color-warning)' : 'inherit' }}>
              {snapshot.retryAttemptsCount}
            </span>
          </div>
          <div className={styles.summaryItem}>
            <span>Wasted Work:</span>
            <span className={styles.statVal} style={{ color: snapshot.lateCompletionCount > 0 ? 'var(--color-danger)' : 'inherit' }}>
              {snapshot.lateCompletionCount}
            </span>
          </div>
          {snapshot.shortCircuitedCount > 0 && (
            <div className={styles.summaryItem}>
              <span>Short-Circuited:</span>
              <span className={styles.statVal} style={{ color: 'var(--color-danger)' }}>
                {snapshot.shortCircuitedCount}
              </span>
            </div>
          )}
        </div>

        <div style={{ color: 'var(--text-muted)' }}>
          Queue: <span className={styles.statVal}>{snapshot.queueDepth}</span> | Active:{' '}
          <span className={styles.statVal}>
            {snapshot.activeWorkers}/{snapshot.workers.length}
          </span>
        </div>
      </div>
    </div>
  );
};
