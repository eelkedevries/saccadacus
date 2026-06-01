# saccadacus

`saccadacus` is a browser-based eye-movement tracking demo. It tracks your eyes
and head from an ordinary webcam or phone camera and shows the derived signals
live: eye-in-head movement, head pose, saccades, blinks, and tracking
reliability. An optional follow-the-dots task adds approximate gaze mapping to
screen position. Everything runs locally in the browser; no video or data
leaves your device.

It is built as a static site and prioritises Firefox, while remaining
compatible with Chrome/Chromium, on both desktop and Android phones.

## What it measures

Rather than requiring a gaze calibration before it becomes useful, `saccadacus`
computes an **eye-local** signal: the position of the iris (or pupil) relative
to the eye itself, using the two eye corners as the reference frame. Horizontal
position runs from one side of the eye aperture to the other; vertical position
is measured perpendicular to that axis. Positive horizontal is toward the
participant's right; positive vertical is upward.

Alongside the eye-local signal it estimates 3D head pose (yaw, pitch, roll),
detects saccades and blinks, and assigns each event a confidence value that
reflects signal reliability, binocular consistency, and head-motion context.

## Running it

Open the deployed site in a browser:

```
https://eelkedevries.github.io/saccadacus/
```

Camera access requires HTTPS, which the deployed site provides. Grant the
camera permission when prompted. On first use the tracking model is downloaded,
which can take a few seconds (longer on Firefox); a loading message is shown
until tracking is ready.

To run from source for development:

```
npm ci
npm run dev
```

`getUserMedia` needs HTTPS even locally, so use a tunnel or the deployed site
for camera testing.

## Using the live tracking view

- **Start camera tracking** begins live tracking with your camera. Press the
  same button again to stop. The view pans to keep your head and eyes centred,
  and draws the eye corners, an iris marker, a vertical iris axis, the
  head-centre, and head-pose axes over the video.
- **Synthetic demo** runs the app on built-in synthetic signals, with no camera.
  It is useful for seeing the traces and controls before granting the camera.
- The trace panel plots the eye-local horizontal and vertical position over
  time. Detected saccades are marked with blue bands and blinks with red bands.

### Tracking mode (iris / pupil / automatic)

The tracking-mode switch selects which eye feature drives the signal:

- **Iris centre** — the default; usually the most stable feature on ordinary
  cameras.
- **Pupil centre** — available for favourable lighting or higher-quality input.
- **Automatic** — selects whichever signal is currently more reliable.

### Eye selection (left / right / binocular / both)

Webcam tracking can favour one eye over the other, so you can choose:

- **Left eye** or **Right eye** only,
- **Binocular** — a reliability-weighted combination of both eyes,
- **Both eyes** — inspect each eye separately.

### Reliability indicators

The status panel shows per-eye reliability, face reliability, the active signal,
the active compute delegate, and live event counts. Reliability is reported as a
percentage; low values mean the corresponding signal should be treated with
caution.

## Quality check

The quality check is a short functional check — not a gaze calibration. It asks
you to look left, right, up, and down, blink, hold your head still, and move it
slightly. From your responses it confirms whether the signal moves in the
expected directions with enough strength, and indicates whether iris or pupil
tracking is currently the more reliable choice.

## Follow-the-dots task

The optional follow-the-dots task presents dots at random positions across the
full screen until you stop it. Follow each dot with your eyes. The task records
each dot's position and timing aligned to the tracking signal, then fits
**gaze mapping** models that relate the eye-local signal and head pose to screen
position, separately for the left eye, the right eye, and the binocular
combination.

Once mapping is available, a **gaze-mapped signal** switch appears listing the
fitted variants with their fit reliability. The eye-local signal continues to be
shown and exported; gaze mapping is an additional output, not a replacement.

## Exporting data

**Export combined CSV** downloads a single CSV file to your device. It contains
three kinds of rows, distinguished by the `row_type` column:

- `timeseries` — the per-frame derived signals (eye-local position, reliability,
  head pose, and, when available, gaze-mapped position),
- `event` — detected saccades and blinks with their summaries,
- `dot` — follow-the-dots task dots with positions and timing.

All rows share the same `performance.now()` time axis
(`timestamp_performance_now`), so the streams are aligned. Raw landmark
coordinates are never exported. See
[`docs-dev/references/csv-columns.md`](docs-dev/references/csv-columns.md) for
the full column reference.

## Privacy

All processing is local to the browser. The application does not upload video or
data, and has no server-side storage, accounts, or authentication. Exported CSV
files are saved directly to your device.

## Development

Internal development material — the architecture proposal, implementation
prompts, decision records, and benchmark notes — lives under `docs-dev/`.
Contributor and coding-agent rules are in `AGENTS.md` and `CLAUDE.md`.
