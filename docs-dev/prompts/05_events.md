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
  5. Commit directly to the main branch and push to origin/main. Do not
     create, switch to, or work on a feature branch for this task.

Final overview (mandatory, three parts)
  1. Work completed.
  2. Open issues or `none`.
  3. Human actions required or `none`.
