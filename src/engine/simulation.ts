import { CircuitBreaker, createCircuitBreaker } from './circuitBreaker';
import { PriorityQueue } from './priorityQueue';
import { SimulationRandom } from './random';
import { calculateRetryDelayMs } from './retryPolicy';
import {
  Attempt,
  EngineConfig,
  EngineSnapshot,
  EventPriority,
  LogicalRequest,
  SimulationEvent,
  SystemHealthSetting,
  WorkerSlot,
} from './types';

export class SimulationEngine {
  private config: EngineConfig;
  private currentTimeMs: number = 0;
  private pq: PriorityQueue = new PriorityQueue();
  private rng: SimulationRandom;
  private breaker: CircuitBreaker;
  private insertionSeqCounter: number = 0;

  private logicalRequests: Map<number, LogicalRequest> = new Map();
  private attempts: Map<number, Attempt> = new Map();
  private fifoQueue: number[] = [];
  private workers: WorkerSlot[] = [];

  private nextLogicalRequestId: number = 1;
  private nextAttemptId: number = 1;

  // Outcome and event counters
  private completedServiceCount: number = 0;
  private timedOutAttemptsCount: number = 0;
  private lateCompletionCount: number = 0;
  private retryAttemptsCount: number = 0;
  private succeededRequestsCount: number = 0;
  private failedRequestsCount: number = 0;
  private serviceErrorCount: number = 0;
  private shortCircuitedCount: number = 0;

  private currentHealthSetting: SystemHealthSetting = {
    latencyMultiplier: 1.0,
    failureProbability: 0.0,
  };

  constructor(config: EngineConfig) {
    this.config = config;
    this.rng = new SimulationRandom(config.seed);
    this.breaker = createCircuitBreaker(
      config.circuitBreaker ?? { enabled: false }
    );

    // Initialize worker pool
    for (let i = 0; i < config.concurrency; i++) {
      this.workers.push({
        id: i,
        busy: false,
      });
    }

    // Schedule any fault/health setting phases
    if (config.scheduledPhases) {
      for (const phase of config.scheduledPhases) {
        this.scheduleEvent({
          type: 'HEALTH_SETTING_CHANGE',
          atMs: phase.atMs,
          priority: EventPriority.HEALTH_SETTING_CHANGE,
          healthSetting: phase.healthSetting,
        });
      }
    }

    // Schedule steady Poisson traffic or default initial arrival if not in burst mode
    if (!config.burstArrivals) {
      this.scheduleEvent({
        type: 'LOGICAL_ARRIVAL',
        atMs: 0,
        priority: EventPriority.LOGICAL_ARRIVAL,
      });
    }

    // Schedule one-time traffic burst if configured
    if (config.burstArrivals && config.burstArrivals.count > 0) {
      for (let i = 0; i < config.burstArrivals.count; i++) {
        this.scheduleEvent({
          type: 'LOGICAL_ARRIVAL',
          atMs: config.burstArrivals.atMs,
          priority: EventPriority.LOGICAL_ARRIVAL,
        });
      }
    }
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
      timedOutAttemptsCount: this.timedOutAttemptsCount,
      lateCompletionCount: this.lateCompletionCount,
      retryAttemptsCount: this.retryAttemptsCount,
      succeededRequestsCount: this.succeededRequestsCount,
      failedRequestsCount: this.failedRequestsCount,
      serviceErrorCount: this.serviceErrorCount,
      shortCircuitedCount: this.shortCircuitedCount,
      breakerState: this.breaker.getState(),
      currentHealthSetting: { ...this.currentHealthSetting },
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
          isRetry: boolean;
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
          type: 'HEALTH_SETTING_CHANGE';
          atMs: number;
          priority: EventPriority.HEALTH_SETTING_CHANGE;
          healthSetting: SystemHealthSetting;
        }
      | {
          type: 'BREAKER_COOLDOWN_EXPIRED';
          atMs: number;
          priority: EventPriority.BREAKER_COOLDOWN_EXPIRED;
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
      case 'ATTEMPT_DISPATCH':
        this.dispatchAttempt(event.logicalRequestId, event.attemptNumber, event.isRetry);
        break;
      case 'SERVICE_COMPLETE':
        this.handleServiceComplete(event.workerId, event.attemptId, event.succeeded);
        break;
      case 'ATTEMPT_TIMEOUT':
        this.handleAttemptTimeout(event.attemptId);
        break;
      case 'HEALTH_SETTING_CHANGE':
        this.currentHealthSetting = { ...event.healthSetting };
        break;
      case 'BREAKER_COOLDOWN_EXPIRED':
        this.breaker.handleCooldownExpired();
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

    // Dispatch Attempt #1
    this.dispatchAttempt(reqId, 1, false);

    // Schedule next Poisson arrival if running steady traffic
    if (this.config.arrivalRateRps > 0) {
      const deltaMs = this.rng.get('arrival').nextExponential(this.config.arrivalRateRps);
      this.scheduleEvent({
        type: 'LOGICAL_ARRIVAL',
        atMs: this.currentTimeMs + deltaMs,
        priority: EventPriority.LOGICAL_ARRIVAL,
      });
    }
  };

