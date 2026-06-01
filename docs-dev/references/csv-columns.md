# CSV column reference

The export produces **two CSV files**, both with one row per time point:

- `primary_output_<mode>_<timestamp>.csv` — a streamlined per-time-point file
  scoped to the active tracking mode.
- `secondary_output_<timestamp>.csv` — the full dataset, per-time-point, with
  event and dot information folded onto the same time axis.

All data is local to the browser and saved to your device on download. Raw
landmark coordinates are never exported.

## `primary_output`

Columns (in order):

| Column | Meaning |
|--------|---------|
| `timestamp` | Shared time axis, `performance.now()` milliseconds. |
| `eye_x` | Horizontal eye-local position from the active tracking mode (eye-width units; + = participant's right). |
| `eye_y` | Vertical eye-local position from the active tracking mode (+ = up). |
| `eye_p` | Reliability of the active eye signal, 0–1. |
| `saccade_event` | `1` while a saccade is ongoing at this time point, otherwise `0`. |
| `saccade_direction` | Direction of the saccade in degrees, 0 = participant's right, 90 = up. Written **only on the first time point** of each saccade; empty otherwise. |
| `saccade_magnitude` | Saccade amplitude in eye-width units. Written **only on the first time point** of each saccade; `0` otherwise. |
| `blink` | `1` while a blink is ongoing, otherwise `0`. |
| `tracking_mode` | The active configuration, e.g. `iris_binocular`. Identical on every row. |

The eye selection used for `eye_x`/`eye_y`/`eye_p` mirrors the eye-selection
switch in the UI: `left`, `right`, `binocular` (reliability-weighted average),
or `both` (the more reliable eye each sample). The signal type follows the
tracking-mode switch; `auto` resolves to iris.

## `secondary_output`

Columns (in order):

| Column | Meaning |
|--------|---------|
| `timestamp_performance_now` | Shared time axis, `performance.now()` milliseconds. |
| `tracking_mode` | Active configuration, e.g. `iris_binocular`. |
| `eye_selection_mode` | `left`, `right`, `binocular`, or `both`. |
| `left_eye_x_local` | Left eye-local horizontal position (eye-width units; + = participant's right). |
| `left_eye_y_local` | Left eye-local vertical position (+ = up). |
| `right_eye_x_local` | Right eye-local horizontal position. |
| `right_eye_y_local` | Right eye-local vertical position. |
| `binocular_x_local` | Reliability-weighted binocular horizontal position. |
| `binocular_y_local` | Reliability-weighted binocular vertical position. |
| `left_eye_reliability` | Left-eye selected-signal reliability, 0–1. |
| `right_eye_reliability` | Right-eye selected-signal reliability, 0–1. |
| `head_yaw` | Head yaw in degrees. |
| `head_pitch` | Head pitch in degrees. |
| `head_roll` | Head roll in degrees. |
| `saccade_ongoing` | `1` while a saccade is ongoing at this time point, otherwise `0`. |
| `saccade_onset_direction_deg` | Saccade direction in degrees; written **only on the first time point** of each saccade. |
| `saccade_onset_magnitude` | Saccade amplitude in eye-width units; written **only on the first time point**. |
| `saccade_onset_confidence` | Saccade confidence, 0–1; written **only on the first time point**. |
| `saccade_onset_head_motion_label` | `saccade_head_still`, `saccade_during_head_movement`, or `uncertain_head_motion`; only on the first time point. |
| `blink_ongoing` | `1` while a blink is ongoing, otherwise `0`. |
| `blink_onset_confidence` | Blink confidence, 0–1; only on the first time point. |
| `dot_active` | `1` while a follow-the-dots dot is on screen, otherwise `0`. |
| `dot_x` | Dot horizontal position, normalised 0–1; written while a dot is active. |
| `dot_y` | Dot vertical position, normalised 0–1; written while a dot is active. |
| `gaze_x_mapped` | Gaze-mapped horizontal screen position, when mapping is available. |
| `gaze_y_mapped` | Gaze-mapped vertical screen position, when mapping is available. |
| `gaze_mapping_id` | Active gaze-mapping variant id, e.g. `iris_binocular`. |
| `gaze_mapping_reliability` | Fit reliability of the active gaze mapping, 0–1. |
| `camera_actual_width_px` | Actual camera width, from `getSettings()`. |
| `camera_actual_height_px` | Actual camera height. |
| `camera_actual_frame_rate_hz` | Actual camera frame rate. |

## Notes

- Sign conventions follow the participant's perspective: positive horizontal is
  to the participant's right, positive vertical is up.
- The eye-local signal is recorded even when gaze mapping is available; the
  `gaze_*` columns are additional, not a replacement.
- Empty cells indicate that the column does not apply on that time point (for
  example, `saccade_onset_*` is filled only on the first sample of each
  saccade).
