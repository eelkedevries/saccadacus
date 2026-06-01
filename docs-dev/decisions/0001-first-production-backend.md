# Decision 0001 — First production tracking backend

Status: accepted (confirmed on mobile; desktop rows still welcome)
Date: 2026-06-01
Phase: 7 (backend spike)

## Context

Phase 7 evaluates a real tracking backend behind the `TrackingBackend` interface
(§20) to choose the first production backend implemented in Phase 8. The
candidate is the MediaPipe Face Landmarker (`@mediapipe/tasks-vision`), the only
mature, browser-native face-landmark model that also provides iris landmarks,
head-pose (facial transformation matrices), and blink blendshapes — covering
the eye-local signal (§3), head pose (§6), and blink detection (§7) the product
needs.

Constraints that shape the decision (§25):

- Firefox-first; Chromium second; Firefox on Android must work.
- WebGPU is not used in v1; WASM and WebGL2 are the compute targets.
- Backends should default to a CPU delegate on Firefox unless a GPU delegate is
  benchmarked faster on the same hardware.
- `requestVideoFrameCallback` is not the pacing source; overlay rendering stays
  on the main thread.

## What was built for the spike

- `src/tracking/backendAdapters/mediaPipeFaceLandmarker.ts` — a throwaway
  adapter implementing `TrackingBackend`. It is the only module importing a CV
  library, loads the library with a dynamic import (code-split), and echoes
  `pageTimestampMs` unchanged (§24). It maps iris/eye-corner landmarks through
  the existing pure `projectEyeLocal`, decomposes the facial transformation
  matrix through `decomposeHeadPose`, and derives blink state from blendshapes.
- `src/tracking/backendAdapters/benchmark.ts` — a harness measuring model
  initialisation latency, per-frame latency (mean and p95), and effective frame
  rate under a chosen delegate.
- `src/app/SpikeBenchmark.tsx` — a dev-only page rendered only when the URL has
  `?spike=mediapipe`. It is code-split; the default boot path still renders the
  app with `MockTrackingBackend`. The build confirms `vision_bundle` and
  `SpikeBenchmark` are separate chunks, absent from the main bundle.

## How to gather the measurements

See `docs-dev/references/phase7-benchmark.md`. In short: open the deployed site
with `?spike=mediapipe` on each target device, grant the camera, and run the
benchmark once per delegate (CPU, then GPU). Record the four metrics into the
results table in that file.

## Decision

Provisional recommendation: adopt the **MediaPipe Face Landmarker** as the first
production backend, with a **CPU (WASM) delegate as the Firefox default** and a
GPU (WebGL2) delegate enabled only where it is benchmarked faster on the same
hardware (§25).

Rationale (independent of the pending numbers):

- It is the only candidate covering iris, head pose, and blink in one browser
  model, so it satisfies §3/§6/§7 without a second dependency.
- It runs on WASM and WebGL2, matching the v1 compute targets; it does not need
  WebGPU.
- It honours the abstraction: nothing outside the adapter changes when it is
  promoted in Phase 8.

### Measured results (mobile)

Firefox on Android:

| Delegate | Init (ms) | Mean frame (ms) | p95 frame (ms) | Effective FPS |
|----------|-----------|-----------------|----------------|---------------|
| CPU      | 1605      | 37.3            | 44.0           | 22.7          |
| GPU      | 838       | 33.3            | 38.0           | 28.6          |

Chrome on Android:

| Delegate | Init (ms) | Mean frame (ms) | p95 frame (ms) | Effective FPS |
|----------|-----------|-----------------|----------------|---------------|
| CPU      | 1052      | 33.2            | 35.6           | 27.7          |
| GPU      | 415       | 34.1            | 31.7           | 23.2          |

All four configurations are usable (≈23–29 FPS, p95 ≤ 44 ms). The best delegate
is browser-dependent:

- **Firefox on Android**: GPU is clearly better on every metric.
- **Chrome on Android**: close — CPU gives marginally higher sustained FPS,
  GPU gives much faster initialisation and a lower p95 (steadier frames).

The decision is **accepted** for the mobile targets. Desktop rows are still
welcome but not blocking. If a future device shows per-frame latency too high at
640×480, the fallbacks (in order) are: lower the capture resolution; keep
`numFaces` at 1 (already set); disable blendshapes when blink can be derived
geometrically; and only then reconsider the backend.

### Phase 8 delegate selection

Because the optimal delegate is browser-dependent and the gap is small on
Chrome, implement: **GPU-preferred with automatic CPU fallback** (attempt GPU
first; on initialisation failure retry with CPU), **plus a manual delegate
override** in the UI so a user can pick CPU where it suits their browser. The
active delegate is surfaced in the status panel. GPU-preferred is the sensible
automatic default because it gives the fastest initialisation on both browsers
and the lowest p95 (the metric that governs how steady the overlay feels), and
it is the clear winner on Firefox, the priority browser (§25).

## Consequences

- Phase 8 implements the chosen backend in `backendAdapters/`, wires it into the
  default boot path (first phase where that is allowed), and self-hosts the
  wasm and `.task` model assets rather than loading them from a CDN.
- The eye-local sign convention used in the spike is approximate; Phase 8 must
  validate it with the calibration-free quality check (§10).
