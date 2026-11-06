import { SimulationEvent } from './types';

export class PriorityQueue {
  private heap: SimulationEvent[] = [];

  public get size(): number {
    return this.heap.length;
  }

  public isEmpty(): boolean {
    return this.heap.length === 0;
  }

  public peek(): SimulationEvent | undefined {
    return this.heap[0];
  }

  public push(event: SimulationEvent): void {
    this.heap.push(event);
    this.siftUp(this.heap.length - 1);
  }

  public pop(): SimulationEvent | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const bottom = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this.siftDown(0);
    }
    return top;
  }

  public clear(): void {
    this.heap = [];
  }

  private compare(a: SimulationEvent, b: SimulationEvent): number {
    if (a.atMs !== b.atMs) {
      return a.atMs - b.atMs;
    }
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.insertionSeq - b.insertionSeq;
  }

  private siftUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.compare(this.heap[current], this.heap[parent]) < 0) {
        this.swap(current, parent);
        current = parent;
      } else {
        break;
      }
    }
  }

  private siftDown(index: number): void {
    let current = index;
    const length = this.heap.length;

    while (true) {
      const left = 2 * current + 1;
      const right = 2 * current + 2;
      let smallest = current;

      if (left < length && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest !== current) {
        this.swap(current, smallest);
        current = smallest;
      } else {
        break;
      }
    }
  }

  private swap(i: number, j: number): void {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
  }
}
