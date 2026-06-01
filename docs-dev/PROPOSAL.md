# saccadacus — product and architecture proposal

## 1. Project overview

`saccadacus` is a public, static GitHub Pages web application for browser-based eye-movement tracking from webcam or smartphone video. The application tracks the head and eyes and focuses primarily on eye movements rather than conventional screen-gaze estimation. Its core purpose is to provide a live, browser-based technical demo that can detect, visualise, and export eye-movement signals using ordinary camera input.

The central design choice is to treat eye movement as movement of the iris or pupil relative to the eye itself. Instead of requiring a standard gaze calibration before the app becomes useful, `saccadacus` computes an eye-local signal from eye landmarks. This signal can be used to visualise eye-in-head movement, detect saccades, detect blinks, monitor head pose, and assign confidence or reliability values to detected events.

The app should run as a static web application on GitHub Pages. It should prioritise Firefox support while aiming to remain compatible with Chrome/Chromium. It should work on both Android phone browsers and laptop/desktop webcam browsers. The first public version should feel like a live technical demo, but the internal structure should support data export, event summaries, follow-the-dots task data, and later extension into more systematic analysis workflows.

## 2. Product framing

`saccadacus` should be framed as an eye-movement tracking application first. The primary default mode is calibration-free eye-movement tracking. The app should measure and display movement of the iris or pupil within an eye-centred coordinate system, together with head pose and tracking reliability.

The optional gaze-mapping functionality should be presented as a secondary capability that becomes available after a follow-the-dots task. In that mode, the app uses the relationship between dot positions and eye/head signals to estimate approximate screen-position output. However, the base product framing should remain eye-movement centred.

In public-facing documentation, the app should be presented in a product/demo-oriented way. The main message should be that the app tracks eye movements, head pose, saccades, blinks, signal reliability, and optional dot-based gaze mapping directly in the browser.

## 3. Core tracking concept

The core signal in `saccadacus` is an eye-local pupil/iris position. For each eye, the app uses the two eye corners as anatomical reference points. These landmarks define a local coordinate system for that eye.

For each eye:

```text
u = unit vector from one eye corner to the other
v = perpendicular vector to u
```

The midpoint between the two eye corners is used as the local origin. The distance between the eye corners is used as the normalisation factor. The selected eye feature, either the iris centre or the pupil centre, is projected onto the `u` and `v` axes. This produces horizontal and vertical eye-local coordinates expressed in eye-width units.

Conceptually:

```text
eye-local x = position of iris/pupil along the eye-corner axis
eye-local y = position of iris/pupil along the perpendicular eye-local axis
```

The horizontal coordinate reflects movement from one side of the eye aperture to the other. The vertical coordinate reflects movement perpendicular to the eye-corner axis, scaled by the same eye-width reference. This gives a stable and interpretable signal for visualising relative eye movement.

This coordinate system should be computed separately for each eye. The app should then allow the user to view either eye separately, a binocular combined signal, or both eyes at the same time.

## 4. Tracking modes: iris, pupil, and automatic

`saccadacus` should support three tracking modes:

```text
automatic / best available
iris centre
pupil centre
```

Iris-centre tracking should be the default mode for ordinary webcam and smartphone use. In many standard RGB camera settings, the iris is likely to be more visible and stable than the pupil. However, pupil-centre tracking should remain available, because it may perform well under favourable lighting, high image quality, or future camera/tracking configurations.

The user should be able to manually switch between automatic, iris-centre, and pupil-centre tracking. The UI should make the currently selected signal explicit. It should also show the reliability of the selected and non-selected signal. For example, if the app is using iris-centre tracking but pupil-centre tracking becomes more reliable, the interface should indicate this and allow the user to switch.

The automatic mode should select the best available signal based on reliability estimates. However, manual override should always remain possible.

## 5. Eye-selection modes

The app should support flexible eye-selection modes. The user should be able to choose between:

```text
left eye only
right eye only
binocular average / combined
both eyes separately
```

This is important because webcam/smartphone eye tracking may produce different signal quality for the left and right eye. One eye may be partially occluded, more affected by lighting, more affected by camera angle, or less reliably detected. The app should therefore not assume that both eyes are always equally usable.

Each eye should have its own tracking signal and its own reliability estimate. Reliability should also be tracked separately for iris-centre and pupil-centre signals when both are available. When binocular combined mode is used, the combined output should be computed from the available reliable eye signals, while preserving the ability to inspect each eye separately.