  private dispatchAttempt = (
    logicalRequestId: number,
    attemptNumber: number,
    isRetry: boolean
  ): void => {
    const request = this.logicalRequests.get(logicalRequestId);
    if (!request || request.state !== 'pending') {
      return;
    }

    // Circuit Breaker check
    const check = this.breaker.canAttempt();
    if (!check.allowed) {
      // Breaker is OPEN (or HALF_OPEN probe in-flight): short-circuit!
      const attemptId = this.nextAttemptId++;
      const rejectedAttempt: Attempt = {
        id: attemptId,
        logicalRequestId,
        attemptNumber,
        dispatchedAtMs: this.currentTimeMs,
        deadlineAtMs: this.currentTimeMs,
        clientState: 'rejected',
        serverState: 'not_admitted',
        isRetry,
        isHalfOpenProbe: false,
      };
      this.attempts.set(attemptId, rejectedAttempt);

      this.shortCircuitedCount++;
      // Short-circuits fail fast and are NOT retried
      request.state = 'failed';
      request.failureReason = 'circuit_open';
      request.completedAtMs = this.currentTimeMs;
      this.failedRequestsCount++;
      return;
    }

    // Attempt admitted by circuit breaker
    const attemptId = this.nextAttemptId++;
    const deadlineAtMs = this.currentTimeMs + this.config.timeoutMs;

    const attempt: Attempt = {
      id: attemptId,
      logicalRequestId,
      attemptNumber,
      dispatchedAtMs: this.currentTimeMs,
      deadlineAtMs,
      clientState: 'waiting',
      serverState: 'queued',
      isRetry,
      isHalfOpenProbe: check.isHalfOpenProbe,
    };
    this.attempts.set(attemptId, attempt);

    if (isRetry) {
      this.retryAttemptsCount++;
    }

    // Schedule timeout deadline
    this.scheduleEvent({
      type: 'ATTEMPT_TIMEOUT',
      atMs: deadlineAtMs,
      priority: EventPriority.ATTEMPT_TIMEOUT,
      attemptId,
    });

    // Enqueue for worker processing
    this.fifoQueue.push(attemptId);
    this.drainQueue();
  };

  private handleAttemptTimeout = (attemptId: number): void => {
    const attempt = this.attempts.get(attemptId);
    if (!attempt || attempt.clientState !== 'waiting') {
      return;
    }

    attempt.clientState = 'timed_out';
    this.timedOutAttemptsCount++;

    // Record failure in circuit breaker
    const tripped = this.breaker.recordFailure();
    if (tripped) {
      this.scheduleEvent({
        type: 'BREAKER_COOLDOWN_EXPIRED',
        atMs: this.currentTimeMs + this.breaker.getOpenDurationMs(),
        priority: EventPriority.BREAKER_COOLDOWN_EXPIRED,
      });
    }

    const request = this.logicalRequests.get(attempt.logicalRequestId);
    if (!request || request.state !== 'pending') {
      return;
    }

    this.evaluateRetryOrFailure(request, 'timeout');
  };

