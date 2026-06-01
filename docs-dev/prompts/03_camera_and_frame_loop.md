Active prompt for Phase 3 of `saccadacus`. Read AGENTS.md, CLAUDE.md,
docs-dev/STATUS.md, and the PROPOSAL.md sections below. Phases 1-2 must be done.

Goal
  Acquire camera input, establish the single canonical frame clock and page-side
  timestamping, and bootstrap the worker pipeline with a typed message protocol.
  Frames flow from the camera through the tracking worker to the signal worker
  and back, still driven by MockTrackingBackend.

Relevant sections of PROPOSAL.md
  §22 concurrency model, §24 frame clock and timestamps, §25 browser
  compatibility constraints.

Relevant files (create)
  src/camera/cameraController.ts, src/camera/cameraConstraints.ts,
  src/camera/frameClock.ts, src/workers/trackingWorker.ts,
  src/workers/signalWorker.ts, src/workers/protocol.ts, plus tests.

Implementation steps
  1. cameraConstraints.ts: build getUserMedia constraints requesting a target
     resolution and frame rate. After the stream starts, read
     MediaStreamTrack.getSettings() and expose the actual values (§25). The
     actual values, not requested values, are what later phases record.
  2. cameraController.ts: manage permission request, stream lifecycle, and an
     explicit loading state from permission grant until the backend reports
     ready (§25 — model init may be slow on Firefox).
  3. frameClock.ts: drive pacing from a main-thread loop polling the video
     element on performance.now() cadence, falling back to requestAnimationFrame
     when no rVFC metadata is available. Use requestVideoFrameCallback only to
     read mediaTime/presentationTime into videoMediaTimeMs — never as the pacing
     source (§24, §25, AGENTS.md hard rule).
  4. protocol.ts: define a typed message protocol for main <-> tracking worker
     <-> signal worker. Every message carries the page-side performance.now()
     timestamp (§24).
  5. trackingWorker.ts: host a TrackingBackend instance (MockTrackingBackend for
     now). Capture frames on the main thread and transfer them to the worker as
     ImageBitmap or VideoFrame (VideoFrame via MediaStreamTrackProcessor where
     supported). Only landmark-derived numeric results travel back; frame pixels
     must not cross the boundary after capture (§22).
  6. signalWorker.ts: stub the receiving side (ring-buffer writes and projection
     land in Phase 4) but establish the message wiring and timestamp pass-through.

Constraints
  Do not transfer OffscreenCanvas to a worker for overlay rendering (hard rule).
  Do not use rVFC for pacing (hard rule). No CV imports. No `any` outside
  backendAdapters. British spelling in user-facing loading/permission strings.

Tests
  Add Vitest unit tests for frameClock pacing selection and for protocol message
  typing/round-trip (timestamp preserved). Camera/worker code that needs a real
  browser is covered later by Playwright; where a unit test is impractical, say
  so in the overview rather than skipping silently.
  Run `npm run typecheck`, `npm run lint`, `npm run test`.

After completing this prompt
  1. Run the relevant tests.
  2. Fix any failures caused by this task.
  3. Update docs-dev/STATUS.md: Phase 3 -> done with commit SHA.
  4. Commit with message: 03_camera_and_frame_loop.
  5. Push to main.

Final overview (mandatory, three parts)
  1. Work completed.
  2. Open issues or `none`.
  3. Human actions required (e.g. local HTTPS for camera testing) or `none`.
