import { describe, it, expect } from 'vitest';
import { PriorityQueue } from '../priorityQueue';
import { EventPriority } from '../types';

describe('PriorityQueue', () => {
  it('pops events in ascending timestamp order', () => {
    const pq = new PriorityQueue();
    pq.push({
      type: 'LOGICAL_ARRIVAL',
      atMs: 200,
      priority: EventPriority.LOGICAL_ARRIVAL,
      insertionSeq: 1,
    });
    pq.push({
      type: 'LOGICAL_ARRIVAL',
      atMs: 50,
      priority: EventPriority.LOGICAL_ARRIVAL,
      insertionSeq: 2,
    });
    pq.push({
      type: 'LOGICAL_ARRIVAL',
      atMs: 120,
      priority: EventPriority.LOGICAL_ARRIVAL,
      insertionSeq: 3,
    });

    expect(pq.pop()?.atMs).toBe(50);
    expect(pq.pop()?.atMs).toBe(120);
    expect(pq.pop()?.atMs).toBe(200);
    expect(pq.isEmpty()).toBe(true);
  });

  it('breaks ties at equal timestamps using priority', () => {
    const pq = new PriorityQueue();

    // Priority 2: ATTEMPT_TIMEOUT
    pq.push({
      type: 'ATTEMPT_TIMEOUT',
      atMs: 100,
      priority: EventPriority.ATTEMPT_TIMEOUT,
      insertionSeq: 1,
      attemptId: 1,
    });

    // Priority 1: SERVICE_COMPLETE (should win over timeout)
    pq.push({
      type: 'SERVICE_COMPLETE',
      atMs: 100,
      priority: EventPriority.SERVICE_COMPLETE,
      insertionSeq: 2,
      workerId: 0,
      attemptId: 1,
      succeeded: true,
    });

    const first = pq.pop();
    expect(first?.type).toBe('SERVICE_COMPLETE');
    const second = pq.pop();
    expect(second?.type).toBe('ATTEMPT_TIMEOUT');
  });

  it('breaks ties at equal timestamp and priority using insertionSeq', () => {
    const pq = new PriorityQueue();
    pq.push({
      type: 'LOGICAL_ARRIVAL',
      atMs: 100,
      priority: EventPriority.LOGICAL_ARRIVAL,
      insertionSeq: 5,
    });
    pq.push({
      type: 'LOGICAL_ARRIVAL',
      atMs: 100,
      priority: EventPriority.LOGICAL_ARRIVAL,
      insertionSeq: 2,
    });

    expect(pq.pop()?.insertionSeq).toBe(2);
    expect(pq.pop()?.insertionSeq).toBe(5);
  });

  it('orders a mixed timestamp collision by priority, then insertion order', () => {
    const pq = new PriorityQueue();
    const atMs = 250;

    // Insert in an order different from the expected pop order. Events with
    // equal timestamps use lower priority values first, then insertionSeq.
    pq.push({
      type: 'LOGICAL_ARRIVAL',
      atMs,
      priority: EventPriority.LOGICAL_ARRIVAL,
      insertionSeq: 1,
    });
    pq.push({
      type: 'ATTEMPT_TIMEOUT',
      atMs,
      priority: EventPriority.ATTEMPT_TIMEOUT,
      insertionSeq: 3,
      attemptId: 1,
    });
    pq.push({
      type: 'SERVICE_COMPLETE',
      atMs,
      priority: EventPriority.SERVICE_COMPLETE,
      insertionSeq: 4,
      workerId: 0,
      attemptId: 1,
      succeeded: true,
    });
    pq.push({
      type: 'ATTEMPT_DISPATCH',
      atMs,
      priority: EventPriority.ATTEMPT_DISPATCH,
      insertionSeq: 2,
      logicalRequestId: 2,
      attemptNumber: 1,
      isRetry: false,
    });

    expect([pq.pop()?.type, pq.pop()?.type, pq.pop()?.type, pq.pop()?.type]).toEqual([
      'SERVICE_COMPLETE',
      'ATTEMPT_TIMEOUT',
      'LOGICAL_ARRIVAL',
      'ATTEMPT_DISPATCH',
    ]);
  });
});
