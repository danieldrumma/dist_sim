export enum EventPriority {
  SERVICE_COMPLETE = 1,
  ATTEMPT_TIMEOUT = 2,
  PROFILE_CHANGE = 3,
  BREAKER_COOLDOWN_EXPIRED = 3,
  LOGICAL_ARRIVAL = 4,
  ATTEMPT_DISPATCH = 4,
  METRICS_SAMPLE = 5,
}

export type LogicalRequestState = 'pending' | 'succeeded' | 'failed';

export interface LogicalRequest {
  id: number;
  createdAtMs: number;
  state: LogicalRequestState;
  attemptsCreated: number;
  completedAtMs?: number;
  failureReason?: 'timeout' | 'service_error' | 'circuit_open';
}

export type AttemptClientState =
  | 'waiting'
  | 'timed_out'
  | 'succeeded'
  | 'failed'
  | 'rejected';

export type AttemptServerState =
  | 'not_admitted'
  | 'queued'
  | 'processing'
  | 'completed';

export interface Attempt {
  id: number;
  logicalRequestId: number;
  attemptNumber: number;
  dispatchedAtMs: number;
  deadlineAtMs: number;
  clientState: AttemptClientState;
  serverState: AttemptServerState;
  isRetry: boolean;
  isHalfOpenProbe: boolean;
}

export interface WorkerSlot {
  id: number;
  busy: boolean;
  currentAttemptId?: number;
  startedAtMs?: number;
  finishesAtMs?: number;
}

export type SimulationEvent =
  | {
      type: 'LOGICAL_ARRIVAL';
      atMs: number;
      priority: EventPriority.LOGICAL_ARRIVAL;
      insertionSeq: number;
    }
  | {
      type: 'ATTEMPT_DISPATCH';
      atMs: number;
      priority: EventPriority.ATTEMPT_DISPATCH;
      insertionSeq: number;
      logicalRequestId: number;
      attemptNumber: number;
    }
  | {
      type: 'SERVICE_COMPLETE';
      atMs: number;
      priority: EventPriority.SERVICE_COMPLETE;
      insertionSeq: number;
      workerId: number;
      attemptId: number;
      succeeded: boolean;
    }
  | {
      type: 'ATTEMPT_TIMEOUT';
      atMs: number;
      priority: EventPriority.ATTEMPT_TIMEOUT;
      insertionSeq: number;
      attemptId: number;
    }
  | {
      type: 'METRICS_SAMPLE';
      atMs: number;
      priority: EventPriority.METRICS_SAMPLE;
      insertionSeq: number;
    };

export interface ServiceProfile {
  meanServiceMs: number;
  failureProbability: number;
}

export interface EngineConfig {
  seed: number;
  arrivalRateRps: number;
  concurrency: number;
  meanServiceMs: number;
}

export interface EngineSnapshot {
  timeMs: number;
  queueDepth: number;
  queuedAttemptIds: number[];
  activeWorkers: number;
  workers: WorkerSlot[];
  totalArrivals: number;
  totalAttempts: number;
  completedServiceCount: number;
}
