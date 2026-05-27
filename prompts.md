## prompt01_scaffold

```
You are working on `saccadacus`, a static GitHub Pages web app for browser-based
eye-movement tracking. Before doing anything, read AGENTS.md, CLAUDE.md,
docs-dev/STATUS.md, and the sections of docs-dev/PROPOSAL.md referenced below.
This is the active prompt for Phase 1.

Goal
  Create the project scaffold so that every later phase can build on a working,
  lint-clean, test-clean toolchain that deploys to GitHub Pages.

Relevant sections of PROPOSAL.md
  §18 technical stack, §19 repository structure, §26 build/test/deploy,
  §28 coding conventions, §30 workflow and prompt conventions.

Relevant files (create)
  package.json, tsconfig.json, vite.config.ts, index.html, src/main.tsx,
  src/app/App.tsx, .eslintrc / eslint config, .prettierrc, vitest config,
  playwright config, .github/workflows/deploy.yml, AGENTS.md, CLAUDE.md,
  the full docs-dev/ tree (prompts/, architecture/, decisions/, references/,
  notes/), and the empty src/ tree from §19 including
  src/tracking/backendAdapters/README.md.

Implementation steps
  1. Initialise a Vite + React 19 + TypeScript project. Enable strict mode and
     noUncheckedIndexedAccess in tsconfig.json.
  2. Add and configure Tailwind CSS, Vitest, React Testing Library, Playwright
     (Chromium, Firefox, WebKit), ESLint with typescript-eslint
     recommended-type-checked, and Prettier. Wire npm scripts: dev, build,
     typecheck (tsc --noEmit), lint, format, test, test:e2e — exactly as listed
     in AGENTS.md "Commands".
  3. Set base: '/saccadacus/' in vite.config.ts (§26).
  4. Create the directory layout from §19. Where a module is not yet
     implemented, leave the directory present (use a .gitkeep or a placeholder
     README only where §19 specifies one, e.g.
     src/tracking/backendAdapters/README.md describing the interface contract).
  5. Add .github/workflows/deploy.yml that runs npm ci, lint, Vitest, vite build,
     and publishes via actions/deploy-pages. Run Playwright on pull requests but
     do not make it a deployment gate.
  6. Render a minimal App shell (plain heading and a status placeholder, no
     marketing copy, no emojis) so dev and build succeed.
  7. Add one trivial Vitest unit test and one trivial Playwright test (app
     loads) so the test commands exercise something real.

Constraints
  Do not add any face-landmark, eye-tracking, or computer-vision library. Do not
  add OpenCV.js or WebGazer.js. No `any` outside src/tracking/backendAdapters/.
  British spelling in identifiers and user-facing strings (§28). No emojis or
  marketing copy.

Tests
  Run `npm run typecheck`, `npm run lint`, and `npm run test`. All must pass.
  Playwright browsers install on first CI run; note this rather than blocking.

After completing this prompt
  1. Run the relevant tests.
  2. Fix any failures caused by this task.
  3. Update docs-dev/STATUS.md: set Phase 1 to done and record the commit SHA.
  4. Commit the changes with message: 01_scaffold.
  5. Push to main.

Final overview (mandatory, three parts)
  1. Work completed — what was implemented and whether the full request
     succeeded.
  2. Open issues — failing tests, unresolved errors, deferred decisions, or
     `none`.
  3. Human actions required — e.g. confirm GitHub Pages source is the
     deploy-pages workflow output; or `none`.
```

## prompt02_interfaces_and_mock

```
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
  5. Push to main.

Final overview (mandatory, three parts)
  1. Work completed.
  2. Open issues or `none`.
  3. Human actions required or `none`.
```

## prompt03_camera_and_frame_loop

```
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
```

## prompt04_signals_and_rendering

```
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
```

## prompt05_events