The horizontal sign convention should be defined from the participant's perspective. Positive horizontal movement should correspond to movement toward the participant's right, and negative horizontal movement should correspond to movement toward the participant's left. Vertical movement should use a consistent convention, with positive values corresponding to upward movement and negative values corresponding to downward movement.

## 6. Head tracking

`saccadacus` should track the head as well as the eyes. Head tracking should be included from the start, not added as an afterthought. The app should estimate 3D head pose, including:

```text
yaw
pitch
roll
translation / head position
```

Head pose should be shown live in the interface and included in the exported data. The purpose is not only to display head movement, but also to improve interpretation of eye-movement events. Head movement can affect the apparent eye signal, the stability of landmarks, and the reliability of event detection. Therefore, head pose should be treated as a central quality-control and event-labelling variable.

The eye-local coordinate system already reduces the impact of simple face translation, distance changes, and in-plane roll, because the iris/pupil signal is expressed relative to the eye corners. However, 3D head pose still matters. Yaw and pitch can change the visible geometry of the eye, affect landmark reliability, and change how eye-local movement should be interpreted.

The app should use head-pose information to help classify candidate events, assign confidence values, and decide whether events should be accepted, labelled, or marked as uncertain.

## 7. Event detection

The app should detect two main event classes:

```text
saccades
blinks
```

Saccades should be detected as rapid changes in the eye-local pupil/iris signal. The detection does not need to depend on screen-gaze estimates. Instead, the app should use the time series of eye-local position and velocity. Saccade detection should consider:

```text
eye-local displacement
eye-local velocity
selected signal reliability
left/right eye consistency
blink state
head-pose state
landmark stability
```

Each detected saccade should include a reliability or confidence value. This value should reflect the quality of the evidence for the event. For example, a rapid binocularly consistent eye-local movement during stable head pose and high landmark reliability should receive higher confidence than an event occurring during poor tracking, blink proximity, or abrupt head-pose changes.

Blinks should be detected and represented separately. Blink detection is necessary because blinks interrupt the eye signal and can create abrupt changes in tracked features. The app should avoid treating blink-related signal loss or eyelid occlusion as saccades.

The architecture should allow fixation stability and drift measures to be added later, but the current product description should focus on saccades, blinks, eye-local position, head pose, reliability, and optional gaze mapping.

## 8. Head-motion-aware event labels

Head motion should not automatically invalidate all eye-movement events. Real saccades can occur during moderate head movement. At the same time, abrupt head motion or unstable face/eye landmarks can create false candidate events. The app should therefore use a graded approach.

Extreme or uncertain head-motion cases should be rejected or marked as unreliable. Moderate head-motion cases should be retained but labelled separately. Saccade event labels should include:

```text
saccade_head_still
saccade_during_head_movement
uncertain_head_motion
```

The first version should not include separate event types for `head_movement_without_saccade` or `compensatory_eye_movement`. The product should remain focused on saccade detection and on reporting the head-motion context of detected saccades.

For each detected saccade, the event summary should include:

```text
onset
offset
duration
direction
relative amplitude
selected signal type
eye-selection mode
head-motion label
confidence / reliability value
```

Direction and relative amplitude should be based on the eye-local coordinate system unless a gaze-mapped output is available. When gaze mapping is available, both the original eye-local event features and the gaze-mapped features should be retained.

## 9. Live interface

The live interface should make the tracking state visible and interpretable. It should not only show a camera feed, but also show the derived signals and their reliability.

The interface should include:

```text
camera feed
eye/head overlays
iris/pupil markers
tracking-mode switch
eye-selection switch
signal reliability indicators
live x/y eye-position traces
velocity traces
event markers
head-pose/status display
export/status panel
```

The camera feed should show overlays for the face, head pose, eye landmarks, eye corners, and iris/pupil markers. The overlay should help the user understand whether the app is currently tracking the relevant features correctly.

The trace panels should show the eye-local horizontal and vertical position signals over time. A velocity trace should show rapid changes in the eye-local signal. Detected saccades and blinks should be marked directly on the traces. The status area should show tracking mode, eye-selection mode, reliability indicators, head-pose status, event count, export status, and whether gaze mapping is available.

The interface should support switching between views, including selected eye, binocular combined signal, and separate left/right eye traces.

## 10. Calibration-free quality check

The app should include a calibration-free quality-check mode. This mode should ask the user to make simple instructed eye movements, such as:

```text
look left
look right
look up
look down
blink
keep your head still
move your head slightly
```

The purpose is to verify signal direction, signal strength, reliability, and head-motion handling. This quality check should not be presented as a required gaze calibration. It is a functional check that confirms whether the eye-local signal behaves as expected.

The app should use the quality-check results to indicate whether the current tracking mode and eye-selection mode are reliable. It should also help the user decide whether iris-centre or pupil-centre tracking is currently better.

## 11. Follow-the-dots task

In addition to the calibration-free quality check, the app should include an optional follow-the-dots task. This task presents dots at random screen locations and continues until the user presses stop.

For each dot, the app should store:

```text
dot x-position
dot y-position
dot onset timestamp
dot offset or replacement timestamp
aligned eye-local signal
aligned head-pose signal
selected tracking mode
selected eye mode
signal reliability
```

The dot task should use the same timestamp clock as the eye/head tracking data. This allows the dot sequence to be aligned with the eye-local and head-pose time series.

The dot task has two functions. First, it provides a useful behavioural and signal-quality task. Second, it provides data for fitting gaze-mapping models.

## 12. Gaze mapping

Although the default product is eye-movement tracking, `saccadacus` should support optional gaze mapping after follow-the-dots data have been collected. Once dot-task data are available, the app should fit gaze-mapping models that relate eye-local signals and head-pose information to screen positions.

This creates two related outputs:

```text
eye-local signal = iris/pupil movement relative to the eye
gaze-mapped signal = estimated screen position derived from dot-task data
```

After gaze mapping becomes available, the app should use the gaze-mapped signal by default, while still showing and exporting the original eye-local signal. The original signal remains important because it is the base measurement from which event detection and mapping are derived.

Gaze mapping should be fitted separately for:

```text
iris-based signals
pupil-based signals
left-eye signals
right-eye signals
binocular/combined signals
```

Where reliable, the user should be able to switch between these mapped signals. The app should also indicate the reliability or fit quality of the available mappings.

## 13. Data model

The app should internally maintain separate but aligned data streams:

```text
eye-local time series
head-pose time series
tracking reliability time series
blink events
saccade events
dot/task events
gaze-mapped time series when available
```

All streams should be aligned using a common timestamp basis. The primary clock should be `performance.now()`. Video/frame timestamps should also be stored when available.

The data model should preserve enough information to reconstruct the main session timeline:

```text
when tracking started
which tracking mode was active
which eye-selection mode was active
when dots appeared
when saccades occurred
when blinks occurred
what head pose was estimated
which signal was reliable
which outputs were gaze-mapped
```

This structure allows the app to function as a live demo while still producing useful exported data.

## 14. CSV export

The first export format should be CSV. The initial export should use one combined CSV rather than multiple separate files. This combined CSV should contain:

```text
time-series rows
event rows
dot/task rows
```

A row-type column should distinguish these row classes. The CSV should include derived signals only. The initial export should not include raw landmark coordinates.

The CSV should include, where available:

```text
timestamp_performance_now
video_or_frame_timestamp
row_type
tracking_mode
eye_selection_mode
left_eye_x_local
left_eye_y_local
right_eye_x_local
right_eye_y_local
binocular_x_local
binocular_y_local
left_eye_reliability
right_eye_reliability
iris_reliability
pupil_reliability
head_yaw
head_pitch
head_roll
head_translation_x
head_translation_y
head_translation_z
blink_state
event_type
event_onset
event_offset
event_duration
event_direction
event_relative_amplitude
event_confidence
event_head_motion_label
dot_x
dot_y
dot_timestamp
gaze_x_mapped
gaze_y_mapped
gaze_mapping_id
gaze_mapping_reliability
```

The exact column set can be refined during implementation, but the principle should remain stable: export derived signals, event summaries, and task rows in a single CSV.

Raw video should not be stored by default. Optional local-only video saving may be supported. The app should be mostly local/browser-side for the static GitHub Pages implementation, while the architecture should not block optional upload or export features later.

## 15. Interaction flow

A typical user flow should be:

```text
open the GitHub Pages app
grant camera permission
see live camera feed and overlays
select or confirm tracking mode
select eye mode
check signal reliability
run calibration-free quality check if desired
view live eye-local traces and event markers
run optional follow-the-dots task if gaze mapping is desired
continue live tracking with eye-local and gaze-mapped signals
export combined CSV
```

