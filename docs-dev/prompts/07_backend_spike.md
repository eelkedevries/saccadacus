Active prompt for Phase 7 of `saccadacus`. Read AGENTS.md, CLAUDE.md,
docs-dev/STATUS.md, and the PROPOSAL.md sections below. Phases 1-6 must be done.

Goal
  Run a single throwaway spike of a real tracking backend (MediaPipe Face
  Landmarker) behind the TrackingBackend interface, benchmark it across the
  target browsers, and produce a written decision on the first production
  backend. This is exploratory: the spike must not become the default boot path.

Relevant sections of PROPOSAL.md
  §20 backend abstraction, §25 browser constraints, §26 bundle/test,
  §27 Phase 7.

Relevant files
  A throwaway adapter under src/tracking/backendAdapters/ (the only directory
  permitted to import a CV/face-landmark library), and a decision record under
  docs-dev/decisions/ plus benchmark notes under docs-dev/references/ or
  docs-dev/notes/.

Implementation steps
  1. Implement a MediaPipe Face Landmarker adapter implementing TrackingBackend,
     strictly inside src/tracking/backendAdapters/. `any` is permitted only in
     this directory. processFrame must still echo pageTimestampMs unchanged.
  2. Keep MockTrackingBackend as the default. Do NOT wire the real backend into
     the default boot path (hard rule — real backend only from Phase 8). Load
     the adapter lazily/code-split and only after camera permission (§26). Gate
     it behind an explicit dev-only switch so the spike can run without changing
     the default.
  3. Benchmark on Firefox desktop, Chromium desktop, and Firefox on Android:
     model initialisation latency, per-frame latency, effective frame rate, and
     stability under CPU and WebGL/GPU delegates. Default Firefox to a CPU
     delegate unless GPU is benchmarked faster on the same hardware (§25).
  4. Record measurements and a clear recommendation for the first production
     backend in a decision record under docs-dev/decisions/.

Constraints
  CV imports ONLY inside src/tracking/backendAdapters/. Do not add OpenCV.js or
  WebGazer.js (hard rule). Do not change the default backend. Do not use rVFC
  for pacing or OffscreenCanvas-in-worker. WebGPU is not used in v1 (§25).

Tests
  This is a spike; automated coverage is limited. Add a smoke unit test that the
  adapter satisfies the TrackingBackend type and echoes pageTimestampMs on a
  synthetic frame where feasible. Benchmarks are run manually in-browser. State
  explicitly in the overview which measurements were taken and on which devices,
  and note anything that could not be measured.
  Run `npm run typecheck`, `npm run lint`, `npm run test`.

After completing this prompt
  1. Run the relevant tests.
  2. Fix any failures caused by this task.
  3. Update docs-dev/STATUS.md: Phase 7 -> done with commit SHA (note it is a
     spike + decision record).
  4. Commit with message: 07_backend_spike.
  5. Push to main.

Final overview (mandatory, three parts)
  1. Work completed — including the benchmark results and the recommended
     production backend.
  2. Open issues — measurements not obtainable, device gaps, or `none`.
  3. Human actions required — the human's go-ahead on the chosen backend before
     Phase 8; or `none`.
