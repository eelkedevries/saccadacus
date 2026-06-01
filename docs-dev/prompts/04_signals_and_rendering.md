Active prompt for Phase 4 of `saccadacus`. Read AGENTS.md, CLAUDE.md,
docs-dev/STATUS.md, and the PROPOSAL.md sections below. Phases 1-3 must be done.

Goal
  Turn backend results into the eye-local signal, velocity, and reliability
  streams, and render the live interface: overlay canvas, uPlot traces, and the
  status panel — all driven by MockTrackingBackend output.

Relevant sections of PROPOSAL.md
  §3 core tracking concept, §4 tracking modes, §5 eye-selection modes,
  §6 head tracking, §9 live interface, §22 concurrency, §23 live rendering
  layers.

Relevant files (create)
  src/signals/eyeLocalCoordinates.ts, src/signals/headPose.ts,
  src/signals/velocity.ts, src/signals/reliability.ts,
  src/visualisation/cameraOverlay.ts, src/visualisation/tracesCanvas.ts,
  src/state/uiStore.ts, src/app/panels/* (status panel, mode/eye switches),
  plus tests.

Implementation steps
  1. eyeLocalCoordinates.ts (pure): given two eye corners and the selected
     iris/pupil centre, build u (corner-to-corner unit vector) and v
     (perpendicular), use the corner midpoint as origin and corner distance as
     the normalisation factor, and project to xLocal/yLocal in eye-width units
     (§3). Compute per eye. Honour the §5 sign convention: +x to participant's
     right, +y upward.
  2. headPose.ts (pure): decompose a head-pose matrix into yawDeg, pitchDeg,
     rollDeg using gl-matrix; carry translation and reliability through (§6).
  3. velocity.ts (pure): compute eye-local velocity from the position series and
     timestamps. reliability.ts (pure): aggregate per-eye and per-signal-type
     (iris/pupil) reliability and support auto selection of the best available
     signal (§4), with manual override preserved.
  4. Run the signal pipeline in signalWorker.ts: write results into the
     Float32Array/Float64Array ring buffers from Phase 2.
  5. cameraOverlay.ts: Canvas 2D on the main thread, redrawn when a
     TrackingFrameResult arrives — draw face mesh, eye-corner landmarks,
     iris/pupil markers, head-pose axes, and reliability indicators (§23).
  6. tracesCanvas.ts: uPlot instances backed by Float32Array slices read
     directly from ring buffers (React does not mediate these updates). Show
     eye-local horizontal/vertical position and velocity traces.
  7. uiStore.ts (Zustand, UI state only): tracking mode, eye-selection mode,
     recent reliability, status. Update on a throttled ~10 Hz schedule,
     independent of the per-frame loop (§23). Never store continuous signals
     here (hard rule).
  8. Panels: tracking-mode switch (auto/iris/pupil), eye-selection switch
     (left/right/binocular/both), reliability indicators, head-pose/status
     display. Plain measurements and controls, no marketing copy or emojis.

Constraints
  No CV imports. No `any` outside backendAdapters. Continuous signals stay in
  ring buffers, never in Zustand. Overlay rendering stays on the main thread; no
  OffscreenCanvas-in-worker.

Tests
  Vitest unit tests: eye-local projection (known geometry -> expected xLocal/
  yLocal and signs), head-pose matrix decomposition, velocity, reliability
  aggregation and auto selection. React Testing Library: mode and eye-selection
  switches update store state.
  Run `npm run typecheck`, `npm run lint`, `npm run test`.

After completing this prompt
  1. Run the relevant tests.
  2. Fix any failures caused by this task.
  3. Update docs-dev/STATUS.md: Phase 4 -> done with commit SHA.
  4. Commit with message: 04_signals_and_rendering.
  5. Push to main.

Final overview (mandatory, three parts)
  1. Work completed.
  2. Open issues or `none`.
  3. Human actions required or `none`.