The app should remain useful before running the follow-the-dots task. The follow-the-dots task should enhance the app by adding gaze-mapped output, not replace the eye-local tracking functionality.

## 16. Product priorities

The most important product priorities are:

```text
live browser-based eye/head tracking
clear eye-local signal visualisation
iris/pupil mode switching
left/right/binocular eye selection
signal reliability indicators
head-pose-aware saccade event detection
blink detection
follow-the-dots gaze mapping
single combined CSV export
Firefox-first compatibility
static GitHub Pages deployment
```

The application should be structured to support later refinement of event detection, gaze mapping, reliability estimation, and export format. However, the product description should remain centred on the intended user-facing behaviour rather than on a specific computer-vision library or implementation stack.

## 17. Repository and documentation expectations

The repository should be public and named `saccadacus`. The app should be deployable as a static GitHub Pages site. Public documentation should explain:

```text
what the app does
how to run it
how to use the live tracking view
how to switch between iris and pupil tracking
how to switch between eye-selection modes
how to interpret reliability indicators
how to run the quality check
how to run the follow-the-dots task
how to export CSV data
what the exported rows represent
```

The documentation should present `saccadacus` as an eye-movement tracking app with optional gaze mapping. It should stay product-focused and demo-focused, with emphasis on capabilities, interaction flow, and data output.

Internal implementation planning, agent instructions, and prompt-chain material must not be mixed into the public-facing README unless directly relevant for users. These materials belong in `docs-dev/`, with numbered implementation prompts in `docs-dev/prompts/`, as specified in §30.

## 18. Technical stack

The implementation should use the following technologies. Versions are indicative; minor version drift is acceptable.

```text
language: TypeScript in strict mode, with noUncheckedIndexedAccess enabled
build tool: Vite
UI framework: React 19
styling: Tailwind CSS
state management: Zustand, used for UI state only
live trace plotting: uPlot
linear algebra: gl-matrix
camera access: getUserMedia (browser API)
concurrency: Web Workers
unit testing: Vitest
component testing: React Testing Library
end-to-end testing: Playwright across Chromium, Firefox, and WebKit
linting: ESLint with typescript-eslint
formatting: Prettier
deployment: GitHub Actions with actions/deploy-pages
```

The application must not depend on any specific eye-tracking or face-landmark library at the source-code level. All such dependencies must be confined to backend adapter modules behind the tracking interface defined in §20.

The application must not include OpenCV.js as a default dependency. If pupil-centre detection beyond iris-centre tracking becomes necessary, it should be implemented as a small WebGL shader or as a hand-rolled algorithm operating on `ImageData` inside a Web Worker.

The application must not include WebGazer.js. Its design assumes screen-gaze regression with calibration, which the product framing rejects (§2).

## 19. Repository structure

The repository should follow this layout:

```text
saccadacus/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  AGENTS.md
  CLAUDE.md
  .github/workflows/deploy.yml
  docs-dev/
    prompts/
      01_scaffold.md
      02_interfaces_and_mock.md
      03_camera_and_frame_loop.md
      04_signals_and_rendering.md
      05_events.md
      06_tasks_and_export.md
      07_backend_spike.md
      08_production_backend_and_gaze_mapping.md
      09_documentation.md
    architecture/
    decisions/
    references/
  src/
    main.tsx
    app/
      App.tsx
      panels/
    state/
      uiStore.ts
    camera/
      cameraController.ts
      cameraConstraints.ts
      frameClock.ts
    tracking/
      TrackingBackend.ts
      MockTrackingBackend.ts
      backendAdapters/
        README.md
    signals/
      eyeLocalCoordinates.ts
      headPose.ts
      reliability.ts
      velocity.ts
      ringBuffer.ts
    events/
      detectSaccades.ts
      detectBlinks.ts
      headMotionLabels.ts
    tasks/
      qualityCheck/
      followTheDots/
      gazeMapping/
    export/
      combinedCsv.ts
      schema.ts
    workers/
      trackingWorker.ts
      signalWorker.ts
      protocol.ts
    visualisation/
      cameraOverlay.ts
      tracesCanvas.ts
      eventMarkers.ts
  tests/
    unit/
    e2e/
  public/
```

The `tracking/backendAdapters/` directory should initially contain only a `README.md` describing the interface contract. Real adapters are added only after the surrounding framework is functional against `MockTrackingBackend` (§27).

