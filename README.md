# Dist Sim

**Dist Sim** is an interactive reliability engineering playground designed to make distributed-systems failures visible, understandable, and interactive.

Instead of reading about cascading failures in textbooks or wrestling with heavyweight cloud testbeds, Dist Sim lets engineers observe a healthy service, inject downstream latency or outages, watch requests queue and retry into an amplified storm, and experiment in real time with resilience mechanisms like exponential backoff, full jitter, and circuit breakers.

---

## The Vision & Core Scenarios

Dist Sim models a caller (Checkout API) interacting with a downstream dependency (Payment Service) backed by a 100% deterministic, discrete-event simulation running entirely in the browser.

Engineers explore three primary interactive experiments:

1. **The Retry Storm (Showcase):**
   A downstream payment service suffers a temporary latency spike. Client timeouts fire, immediate retries multiply offered load, and the service collapses under self-inflicted retry traffic—even after the original downstream fault has cleared. Mitigated via exponential backoff and request caps.
2. **The Thundering Herd (Jitter Experiment):**
   A burst of simultaneous requests times out together. Without jitter, retries synchronize into recurring waves of traffic spikes. With full jitter, retries spread smoothly across time.
3. **The Circuit Breaker:**
   Repeated downstream 5xx errors trip a client-side circuit breaker into `OPEN` state, instantly short-circuiting calls to protect the dependency. After a cooldown, a single `HALF_OPEN` probe verifies health before traffic safely resumes.

---

## Architectural Design

Dist Sim strictly decouples the simulation mechanics from the presentation layer:

```text
┌─────────────────────────────────────────────────────────────┐
│                        React UI                             │
│   (Playback controls, animated topology, time-series charts)│
└──────────────────────────────▲──────────────────────────────┘
                               │ Reads immutable snapshots
                               │ (timeMs, queue depth, workers)
┌──────────────────────────────┴──────────────────────────────┐
│                Discrete-Event Simulation Engine             │
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
│   │ Event Loop (advanceTo)                              │   │
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

### Core Invariants & Engineering Guarantees
- **Discrete-Event Simulation (DES):** Simulated time jumps directly between scheduled events (`advanceTo(targetTimeMs)`). The UI frame rate (`requestAnimationFrame`) never alters simulation outcomes.
- **Seeded Multi-Stream Determinism:** Uses Mulberry32 PRNG streams derived from a master seed. Consuming random numbers for retry jitter never perturbs the request arrival schedule, enabling true A/B comparisons.
- **Non-Cancelling Timeouts:** Client deadlines include queue wait time but do not cancel server work in progress—accurately modeling real-world wasted work.
- **Chunk-Size Invariance:** Advancing the simulation in small increments (e.g. 10ms steps) produces the exact same state and trace as advancing in one single leap.

---

## Current Status & Checkpoint

- [x] **Engine Foundation:**
  - Deterministic min-heap priority queue with priority tie-breaking.
  - Multi-stream seeded PRNG (arrivals, service times, failures, jitter).
  - Poisson arrival process and bounded uniform service times.
  - Finite worker concurrency pool and FIFO queue.
  - Comprehensive unit test suite (12/12 passing).
  - Live baseline inspector with real-time speed control (`0.1x` to `3.0x`), step-forward, and pause/reset.
- [ ] **Next Up (Resilience & Scenarios):**
  - Per-attempt client deadlines, timeout events, and late-work tracking.
  - Retry policies (Immediate, Exponential, Full Jitter) and attempt bounds.
  - Circuit breaker state machine (`CLOSED`, `OPEN`, `HALF_OPEN`).
  - Animated SVG topology diagram and time-series queue/rate charts.

---

## Getting Started

### Prerequisites
- Node.js (v18+)
- npm (v9+)

### Installation

```bash
# Clone the repository
git clone git@github.com:danieldrumma/dist_sim.git
cd dist_sim

# Install dependencies
npm install
```

### Development Server

Start the local development server:

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

Type-check and compile the production bundle:

```bash
npm run build
```