```
Active prompt for Phase 5 of `saccadacus`. Read AGENTS.md, CLAUDE.md,
docs-dev/STATUS.md, and the PROPOSAL.md sections below. Phases 1-4 must be done.

Goal
  Detect saccades and blinks from the eye-local signal, attach head-motion
  labels and confidence values, and mark events on the trace canvases. Validate
  detectors against MockTrackingBackend fixtures.

Relevant sections of PROPOSAL.md
  §7 event detection, §8 head-motion-aware event labels, §13 data model,
  §23 live rendering layers, §26 testing scope.

Relevant files (create)
  src/events/detectSaccades.ts, src/events/detectBlinks.ts,
  src/events/headMotionLabels.ts, src/visualisation/eventMarkers.ts, plus tests.

Implementation steps
  1. detectSaccades.ts (pure): detect rapid changes from the eye-local position
     and velocity series. Inputs accepted explicitly: eye-local displacement and
     velocity, selected-signal reliability, left/right consistency, blink state,
     head-pose state, landmark stability (§7). Output SaccadeEvent objects with
     onsetMs, offsetMs, durationMs, direction {x,y}, relativeAmplitude,
     selectedSignal, eyeSelectionMode, headMotionLabel, confidence (§8, §21).
     Direction and amplitude come from the eye-local system (no gaze map yet).
  2. detectBlinks.ts (pure): detect blinks separately and emit BlinkEvent
     objects; ensure blink-related signal loss is not classified as a saccade
     (§7).
  3. headMotionLabels.ts (pure): assign saccade_head_still,
     saccade_during_head_movement, or uncertain_head_motion from head-pose
     context (§8). Reject/mark extreme or uncertain head motion; retain moderate
     head motion with its own label. Do NOT add
     head_movement_without_saccade or compensatory_eye_movement types (out of
     scope, §8/§29).
  4. eventMarkers.ts: draw saccade, blink, and (later) dot markers on the uPlot
     trace canvases via a uPlot plugin (§23). Wire detected events from the
     signal worker into markers and into the ~10 Hz status counts.

Constraints
  Detectors must be pure and unit-testable. No CV imports. No `any` outside
  backendAdapters. Confidence must reflect evidence quality (reliability, blink
  proximity, head-pose stability) per §7.

Tests
  Vitest unit tests against MockTrackingBackend fixtures:
    - saccade detector finds programmed saccades with correct direction sign and
      plausible onset/offset; head-motion label matches the programmed head-pose
      context.
    - blink detector finds programmed blinks and does not emit spurious saccades
      around them.
    - head-motion labelling boundaries (still / moving / uncertain).
  Run `npm run typecheck`, `npm run lint`, `npm run test`.

After completing this prompt
  1. Run the relevant tests.
  2. Fix any failures caused by this task.
  3. Update docs-dev/STATUS.md: Phase 5 -> done with commit SHA.
  4. Commit with message: 05_events.
  5. Push to main.

Final overview (mandatory, three parts)
  1. Work completed.
  2. Open issues or `none`.
  3. Human actions required or `none`.
```

## prompt06_tasks_and_export