The `docs-dev/` directory is for internal development material, including prompt files, architecture notes, implementation decisions, and external references. Public-facing documentation remains in `README.md` and user-facing in-app help text (§17). Prompt-file conventions are defined in §30.

## 20. Tracking backend abstraction

The application must access face, eye, and head information exclusively through a single interface defined in `src/tracking/TrackingBackend.ts`. No other source file in the project may import a specific computer-vision library.

The interface is:

```typescript
export interface TrackingBackend {
  initialise(config: TrackingBackendConfig): Promise<void>;
  processFrame(
    frame: VideoFrameLike,
    pageTimestampMs: number
  ): Promise<TrackingFrameResult>;
  dispose(): Promise<void>;
}
```

The `pageTimestampMs` value is captured by the caller using `performance.now()` at the moment of frame acquisition and is echoed back unchanged inside the returned `TrackingFrameResult`. This rule guarantees a single canonical clock (§13, §24) even when the backend runs inside a Web Worker.

`VideoFrameLike` should accept `ImageBitmap`, `VideoFrame`, or `HTMLCanvasElement` as concrete inputs. The adapter is responsible for any internal conversion.

A `MockTrackingBackend` must be implemented first. It should produce deterministic synthetic signals containing programmable saccades, blinks, head-pose changes, and tracking dropouts. The mock has three roles: it allows the UI and signal pipeline to be developed and tested before any real tracking model is loaded; it generates fixtures for unit tests of detectors and mappings; and it provides a stable comparison target when evaluating real backends.

Real backend adapters are added one at a time, beginning with whichever performs best after the spike defined in §27, Phase 7.

## 21. Data model

The core domain types correspond to the data streams in §13 and the CSV columns in §14. They should be defined in `src/tracking/TrackingBackend.ts` and `src/signals/` and imported throughout.

```typescript
export type Selection = "iris" | "pupil";
export type BlinkState = "open" | "closing" | "closed" | "opening" | "unknown";

export interface EyeFeatureResult {
  irisCentre?: { xLocal: number; yLocal: number; reliability: number };
  pupilCentre?: { xLocal: number; yLocal: number; reliability: number };
  selected: Selection;
  selectedReliability: number;
  blinkState: BlinkState;
}

export interface HeadPoseResult {
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  translationX?: number;
  translationY?: number;
  translationZ?: number;
  reliability: number;
}

export interface TrackingFrameResult {
  pageTimestampMs: number;
  videoMediaTimeMs?: number;
  backendLatencyMs?: number;
  leftEye?: EyeFeatureResult;
  rightEye?: EyeFeatureResult;
  headPose?: HeadPoseResult;
  faceReliability: number;
}

export type EyeSelectionMode = "left" | "right" | "binocular" | "both";
export type TrackingMode = "auto" | "iris" | "pupil";
export type HeadMotionLabel =
  | "saccade_head_still"
  | "saccade_during_head_movement"
  | "uncertain_head_motion";

export interface SaccadeEvent {
  onsetMs: number;
  offsetMs: number;
  durationMs: number;
  direction: { x: number; y: number };
  relativeAmplitude: number;
  selectedSignal: Selection;
  eyeSelectionMode: EyeSelectionMode;
  headMotionLabel: HeadMotionLabel;
  confidence: number;
}

export interface BlinkEvent {
  onsetMs: number;
  offsetMs: number;
  durationMs: number;
  eye: "left" | "right" | "both";
  confidence: number;
}

export interface DotEvent {
  onsetMs: number;
  offsetMs?: number;
  xScreen: number;
  yScreen: number;
}
```

The horizontal sign convention follows §5: positive `x` corresponds to the participant's right, positive `y` corresponds to upward. The local origin and the normalisation factor are defined per eye by the eye-corner midpoint and the eye-corner distance respectively (§3).

Continuous signals must be stored in pre-allocated `Float32Array` ring buffers. Timestamps use `Float64Array`. Ring buffers are read directly by the rendering layer and by the exporter; they must not be stored inside Zustand or any other reactive store.

## 22. Concurrency model

Work is partitioned across threads as follows.

```text
main thread:
  React UI, panels, switches, status displays
  HTMLVideoElement and getUserMedia
  Overlay canvas (face mesh, iris/pupil markers, head pose)
  uPlot trace canvases
  Reads from ring buffers for display and export

tracking worker:
  Tracking backend instance behind the TrackingBackend interface
  Model loading and per-frame inference
  Returns landmark-derived results to the signal worker

signal worker:
  Ring buffer writes
  Eye-local coordinate projection
  Velocity computation
  Reliability aggregation
  Saccade and blink detection
  Head-motion labelling
```

