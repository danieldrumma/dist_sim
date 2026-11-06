# Dist Sim

An interactive reliability engineering playground for exploring how latency, timeouts, retries, and service capacity interact.

Dist Sim turns abstract distributed-systems failure modes into something you can see, inspect, and reason about. Instead of relying on approximations or complex cloud setups, it runs a 100% client-side, deterministic discrete-event simulation engine in the browser.

---

## Architecture Overview

Dist Sim separates the simulation engine from the presentation layer:

```text
┌─────────────────────────────────────────────────────────────┐
│                        React UI                             │
│   (Wall-clock animation loop via requestAnimationFrame)     │
└──────────────────────────────▲──────────────────────────────┘
                               │ Reads immutable snapshots
                               │ (timeMs, queue, workers)
┌──────────────────────────────┴──────────────────────────────┐
│                    Simulation Engine                        │
│   (Pure TypeScript, zero DOM/browser/timer dependencies)    │
│                                                             │
│   ┌────────────────────┐          ┌─────────────────────┐   │
│   │ Min-Heap Event PQ  │          │ Independent PRNG    │   │
│   │                    │          │ Streams             │   │
│   │ - atMs (timestamp) │◄─────────┤ - arrivals          │   │
│   │ - priority         │          │ - service duration  │   │
│   │ - insertionSeq     │          │ - failures (5xx)    │   │
│   └─────────┬──────────┘          │ - retry jitter      │   │
│             │                     └─────────────────────┘   │
│             ▼                                               │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Event Dispatcher (advanceTo)                        │   │
│   │                                                     │   │
│   │  [Logical Requests] ───► [Attempt Dispatch]         │   │
│   │                                  │                  │   │
│   │                                  ▼                  │   │
│   │                          [FIFO Service Queue]       │   │
│   │                                  │                  │   │
│   │                                  ▼                  │   │
│   │                          [Worker Pool (c slots)]    │   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Key Technical Properties

1. **Discrete-Event Simulation (DES):** Time advances directly from event to event rather than through fixed wall-clock time slices. UI render frame rate has zero impact on simulation results.
2. **Deterministic & Seeded:** Independent pseudo-random streams (Mulberry32 seeded via SplitMix32) ensure that changing retry policies or jitter never alters the incoming request arrival schedule.
3. **Queue & Worker Model:** Models an admitted attempt queue with finite worker concurrency ($c$). Attempts wait in a FIFO queue when all workers are occupied.
4. **Chunk-Size Invariance:** Advancing the simulation in small increments (e.g. 10ms steps) produces the exact same state as advancing in a single large jump.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd dist_sim

# Install dependencies
npm install
```

### Development Server

Start the local Vite dev server:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Running Tests

Run the Vitest test suite:

```bash
npm test
```

### Production Build

Type-check and bundle the static application:

```bash
npm run build
```