```
Active prompt for Phase 6 of `saccadacus`. Read AGENTS.md, CLAUDE.md,
docs-dev/STATUS.md, and the PROPOSAL.md sections below. Phases 1-5 must be done.

Goal
  Add the calibration-free quality check, the follow-the-dots task with dot
  recording, and the single combined CSV export. All still driven by
  MockTrackingBackend.

Relevant sections of PROPOSAL.md
  §10 calibration-free quality check, §11 follow-the-dots task, §13 data model,
  §14 CSV export, §15 interaction flow, §26 testing scope.

Relevant files (create)
  src/tasks/qualityCheck/*, src/tasks/followTheDots/*, src/export/schema.ts,
  src/export/combinedCsv.ts, supporting panels under src/app/panels/, plus tests.

Implementation steps
  1. Quality check (§10): guided prompts (look left/right/up/down, blink, keep
     head still, move head slightly) presented as a functional check, NOT a gaze
     calibration. Use the results to indicate whether the current tracking and
     eye-selection modes are reliable and whether iris or pupil is currently
     better. Plain instructional strings, British spelling, no emojis.
  2. Follow-the-dots (§11): present dots at random screen positions until the
     user presses stop. For each dot store dot x/y, onset timestamp, offset/
     replacement timestamp, and the aligned eye-local and head-pose signals,
     plus selected tracking mode, eye mode, and reliability. Use the same
     performance.now() clock as the tracking data so dots align with the
     time series. Emit DotEvent records (§21).
  3. schema.ts: define the canonical CSV column set and the camelCase ->
     snake_case mapping (AGENTS.md spelling/naming rule). Columns follow §14:
     time-series, event, and dot/task columns, with a row_type column
     distinguishing row classes. Include derived signals only — NO raw landmark
     coordinates (hard rule, §14, §29). Leave gaze_* columns defined but empty
     until Phase 8.
  4. combinedCsv.ts: produce ONE combined CSV containing time-series rows, event
     rows, and dot/task rows, distinguished by row_type (§14). Record actual
     camera settings where relevant (§25). Export is local/browser-side only —
     no server storage, auth, or upload (hard rule, §29).

Constraints
  No raw landmark coordinates in CSV. Single combined CSV. No `any` outside
  backendAdapters. No CV imports. British spelling in user-facing strings;
  snake_case CSV columns per the schema mapping.

Tests
  Vitest unit tests: combined CSV row formatting and round-trip parse (write
  then parse back to equal values) for each row type; quality-check reliability
  decision logic. React Testing Library: follow-the-dots task lifecycle
  (start -> dots recorded -> stop) and export controls/status. If a Playwright
  test for CSV download is added, keep it aligned with §26.
  Run `npm run typecheck`, `npm run lint`, `npm run test`.

After completing this prompt
  1. Run the relevant tests.
  2. Fix any failures caused by this task.
  3. Update docs-dev/STATUS.md: Phase 6 -> done with commit SHA.
  4. Commit with message: 06_tasks_and_export.
  5. Push to main.

Final overview (mandatory, three parts)
  1. Work completed.
  2. Open issues or `none`.
  3. Human actions required or `none`.
```

## prompt07_backend_spike

```
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
```

## prompt08_production_backend_and_gaze_mapping

```
Active prompt for Phase 8 of `saccadacus`. Read AGENTS.md, CLAUDE.md,
docs-dev/STATUS.md, the Phase 7 decision record, and the PROPOSAL.md sections
below. Phases 1-7 must be done and the production backend chosen.

Goal
  Implement the chosen production backend behind TrackingBackend and wire it into
  the default boot path, fit gaze mapping on follow-the-dots data per eye and per
  signal type, add mapped-signal switching with a reliability indicator, and add
  the mapped columns to the CSV export.

Relevant sections of PROPOSAL.md
  §11 follow-the-dots, §12 gaze mapping, §13 data model, §14 CSV export,
  §20 backend abstraction, §27 Phase 8.

Relevant files (create/extend)
  src/tracking/backendAdapters/<chosen backend>.ts, src/tasks/gazeMapping/*,
  and extensions to src/export/schema.ts and src/export/combinedCsv.ts, plus
  tests.

Implementation steps
  1. Implement the production backend chosen in Phase 7, inside
     src/tracking/backendAdapters/ (the only place CV imports and `any` are
     allowed). Echo pageTimestampMs unchanged (§24). Lazy-load/code-split per
     §26.
  2. Wire the real backend into the default boot path (this is the first phase
     where that is permitted; MockTrackingBackend remains available for tests
     and as a fallback). Preserve the explicit loading state from permission
     grant to backend-ready (§25).
  3. gazeMapping/: fit gaze-mapping models from dot-task data relating eye-local
     signals and head pose to screen positions. Fit separately for iris-based,
     pupil-based, left-eye, right-eye, and binocular/combined signals (§12).
     Report fit quality/reliability per mapping.
  4. After mapping is available, use the gaze-mapped signal by default while
     still showing and exporting the original eye-local signal (§12). Allow the
     user to switch between available mapped signals where reliable, with a
     reliability/fit-quality indicator.
  5. Extend the CSV: populate gaze_x_mapped, gaze_y_mapped, gaze_mapping_id, and
     gaze_mapping_reliability (§14). When gaze mapping is available, retain both
     the eye-local event features and the gaze-mapped features (§8).

Constraints
  CV imports and `any` only inside src/tracking/backendAdapters/. Still no raw
  landmark coordinates in CSV. Single combined CSV. No server storage, auth, or
  upload (hard rule). British spelling in user-facing strings.

Tests
  Vitest unit tests: gaze-mapping fit on synthetic dot data (known mapping
  recovered within tolerance) for each eye/signal variant; CSV round-trip
  including the populated gaze_* columns. React Testing Library: mapped-signal
  switch and reliability indicator. Extend Playwright per §26 where practical
  (dot rows aligned with the time axis; CSV contains expected row types).
  Run `npm run typecheck`, `npm run lint`, `npm run test`.

After completing this prompt
  1. Run the relevant tests.
  2. Fix any failures caused by this task.
  3. Update docs-dev/STATUS.md: Phase 8 -> done with commit SHA.
  4. Commit with message: 08_production_backend_and_gaze_mapping.
  5. Push to main.

Final overview (mandatory, three parts)
  1. Work completed.
  2. Open issues or `none`.
  3. Human actions required or `none`.
```

