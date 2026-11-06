const splitmix32 = (seed: number): (() => number) => {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x9e3779b9) | 0;
    let t = Math.imul(s ^ (s >>> 16), 0x21f0aaad);
    t = Math.imul(t ^ (t >>> 15), 0x735a2d97);
    return ((t ^ (t >>> 15)) >>> 0);
  };
};

const mulberry32 = (seed: number): (() => number) => {
  let s = seed | 0;
  return (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

export type RandomStreamKind = 'arrival' | 'service' | 'failure' | 'jitter';

const STREAM_OFFSETS: Record<RandomStreamKind, number> = {
  arrival: 0,
  service: 1,
  failure: 2,
  jitter: 3,
};

export class RandomStream {
  private nextFloat: () => number;

  constructor(seed: number) {
    this.nextFloat = mulberry32(seed);
  }

  public next(): number {
    return this.nextFloat();
  }

  public nextExponential(ratePerSec: number): number {
    if (ratePerSec <= 0) {
      return Infinity;
    }
    const u = Math.min(Math.max(this.next(), 1e-7), 1 - 1e-7);
    return (-Math.log(1 - u) * 1000) / ratePerSec;
  }

  public nextBoundedUniform(meanMs: number): number {
    const u = this.next();
    return meanMs * (0.9 + 0.2 * u);
  }

  public nextUniformRange(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  public nextBoolean(probability: number): boolean {
    if (probability <= 0) return false;
    if (probability >= 1) return true;
    return this.next() < probability;
  }
}

export class SimulationRandom {
  private streams: Record<RandomStreamKind, RandomStream>;

  constructor(masterSeed: number) {
    const sm = splitmix32(masterSeed);
    const subSeeds: number[] = [];
    for (let i = 0; i < 4; i++) {
      subSeeds.push(sm());
    }

    this.streams = {
      arrival: new RandomStream(subSeeds[STREAM_OFFSETS.arrival]),
      service: new RandomStream(subSeeds[STREAM_OFFSETS.service]),
      failure: new RandomStream(subSeeds[STREAM_OFFSETS.failure]),
      jitter: new RandomStream(subSeeds[STREAM_OFFSETS.jitter]),
    };
  }

  public get(kind: RandomStreamKind): RandomStream {
    return this.streams[kind];
  }
}