  private handleServiceComplete = (
    workerId: number,
    attemptId: number,
    succeeded: boolean
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

      if (attempt.clientState === 'timed_out') {
        // Late / wasted work
        this.lateCompletionCount++;
      } else if (attempt.clientState === 'waiting') {
        const request = this.logicalRequests.get(attempt.logicalRequestId);

        if (succeeded) {
          // Success: reset consecutive breaker failures or close half-open
          this.breaker.recordSuccess();

          attempt.clientState = 'succeeded';
          if (request && request.state === 'pending') {
            request.state = 'succeeded';
            request.completedAtMs = this.currentTimeMs;
            this.succeededRequestsCount++;
          }
        } else {
          // 5xx service failure: record failure in circuit breaker
          attempt.clientState = 'failed';
          this.serviceErrorCount++;

          const tripped = this.breaker.recordFailure();
          if (tripped) {
            this.scheduleEvent({
              type: 'BREAKER_COOLDOWN_EXPIRED',
              atMs: this.currentTimeMs + this.breaker.getOpenDurationMs(),
              priority: EventPriority.BREAKER_COOLDOWN_EXPIRED,
            });
          }

          if (request && request.state === 'pending') {
            this.evaluateRetryOrFailure(request, 'service_error');
          }
        }
      }
    }

    this.completedServiceCount++;
    this.drainQueue();
  };

  private evaluateRetryOrFailure = (
    request: LogicalRequest,
    failureReason: 'timeout' | 'service_error'
  ): void => {
    const policy = this.config.retryPolicy;
    const canRetry = policy.mode !== 'none' && request.attemptsCreated < policy.maxAttempts;

    if (canRetry) {
      const retryNumber = request.attemptsCreated;
      request.attemptsCreated++;

      const delayMs = calculateRetryDelayMs(policy, retryNumber, this.rng.get('jitter'));

      if (delayMs === 0) {
        this.dispatchAttempt(request.id, request.attemptsCreated, true);
      } else {
        this.scheduleEvent({
          type: 'ATTEMPT_DISPATCH',
          atMs: this.currentTimeMs + delayMs,
          priority: EventPriority.ATTEMPT_DISPATCH,
          logicalRequestId: request.id,
          attemptNumber: request.attemptsCreated,
          isRetry: true,
        });
      }
    } else {
      request.state = 'failed';
      request.failureReason = failureReason;
      request.completedAtMs = this.currentTimeMs;
      this.failedRequestsCount++;
    }
  };

  private drainQueue = (): void => {
    while (this.fifoQueue.length > 0) {
      const idleWorker = this.findIdleWorker();
      if (!idleWorker) {
        break;
      }

      const attemptId = this.fifoQueue.shift()!;
      const attempt = this.attempts.get(attemptId)!;

      const baseMean = this.config.meanServiceMs * this.currentHealthSetting.latencyMultiplier;
      const durationMs = this.rng.get('service').nextBoundedUniform(baseMean);
      const finishesAtMs = this.currentTimeMs + durationMs;

      const hasFailure = this.rng
        .get('failure')
        .nextBoolean(this.currentHealthSetting.failureProbability);

      idleWorker.busy = true;
      idleWorker.currentAttemptId = attemptId;
      idleWorker.startedAtMs = this.currentTimeMs;
      idleWorker.finishesAtMs = finishesAtMs;

      attempt.serverState = 'processing';

      this.scheduleEvent({
        type: 'SERVICE_COMPLETE',
        atMs: finishesAtMs,
        priority: EventPriority.SERVICE_COMPLETE,
        workerId: idleWorker.id,
        attemptId,
        succeeded: !hasFailure,
      });
    }
  };

  private findIdleWorker = (): WorkerSlot | undefined => {
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