## prompt09_documentation

```
Active prompt for Phase 9 of `saccadacus`. Read AGENTS.md, CLAUDE.md,
docs-dev/STATUS.md, and the PROPOSAL.md sections below. Phases 1-8 must be done.

Goal
  Write the public, product-facing documentation and in-app help text, document
  the CSV columns, and reconcile the prompt files and agent guides against the
  workflow conventions.

Relevant sections of PROPOSAL.md
  §17 repository and documentation expectations, §27 Phase 9, §30 workflow and
  prompt conventions.

Relevant files (create/extend)
  README.md (public, product-facing), in-app help text under src/app/,
  CSV-column documentation (e.g. docs-dev/references/ or a user-facing help
  section), and review of docs-dev/prompts/ and AGENTS.md/CLAUDE.md.

Implementation steps
  1. README.md (§17): present saccadacus as an eye-movement tracking app with
     optional gaze mapping. Explain what it does, how to run it, how to use the
     live tracking view, how to switch iris/pupil modes, how to switch
     eye-selection modes, how to interpret reliability indicators, how to run
     the quality check, how to run follow-the-dots, how to export CSV, and what
     the exported rows represent. Product- and demo-focused. Keep internal
     agent/prompt material OUT of the README — it lives in docs-dev/ (§17, §30).
  2. In-app help text: concise, plain, British spelling, no marketing copy or
     emojis (§28). Explain the live view, switches, reliability, quality check,
     follow-the-dots, and export.
  3. CSV column documentation: document every exported column and each row_type,
     matching src/export/schema.ts and §14, including the gaze_* columns from
     Phase 8.
  4. Review docs-dev/prompts/ and AGENTS.md/CLAUDE.md against §30: each prompt
     self-contained with goal, files, steps, tests, commit/push, and the
     three-part final-overview requirement. Note and fix any drift; where
     PROPOSAL.md and a prompt disagree, the prompt wins for its task and the
     discrepancy is recorded (CLAUDE.md note).

Constraints
  No marketing copy or emojis in user-facing strings. British spelling. Do not
  move internal material into the README. No new dependencies.

Tests
  Documentation phase; little code. Verify any documented commands actually run.
  If link-checking or markdown lint exists, run it; otherwise state that no
  automated test applies. Run `npm run typecheck`, `npm run lint`, `npm run test`
  to confirm nothing regressed.

After completing this prompt
  1. Run the relevant tests.
  2. Fix any failures caused by this task.
  3. Update docs-dev/STATUS.md: Phase 9 -> done with commit SHA.
  4. Commit with message: 09_documentation.
  5. Push to main.

Final overview (mandatory, three parts)
  1. Work completed.
  2. Open issues or `none`.
  3. Human actions required or `none`.
```
