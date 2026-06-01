/**
 * Combined CSV schema (PROPOSAL.md §14).
 *
 * One combined CSV carries three row classes — time-series, event, and dot/task
 * — distinguished by `row_type`. This module owns the canonical column order
 * and the camelCase (TypeScript) to snake_case (CSV) mapping (AGENTS.md naming
 * rule). Only derived signals are exported; raw landmark coordinates are never
 * included (hard rule, §14, §29). `gaze_*` columns are defined now but stay
 * empty until gaze mapping lands in Phase 8.
 */
import type {
  BlinkState,
  EyeSelectionMode,
  HeadMotionLabel,
  TrackingMode,
} from '../tracking/TrackingBackend';

export type RowType = 'timeseries' | 'event' | 'dot';
export type EventType = 'saccade' | 'blink';

export interface Direction2D {
  x: number;
  y: number;
}

/**
 * One CSV row in TypeScript form. All fields are optional except `rowType`;
 * each row class populates the subset relevant to it. Continuous signals here
 * are already-derived values read from ring buffers, never raw landmarks.
 */
export interface CombinedRow {
  rowType: RowType;
  timestampPerformanceNow?: number;
  videoOrFrameTimestamp?: number;
  trackingMode?: TrackingMode;
  eyeSelectionMode?: EyeSelectionMode;

  leftEyeXLocal?: number;
  leftEyeYLocal?: number;
  rightEyeXLocal?: number;
  rightEyeYLocal?: number;
  binocularXLocal?: number;
  binocularYLocal?: number;

  leftEyeReliability?: number;
  rightEyeReliability?: number;
  irisReliability?: number;
  pupilReliability?: number;

  headYaw?: number;
  headPitch?: number;
  headRoll?: number;
  headTranslationX?: number;
  headTranslationY?: number;
  headTranslationZ?: number;
  blinkState?: BlinkState;

  eventType?: EventType;
  eventOnset?: number;
  eventOffset?: number;
  eventDuration?: number;
  eventDirection?: Direction2D;
  eventRelativeAmplitude?: number;
  eventConfidence?: number;
  eventHeadMotionLabel?: HeadMotionLabel;

  dotX?: number;
  dotY?: number;
  dotTimestamp?: number;

  gazeXMapped?: number;
  gazeYMapped?: number;
  gazeMappingId?: string;
  gazeMappingReliability?: number;

  cameraActualWidthPx?: number;
  cameraActualHeightPx?: number;
  cameraActualFrameRateHz?: number;
}

/** Canonical column order: [camelCase key, snake_case CSV column]. */
export const CSV_COLUMNS: ReadonlyArray<readonly [keyof CombinedRow, string]> = [
  ['timestampPerformanceNow', 'timestamp_performance_now'],
  ['videoOrFrameTimestamp', 'video_or_frame_timestamp'],
  ['rowType', 'row_type'],
  ['trackingMode', 'tracking_mode'],
  ['eyeSelectionMode', 'eye_selection_mode'],
  ['leftEyeXLocal', 'left_eye_x_local'],
  ['leftEyeYLocal', 'left_eye_y_local'],
  ['rightEyeXLocal', 'right_eye_x_local'],
  ['rightEyeYLocal', 'right_eye_y_local'],
  ['binocularXLocal', 'binocular_x_local'],
  ['binocularYLocal', 'binocular_y_local'],
  ['leftEyeReliability', 'left_eye_reliability'],
  ['rightEyeReliability', 'right_eye_reliability'],
  ['irisReliability', 'iris_reliability'],
  ['pupilReliability', 'pupil_reliability'],
  ['headYaw', 'head_yaw'],
  ['headPitch', 'head_pitch'],
  ['headRoll', 'head_roll'],
  ['headTranslationX', 'head_translation_x'],
  ['headTranslationY', 'head_translation_y'],
  ['headTranslationZ', 'head_translation_z'],
  ['blinkState', 'blink_state'],
  ['eventType', 'event_type'],
  ['eventOnset', 'event_onset'],
  ['eventOffset', 'event_offset'],
  ['eventDuration', 'event_duration'],
  ['eventDirection', 'event_direction'],
  ['eventRelativeAmplitude', 'event_relative_amplitude'],
  ['eventConfidence', 'event_confidence'],
  ['eventHeadMotionLabel', 'event_head_motion_label'],
  ['dotX', 'dot_x'],
  ['dotY', 'dot_y'],
  ['dotTimestamp', 'dot_timestamp'],
  ['gazeXMapped', 'gaze_x_mapped'],
  ['gazeYMapped', 'gaze_y_mapped'],
  ['gazeMappingId', 'gaze_mapping_id'],
  ['gazeMappingReliability', 'gaze_mapping_reliability'],
  ['cameraActualWidthPx', 'camera_actual_width_px'],
  ['cameraActualHeightPx', 'camera_actual_height_px'],
  ['cameraActualFrameRateHz', 'camera_actual_frame_rate_hz'],
];

export const CSV_HEADER: string = CSV_COLUMNS.map(([, column]) => column).join(',');

/** Format one cell value as a CSV string. Direction encodes as "x;y". */
export function formatCell(value: CombinedRow[keyof CombinedRow]): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';
  if (typeof value === 'string') return value;
  // Direction2D
  return `${value.x};${value.y}`;
}
