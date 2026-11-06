import { PriorityQueue } from './priorityQueue';
import { SimulationRandom } from './random';
import {
  Attempt,
  EngineConfig,
  EngineSnapshot,
  EventPriority,
  LogicalRequest,
  ServiceProfile,
  SimulationEvent,
  WorkerSlot,
} from './types';

export class SimulationEngine {
  private config: EngineConfig;
  private currentTimeMs: number = 0;
  private pq: PriorityQueue = new PriorityQueue();
  private rng: SimulationRandom;
  private insertionSeqCounter: number = 0;

  private logicalRequests: Map<number, LogicalRequest> = new Map();
  private attempts: Map<number, Attempt> = new Map();
  private fifoQueue: number[] = [];
  private workers: WorkerSlot[] = [];

  private nextLogicalRequestId: number = 1;
  private nextAttemptId: number = 1;
  private completedServiceCount: number = 0;

  private activeProfile: ServiceProfile;

  constructor(config: EngineConfig) {
    this.config = config;
    this.rng = new SimulationRandom(config.seed);
    this.activeProfile = {
      meanServiceMs: config.meanServiceMs,
      failureProbability: 0,
    };

    // Initialize worker pool
    for (let i = 0; i < config.concurrency; i++) {
      this.workers.push({
        id: i,
        busy: false,
      });
    }

    // Schedule the very first logical arrival at t = 0
    this.scheduleEvent({
      type: 'LOGICAL_ARRIVAL',
      atMs: 0,
      priority: EventPriority.LOGICAL_ARRIVAL,
    });
  }

  public advanceTo = (targetTimeMs: number): void => {
    if (targetTimeMs < this.currentTimeMs) {
      return;
    }

    while (!this.pq.isEmpty()) {
      const nextEvent = this.pq.peek()!;
      if (nextEvent.atMs > targetTimeMs) {
        break;
      }

      const event = this.pq.pop()!;
      this.currentTimeMs = event.atMs;
      this.processEvent(event);
    }

    this.currentTimeMs = targetTimeMs;
  };

  public getSnapshot = (): EngineSnapshot => {
    let activeWorkers = 0;
    for (const w of this.workers) {
      if (w.busy) activeWorkers++;
    }

    return {
      timeMs: this.currentTimeMs,
      queueDepth: this.fifoQueue.length,
      queuedAttemptIds: [...this.fifoQueue],
      activeWorkers,
      workers: this.workers.map((w) => ({ ...w })),
      totalArrivals: this.logicalRequests.size,
      totalAttempts: this.attempts.size,
      completedServiceCount: this.completedServiceCount,
    };
  };

  private scheduleEvent = (
    eventData:
      | { type: 'LOGICAL_ARRIVAL'; atMs: number; priority: EventPriority.LOGICAL_ARRIVAL }
      | {
          type: 'ATTEMPT_DISPATCH';
          atMs: number;
          priority: EventPriority.ATTEMPT_DISPATCH;
          logicalRequestId: number;
          attemptNumber: number;
        }
      | {
          type: 'SERVICE_COMPLETE';
          atMs: number;
          priority: EventPriority.SERVICE_COMPLETE;
          workerId: number;
          attemptId: number;
          succeeded: boolean;
        }
      | {
          type: 'ATTEMPT_TIMEOUT';
          atMs: number;
          priority: EventPriority.ATTEMPT_TIMEOUT;
          attemptId: number;
        }
      | {
          type: 'METRICS_SAMPLE';
          atMs: number;
          priority: EventPriority.METRICS_SAMPLE;
        }
  ): void => {
    const insertionSeq = ++this.insertionSeqCounter;
    const fullEvent = {
      ...eventData,
      insertionSeq,
    } as SimulationEvent;
    this.pq.push(fullEvent);
  };

