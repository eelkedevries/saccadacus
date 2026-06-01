# Combined CSV column reference

The export is a single CSV containing three row classes distinguished by
`row_type`: `timeseries`, `event`, and `dot`. All rows share the
`performance.now()` time axis in `timestamp_performance_now`, so the streams are
aligned. Only derived signals are exported — raw landmark coordinates are never
included. Columns not relevant to a given row class are left empty.

The canonical column order and the camelCase → snake_case mapping are defined in
`src/export/schema.ts`. Numbers are written in plain decimal; the event
direction is encoded as `x;y`.

## Columns

| Column | Rows | Meaning |
|--------|------|---------|
| `timestamp_performance_now` | all | Shared time axis, `performance.now()` milliseconds. |
| `video_or_frame_timestamp` | timeseries | Frame media time in milliseconds, when available. |
| `row_type` | all | `timeseries`, `event`, or `dot`. |
| `tracking_mode` | all | Active tracking mode: `auto`, `iris`, or `pupil`. |
| `eye_selection_mode` | all | `left`, `right`, `binocular`, or `both`. |
| `left_eye_x_local` | timeseries | Left eye-local horizontal position, eye-width units (+ = participant's right). |
| `left_eye_y_local` | timeseries | Left eye-local vertical position (+ = up). |
| `right_eye_x_local` | timeseries | Right eye-local horizontal position. |
| `right_eye_y_local` | timeseries | Right eye-local vertical position. |
| `binocular_x_local` | timeseries | Reliability-weighted binocular horizontal position. |
| `binocular_y_local` | timeseries | Reliability-weighted binocular vertical position. |
| `left_eye_reliability` | timeseries | Left-eye selected-signal reliability, 0–1. |
| `right_eye_reliability` | timeseries | Right-eye selected-signal reliability, 0–1. |
| `iris_reliability` | timeseries | Iris-signal reliability, 0–1 (when reported). |
| `pupil_reliability` | timeseries | Pupil-signal reliability, 0–1 (when reported). |
| `head_yaw` | timeseries | Head yaw in degrees. |
| `head_pitch` | timeseries | Head pitch in degrees. |
| `head_roll` | timeseries | Head roll in degrees. |
| `head_translation_x` | timeseries | Head translation x (when reported). |
| `head_translation_y` | timeseries | Head translation y (when reported). |
| `head_translation_z` | timeseries | Head translation z (when reported). |
| `blink_state` | timeseries | `open`, `closing`, `closed`, `opening`, or `unknown`. |
| `event_type` | event | `saccade` or `blink`. |
| `event_onset` | event | Event onset, `performance.now()` milliseconds. |
| `event_offset` | event | Event offset, milliseconds. |
| `event_duration` | event | Event duration, milliseconds. |
| `event_direction` | event | Saccade direction unit vector, encoded `x;y` (eye-local). |
| `event_relative_amplitude` | event | Saccade amplitude in eye-width units. |
| `event_confidence` | event | Event confidence, 0–1. |
| `event_head_motion_label` | event | `saccade_head_still`, `saccade_during_head_movement`, or `uncertain_head_motion`. |
| `dot_x` | dot | Dot horizontal position, normalised screen coordinate 0–1. |
| `dot_y` | dot | Dot vertical position, normalised 0–1. |
| `dot_timestamp` | dot | Dot onset, `performance.now()` milliseconds. |
| `gaze_x_mapped` | timeseries | Gaze-mapped horizontal screen position, when mapping is available. |
| `gaze_y_mapped` | timeseries | Gaze-mapped vertical screen position, when mapping is available. |
| `gaze_mapping_id` | timeseries | Identifier of the active gaze-mapping variant, e.g. `iris_binocular`. |
| `gaze_mapping_reliability` | timeseries | Fit reliability of the active gaze mapping, 0–1. |
| `camera_actual_width_px` | timeseries | Actual camera width in pixels, from `getSettings()`. |
| `camera_actual_height_px` | timeseries | Actual camera height in pixels. |
| `camera_actual_frame_rate_hz` | timeseries | Actual camera frame rate in hertz. |

## Notes

- Event rows carry their onset in both `timestamp_performance_now` and
  `event_onset` so they sort onto the shared time axis.
- The eye-local signal is always present even when gaze mapping is available;
  the `gaze_*` columns are additional, not a replacement.
- Sign conventions follow the participant's perspective: positive horizontal is
  to the participant's right, positive vertical is up.