Frames are captured on the main thread and transferred to the tracking worker as `ImageBitmap` or `VideoFrame`, the latter via `MediaStreamTrackProcessor` where supported. Only landmark coordinates, head-pose values, and reliability scalars travel back from worker to main thread. Frame pixels do not cross the boundary in either direction after capture.

`OffscreenCanvas` transferred to a Web Worker is not used for overlay rendering. Firefox support has been less reliable than Chromium's, and the bandwidth saving is modest because only small numeric payloads need to reach the overlay layer. Overlay rendering remains on the main thread.

Worker communication uses a typed message protocol defined in `src/workers/protocol.ts`. Every message carries the page-side timestamp (§24).

## 23. Live rendering layers

The interface specified in §9 is realised as four stacked layers.

```text
1. Video element        native <video>, mirrored via CSS where appropriate
2. Overlay canvas       Canvas 2D on the main thread, redrawn per frame
3. Trace canvases       uPlot instances, redrawn at the trace cadence
4. Status panel         React components, updated at approximately 10 Hz
```

The overlay canvas draws the face mesh, eye-corner landmarks, iris and pupil markers, head-pose axes, and reliability indicators. It is redrawn synchronously when a `TrackingFrameResult` arrives from the worker pipeline.

Trace canvases use uPlot. Each trace is backed by `Float32Array` slices read directly from ring buffers; React does not mediate these updates. Event markers (saccades, blinks, dot onsets) are drawn on the same canvases via a uPlot plugin.

The status panel reads aggregated state, including current mode, current eye selection, recent reliability, event counts, export status, and gaze-mapping availability, from a Zustand store updated on a throttled schedule of approximately 10 Hz, independent of the per-frame loop.

## 24. Frame clock and timestamps

The primary clock is `performance.now()`. The page side stamps `pageTimestampMs` at the moment of frame ingestion and passes it into `processFrame`. The backend echoes it back unchanged in `TrackingFrameResult.pageTimestampMs`. This rule is mandatory and is the basis for all later alignment between time-series rows, event rows, and dot-task rows in the CSV export.

`HTMLVideoElement.requestVideoFrameCallback` should be used where available to obtain `mediaTime` and `presentationTime`, stored in `videoMediaTimeMs`. It must not be used as the pacing mechanism, because Firefox is known to throttle its callback rate (see §25). Pacing is driven by a main-thread loop that polls the video element on `performance.now()` cadence and falls back to `requestAnimationFrame` when no rVFC metadata is available.

`backendLatencyMs` is recorded as the wall-clock duration of `processFrame` and stored alongside the result. It is a quality-control variable and is exportable.

All event timestamps (saccade onset and offset, blink onset and offset, dot onset and replacement) are expressed in `performance.now()` milliseconds and are aligned with the ring buffer time axis by construction.

## 25. Browser compatibility constraints

The application targets Firefox first and Chromium second. The following constraints apply and have shaped the choices in §22 and §24.

Model initialisation may be substantially slower on Firefox than on Chromium. The user must see an explicit loading state from the moment camera permission is granted until the backend reports ready. Backend adapters should default to a CPU delegate on Firefox unless a GPU delegate has been benchmarked to be faster on the same hardware (§27, Phase 7).

`requestVideoFrameCallback` may be rate-limited on Firefox. The frame loop must therefore not depend on rVFC for pacing.

WebGPU is not used in v1. WASM and WebGL2 are the assumed compute targets.

`OffscreenCanvas` transferred to a worker is not used for overlay rendering.

`getUserMedia` requires HTTPS. GitHub Pages provides this. Local development should use `vite --host` with a self-signed certificate or rely on preview deployments for camera testing.

Advanced camera constraints, including focus mode and exposure mode, are unreliable on mobile Firefox. The application requests a target resolution and frame rate, then reads `MediaStreamTrack.getSettings()` and displays the actual values in the status panel. The actual values, not the requested values, are recorded in the CSV when relevant.

## 26. Build, test, and deployment

The Vite configuration must set `base: '/saccadacus/'` to match the GitHub Pages URL.

Bundle strategy:

