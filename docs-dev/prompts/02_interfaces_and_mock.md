Active prompt for Phase 2 of `saccadacus`. Read AGENTS.md, CLAUDE.md,
docs-dev/STATUS.md, and the PROPOSAL.md sections below before starting. Phase 1
(scaffold) must already be done and committed.

Goal
  Define the tracking interface and domain types, implement a deterministic
  MockTrackingBackend, and implement the ring buffer that all continuous signals
  use. After this phase the data layer exists end-to-end against the mock.

Relevant sections of PROPOSAL.md
  §13 data model, §20 tracking backend abstraction, §21 domain types and
  ring-buffer rule, §24 frame clock and timestamps.

Relevant files (create)
  src/tracking/TrackingBackend.ts, src/tracking/MockTrackingBackend.ts,
  src/signals/ringBuffer.ts, plus unit tests under tests/unit/.

Implementation steps
  1. In src/tracking/TrackingBackend.ts define the TrackingBackend interface and
     all domain types exactly as specified in §20 and §21: TrackingBackendConfig,
     VideoFrameLike (ImageBitmap | VideoFrame | HTMLCanvasElement), Selection,
     BlinkState, EyeFeatureResult, HeadPoseResult, TrackingFrameResult,
     EyeSelectionMode, TrackingMode, HeadMotionLabel, SaccadeEvent, BlinkEvent,
     DotEvent. Preserve the §5/§21 sign convention in doc comments only where a
     reader genuinely needs it.
  2. Implement MockTrackingBackend implementing TrackingBackend. It must produce
     deterministic synthetic signals driven by a seed/config: programmable
     saccades, blinks, head-pose changes, and tracking dropouts. processFrame
     must echo pageTimestampMs back unchanged in the result (§24). No real
     camera or CV work.
  3. Implement a pre-allocated ring buffer in src/signals/ringBuffer.ts backed by
     Float32Array for signal channels and Float64Array for timestamps (§21).
     Support push, length, capacity, and direct typed-array slice reads for the
     renderer and exporter. Ring buffers must never be stored in Zustand or any
     reactive store — document this constraint at the call site, not in the
     store.
  4. Keep the backend the default (MockTrackingBackend stays the default through
     Phase 7 per AGENTS.md hard rules). Do not wire a real backend.

Constraints
  No CV/face-landmark imports anywhere (the mock is synthetic, not CV). No `any`
  outside src/tracking/backendAdapters/. Signal-processing helpers must be pure.

Tests
  Add Vitest unit tests:
    - ring buffer: capacity, wraparound overwrite, ordered reads, timestamp
      alignment.
    - MockTrackingBackend: determinism (same seed -> same sequence),
      pageTimestampMs echoed unchanged, presence of programmed saccade/blink/
      dropout segments.
  Run `npm run typecheck`, `npm run lint`, `npm run test`. All must pass.

After completing this prompt
  1. Run the relevant tests.
  2. Fix any failures caused by this task.
  3. Update docs-dev/STATUS.md: Phase 2 -> done with commit SHA.
  4. Commit with message: 02_interfaces_and_mock.
  5. Commit directly to the main branch and push to origin/main. Do not
     create, switch to, or work on a feature branch for this task.

Final overview (mandatory, three parts)
  1. Work completed.
  2. Open issues or `none`.
  3. Human actions required or `none`.
