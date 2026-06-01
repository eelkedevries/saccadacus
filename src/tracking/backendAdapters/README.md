# Backend adapters

This directory is the only place in the project permitted to import face-landmark,
eye-tracking, or computer-vision libraries. Every other source file must access
face, eye, and head information through the `TrackingBackend` interface declared
in `src/tracking/TrackingBackend.ts` (PROPOSAL.md §20).

## Contract

A backend adapter implements:

```ts
interface TrackingBackend {
  initialise(config: TrackingBackendConfig): Promise<void>;
  processFrame(frame: VideoFrameLike, pageTimestampMs: number): Promise<TrackingFrameResult>;
  dispose(): Promise<void>;
}
```

- `pageTimestampMs` is captured by the caller using `performance.now()` at the
  moment of frame acquisition and MUST be echoed back unchanged in the
  returned `TrackingFrameResult.pageTimestampMs`. This rule guarantees a single
  canonical clock (PROPOSAL.md §13, §24) even when the backend runs in a Web
  Worker.
- `VideoFrameLike` accepts `ImageBitmap`, `VideoFrame`, or `HTMLCanvasElement`.
  The adapter is responsible for any internal conversion.
- The `any` type is permitted in this directory only.

## Status

Empty until Phase 7, when a single throwaway MediaPipe Face Landmarker adapter
is added for benchmarking. The production backend is implemented in Phase 8 on
the basis of the Phase 7 measurements. `MockTrackingBackend` remains the
default backend through Phase 7.