```text
app shell:             eager
MockTrackingBackend:   eager
real backend adapters: lazy, code-split per adapter
uPlot:                 eager
gl-matrix:             eager
```

Real backend adapters are loaded only after camera permission has been granted, to keep first-contentful-paint small on mobile devices.

Testing scope:

```text
Vitest unit tests:
  eye-local coordinate projection
  head-pose matrix decomposition into yaw, pitch, roll
  velocity and reliability functions
  saccade detector against MockTrackingBackend fixtures
  blink detector against MockTrackingBackend fixtures
  head-motion labelling
  combined CSV row formatting and round-trip parsing
  gaze-mapping fit on synthetic dot data

React Testing Library tests:
  tracking-mode and eye-selection switches
  camera permission states
  export controls and status displays
  follow-the-dots task lifecycle

Playwright tests:
  the app loads on Chromium, Firefox, and WebKit
  camera permission flow completes with a fake device
  combined CSV downloads and contains the expected row types
  follow-the-dots task records dot rows aligned with the time axis
```

Deployment uses a single GitHub Actions workflow that runs `npm ci`, lints, runs Vitest, builds with Vite, and publishes through `actions/deploy-pages`. Playwright runs on pull requests but is not a deployment gate.

When implementation work is executed through numbered prompt files, each prompt must include the relevant test command and must explicitly state whether the coding agent should commit and push. The default project convention is to commit and push at the end of each prompt only when the prompt says so, using the prompt filename or prompt number as the commit message (§30).

## 27. Implementation order

The application should be built in the following sequence. Each phase must work before the next begins, and the application must remain functional end-to-end against `MockTrackingBackend` until Phase 8.

Each phase should normally correspond to one numbered prompt file in `docs-dev/prompts/`, following the conventions in §30. The prompt files are the operational implementation plan for Claude Code or another coding agent; this section is the product-level sequence.

```text
Phase 1: Scaffold
  Vite, React, TypeScript, Tailwind, Vitest, Playwright, ESLint, Prettier
  Repository layout per §19, including AGENTS.md, CLAUDE.md, and docs-dev/
  Deployment workflow and base URL per §26

Phase 2: Interfaces and mock
  TrackingBackend, TrackingFrameResult, EyeFeatureResult, HeadPoseResult
  MockTrackingBackend producing deterministic synthetic signals
  Ring buffer implementation with unit tests

Phase 3: Camera and frame loop
  getUserMedia with constraints and settings readback
  Frame clock and page-side timestamping per §24
  Worker bootstrap and message protocol per §22

Phase 4: Signals and rendering
  Eye-local projection, velocity, reliability aggregation
  Overlay canvas, uPlot traces, status panel
  All driven by MockTrackingBackend output

Phase 5: Events
  Saccade detector with head-motion labelling per §8
  Blink detector
  Event markers on trace canvases
  Unit tests against mock fixtures

Phase 6: Tasks and export
  Calibration-free quality check per §10
  Follow-the-dots task with dot recording per §11
  Combined CSV export per §14

Phase 7: Backend spike
  A single throwaway MediaPipe Face Landmarker adapter
  Benchmark on Firefox desktop, Chromium desktop, and Firefox on Android
  Measure model initialisation latency, per-frame latency, effective frame
    rate, and stability under CPU and WebGL/GPU delegates
  Decide the first production backend on the basis of these measurements

Phase 8: Production backend and gaze mapping
  Implement the chosen backend behind TrackingBackend
  Fit gaze mapping on dot-task data, per eye and per signal type, per §12
  Mapped-signal switching with reliability indicator
  Mapped columns added to CSV export

Phase 9: Documentation
  README and in-app help text per §17
  CSV column documentation
  Review docs-dev/prompts/ and AGENTS.md/CLAUDE.md against §30
```

## 28. Coding conventions

TypeScript is configured in strict mode with `noUncheckedIndexedAccess` enabled. The `any` type is forbidden outside `src/tracking/backendAdapters/`.

ESLint uses `typescript-eslint` with the recommended-type-checked configuration. Prettier formats on save.

British spelling is used in user-facing strings, documentation, and internal identifiers where the choice arises (`colour`, `behaviour`, `centre`, `analyse`). Existing library APIs are kept as their authors named them (`color` in CSS, `analyze` if a library exposes that name).

The application must not include marketing copy, emojis, or decorative iconography in user-facing strings. The interface presents measurements and controls plainly.

