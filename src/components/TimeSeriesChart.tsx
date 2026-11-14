import { memo } from 'react';
import { MetricSample } from '../engine/metrics';
import styles from './TimeSeriesChart.module.css';

interface TimeSeriesChartProps {
  samples: MetricSample[];
  sampleCount: number;
  maxDurationMs: number;
}

const TimeSeriesChartView = ({ samples, maxDurationMs }: TimeSeriesChartProps) => {
  if (samples.length < 2) {
    return (
      <div className={styles.emptyState}>
        Waiting for simulation telemetry...
      </div>
    );
  }

  let maxRate = 10;
  let maxQueue = 10;

  for (const s of samples) {
    if (s.ingressRps > maxRate) maxRate = s.ingressRps;
    if (s.attemptRps > maxRate) maxRate = s.attemptRps;
    if (s.queueDepth > maxQueue) maxQueue = s.queueDepth;
  }

  maxRate = Math.ceil(maxRate * 1.25);
  maxQueue = Math.max(10, Math.ceil(maxQueue * 1.2));

  const chartWidth = 400;
  const chartHeight = 150;
  const padding = { top: 20, right: 20, bottom: 25, left: 35 };

  const innerWidth = chartWidth - padding.left - padding.right;
  const innerHeight = chartHeight - padding.top - padding.bottom;

  const getX = (timeMs: number) => padding.left + (timeMs / maxDurationMs) * innerWidth;
  const getYRate = (val: number) => padding.top + innerHeight - (val / maxRate) * innerHeight;
  const getYQueue = (val: number) => padding.top + innerHeight - (val / maxQueue) * innerHeight;

  const generatePath = (getY: (s: MetricSample) => number): string => {
    return samples
      .map((s, idx) => {
        const x = getX(s.timeMs);
        const y = getY(s);
        return `${idx === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const ingressPath = generatePath((s) => getYRate(s.ingressRps));
  const attemptPath = generatePath((s) => getYRate(s.attemptRps));
  const retryPath = generatePath((s) => getYRate(s.retryRps));

  const queueLine = generatePath((s) => getYQueue(s.queueDepth));
  const queueArea = `${queueLine} L ${getX(samples[samples.length - 1].timeMs).toFixed(1)} ${(
    padding.top + innerHeight
  ).toFixed(1)} L ${getX(samples[0].timeMs).toFixed(1)} ${(padding.top + innerHeight).toFixed(1)} Z`;

  return (
    <div className={styles.grid}>
      {/* Chart 1: Traffic Rates */}
      <div className={styles.chartCard}>
        <div className={styles.headerRow}>
          <span className={styles.chartTitle}>Traffic Rates (1s Window)</span>
          <div className={styles.legend}>
            <span style={{ color: '#ffffff' }}>— Ingress</span>
            <span style={{ color: 'var(--color-cyan)' }}>— Total Attempts</span>
            <span style={{ color: 'var(--color-warning)' }}>— Retries</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <line
            x1={padding.left}
            y1={padding.top + innerHeight}
            x2={chartWidth - padding.right}
            y2={padding.top + innerHeight}
            stroke="var(--border-subtle)"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={chartWidth - padding.right}
            y2={padding.top}
            stroke="var(--border-subtle)"
            strokeDasharray="2,2"
          />

          <text x={padding.left - 6} y={padding.top + 4} textAnchor="end" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">
            {maxRate}
          </text>
          <text x={padding.left - 6} y={padding.top + innerHeight} textAnchor="end" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">
            0
          </text>

          <path d={ingressPath} fill="none" stroke="#ffffff" strokeWidth="1.5" strokeOpacity="0.8" />
          <path d={attemptPath} fill="none" stroke="var(--color-cyan)" strokeWidth="1.5" />
          <path d={retryPath} fill="none" stroke="var(--color-warning)" strokeWidth="1.8" />
        </svg>
      </div>

      {/* Chart 2: Queue Depth */}
      <div className={styles.chartCard}>
        <div className={styles.headerRow}>
          <span className={styles.chartTitle}>Waiting Queue Depth</span>
          <span style={{ fontSize: '0.7rem', color: 'var(--color-warning)' }}>Peak: {maxQueue}</span>
        </div>

        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
          <defs>
            <linearGradient id="queueAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          <line
            x1={padding.left}
            y1={padding.top + innerHeight}
            x2={chartWidth - padding.right}
            y2={padding.top + innerHeight}
            stroke="var(--border-subtle)"
          />

          <text x={padding.left - 6} y={padding.top + 4} textAnchor="end" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">
            {maxQueue}
          </text>
          <text x={padding.left - 6} y={padding.top + innerHeight} textAnchor="end" fill="var(--text-muted)" fontSize="9" fontFamily="var(--font-mono)">
            0
          </text>

          <path d={queueArea} fill="url(#queueAreaGradient)" />
          <path d={queueLine} fill="none" stroke="#f59e0b" strokeWidth="1.5" />
        </svg>
      </div>
    </div>
  );
};

export const TimeSeriesChart = memo(
  TimeSeriesChartView,
  (previous, next) =>
    previous.sampleCount === next.sampleCount &&
    previous.maxDurationMs === next.maxDurationMs
);
