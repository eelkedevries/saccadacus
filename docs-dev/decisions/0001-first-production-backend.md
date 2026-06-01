# Decision 0001 — First production tracking backend

Status: proposed (awaiting on-device benchmark confirmation)
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

This recommendation is **provisional** until the on-device numbers confirm
acceptable initialisation and per-frame latency on Firefox desktop, Chromium
desktop, and Firefox on Android. If Firefox-on-Android per-frame latency is too
high at 640×480, the fallbacks (in order) are: lower the capture resolution;
reduce `numFaces` to 1 (already set); disable blendshapes when blink can be
derived geometrically; and only then reconsider the backend.

## Consequences

- Phase 8 implements the chosen backend in `backendAdapters/`, wires it into the
  default boot path (first phase where that is allowed), and self-hosts the
  wasm and `.task` model assets rather than loading them from a CDN.
- The eye-local sign convention used in the spike is approximate; Phase 8 must
  validate it with the calibration-free quality check (§10).