Component files should be small and single-purpose. React hooks should not exceed roughly fifty lines. Signal-processing functions must be pure and accept their inputs explicitly so they remain trivially testable.

Variable names use the convention `xLocal`, `yLocal`, `yawDeg`, `pitchDeg`, `rollDeg`, `tsMs`, `reliability`. Units are written into names whenever ambiguity is possible.

Agent-specific workflow rules belong in `AGENTS.md` and `CLAUDE.md`, not in source modules. Source files should not include comments about prompt execution, commits, pushes, or agent workflow unless that information is technically necessary for the codebase. Prompt and commit conventions are defined in §30.

## 29. Out of scope for v1

The following are deliberately deferred and should not be implemented before the core functionality in §16 is stable across the supported browsers.

```text
fixation stability and drift measures
compensatory eye-movement event type
head_movement_without_saccade event type
raw landmark coordinates in CSV
multiple participants in one session
server-side storage or upload
authenticated sessions
WebGPU acceleration
OffscreenCanvas-in-Worker overlay rendering
custom pupil-centre detection beyond iris-centre tracking
PWA installation or offline support beyond what GitHub Pages provides
```

These items may be revisited once the v1 product (eye-local tracking, head pose, saccade and blink detection, follow-the-dots task, gaze mapping, combined CSV export) is functional and tested on Firefox desktop, Chromium desktop, and Firefox on Android.

## 30. Agentic project workflow and prompt-file conventions

The project uses a single-repository workflow. All public product code, public documentation, internal implementation notes, and prompt-chain material live inside the `saccadacus` repository. There is no separate `saccadacus-dev` repository.

Internal development material belongs in `docs-dev/`:

```text
saccadacus/
  docs-dev/
    prompts/
    architecture/
    decisions/
    references/
    notes/
```

The public `README.md` remains product-facing. It should explain what the app does, how to run it, how to use the live tracking view, how to export data, and how to interpret the exported rows (§17). Long agent instructions, prompt chains, internal planning notes, and implementation-decision records belong in `docs-dev/`, not in the README.

The repository should include both `AGENTS.md` and `CLAUDE.md` at the root. `AGENTS.md` contains shared instructions for coding agents. `CLAUDE.md` contains Claude-specific instructions or a short wrapper that points Claude Code to the shared rules. These files should define practical workflow rules: follow the architecture, keep changes scoped, run relevant tests before committing, do not introduce unnecessary dependencies, and do not push unless the current prompt explicitly instructs it.

Implementation prompts should be stored in `docs-dev/prompts/` and numbered in execution order:

```text
01_scaffold.md
02_interfaces_and_mock.md
03_camera_and_frame_loop.md
04_signals_and_rendering.md
05_events.md
06_tasks_and_export.md
07_backend_spike.md
08_production_backend_and_gaze_mapping.md
09_documentation.md
```

Each prompt file must be self-contained. It should include the goal, relevant files, exact implementation steps, test requirements, commit and push instructions, and the required final response format. A coding agent should be able to execute one prompt without needing to infer missing workflow rules from the rest of the conversation.

Each prompt should end with explicit testing instructions. The default rule is:

```text
Run the relevant tests before committing.
If no tests exist yet, add a minimal test where appropriate or explain why no test was added.
Do not leave known failing tests unmentioned.
```

Each prompt should also explicitly state whether to commit and push. For this project, the default implementation-prompt convention is:

```text
After completing this prompt:
1. Run the relevant tests.
2. Fix any failures caused by this task.
3. Commit the changes with message: PROMPT_FILENAME_WITHOUT_EXTENSION.
4. Push to main.
```

For example, `03_camera_and_frame_loop.md` uses the commit message:

```text
03_camera_and_frame_loop
```

This commit-and-push convention applies only when the prompt explicitly says to do it. General exploratory work, debugging, or review tasks should not push changes unless specifically instructed.

Every coding-agent prompt must require a concise final overview with three parts:

```text
1. Work completed, including whether everything requested was completed and whether it was 100% successful.
2. Open issues, errors, failing tests, or unresolved implementation problems.
3. Human actions required before proceeding.
```

This final overview is mandatory even when the implementation succeeds. If the task is only partially completed, the agent must state exactly what was completed, what remains unresolved, and what should be done next.

When adding new implementation phases, create a new numbered prompt file rather than appending unrelated work to an existing prompt. Keep each prompt narrow enough that it can be executed, tested, committed, and pushed as a coherent unit.