  private processEvent = (event: SimulationEvent): void => {
    switch (event.type) {
      case 'LOGICAL_ARRIVAL':
        this.handleLogicalArrival();
        break;
      case 'SERVICE_COMPLETE':
        this.handleServiceComplete(event.workerId, event.attemptId, event.succeeded);
        break;
      default:
        break;
    }
  };

  private handleLogicalArrival = (): void => {
    const reqId = this.nextLogicalRequestId++;
    const request: LogicalRequest = {
      id: reqId,
      createdAtMs: this.currentTimeMs,
      state: 'pending',
      attemptsCreated: 1,
    };
    this.logicalRequests.set(reqId, request);

    // Create the first attempt
    const attemptId = this.nextAttemptId++;
    const attempt: Attempt = {
      id: attemptId,
      logicalRequestId: reqId,
      attemptNumber: 1,
      dispatchedAtMs: this.currentTimeMs,
      deadlineAtMs: Infinity, // Timeouts not enabled in baseline task
      clientState: 'waiting',
      serverState: 'queued',
      isRetry: false,
      isHalfOpenProbe: false,
    };
    this.attempts.set(attemptId, attempt);

    // Push to FIFO queue and attempt drain
    this.fifoQueue.push(attemptId);
    this.drainQueue();

    // Schedule next logical arrival using Poisson inter-arrival
    if (this.config.arrivalRateRps > 0) {
      const deltaMs = this.rng.get('arrival').nextExponential(this.config.arrivalRateRps);
      this.scheduleEvent({
        type: 'LOGICAL_ARRIVAL',
        atMs: this.currentTimeMs + deltaMs,
        priority: EventPriority.LOGICAL_ARRIVAL,
      });
    }
  };

  private handleServiceComplete = (
    workerId: number,
    attemptId: number,
    _succeeded: boolean
  ): void => {
    const worker = this.workers[workerId];
    if (worker) {
      worker.busy = false;
      worker.currentAttemptId = undefined;
      worker.startedAtMs = undefined;
      worker.finishesAtMs = undefined;
    }

    const attempt = this.attempts.get(attemptId);
    if (attempt) {
      attempt.serverState = 'completed';
      attempt.clientState = 'succeeded';

      const request = this.logicalRequests.get(attempt.logicalRequestId);
      if (request && request.state === 'pending') {
        request.state = 'succeeded';
        request.completedAtMs = this.currentTimeMs;
      }
    }

    this.completedServiceCount++;

    // Worker freed: drain queue to pick up next waiting attempt
    this.drainQueue();
  };

  private drainQueue = (): void => {
    while (this.fifoQueue.length > 0) {
      const idleWorker = this.findIdleWorker();
      if (!idleWorker) {
        break;
      }

      const attemptId = this.fifoQueue.shift()!;
      const attempt = this.attempts.get(attemptId)!;

      // Sample service duration at the moment work begins
      const durationMs = this.rng
        .get('service')
        .nextBoundedUniform(this.activeProfile.meanServiceMs);

      const finishesAtMs = this.currentTimeMs + durationMs;

      // Assign worker
      idleWorker.busy = true;
      idleWorker.currentAttemptId = attemptId;
      idleWorker.startedAtMs = this.currentTimeMs;
      idleWorker.finishesAtMs = finishesAtMs;

      attempt.serverState = 'processing';

      // Schedule completion
      this.scheduleEvent({
        type: 'SERVICE_COMPLETE',
        atMs: finishesAtMs,
        priority: EventPriority.SERVICE_COMPLETE,
        workerId: idleWorker.id,
        attemptId,
        succeeded: true,
      });
    }
  };

  private findIdleWorker = (): WorkerSlot | undefined => {
    // Pick lowest-index idle worker for deterministic visual behavior
    for (const w of this.workers) {
      if (!w.busy) {
        return w;
      }
    }
    return undefined;
  };
}

export const createSimulation = (config: EngineConfig): SimulationEngine => {
  return new SimulationEngine(config);
};
