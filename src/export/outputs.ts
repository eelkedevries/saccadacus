/**
 * Session export — two output files (PROPOSAL.md §13, §14, with v2 schema).
 *
 * `primary_output.csv` is the streamlined output: one row per time point with
 * the columns required to drive a downstream analysis pipeline, scoped to the
 * tracking mode that was active. All data in this file comes from the selected
 * mode's signal (which eye(s) and iris-vs-pupil), so a single eye_x/eye_y/eye_p
 * triple is sufficient.
 *
 * `secondary_output.csv` is the full output: one row per time point, with every
 * recorded signal alongside event and dot information folded onto the same
 * time axis (no separate event/dot row classes).
 *
 * Continuous signals here are derived values read from the ring buffers;
 * raw landmark coordinates are never exported (hard rule, §14).
 */
import type {
  BlinkEvent,
  EyeSelectionMode,
  SaccadeEvent,
  TrackingMode,
} from '../tracking/TrackingBackend';
import type { DotRecord } from '../tasks/followTheDots/followTheDotsController';
import { applyGazeMap } from '../tasks/gazeMapping/fitGazeMap';
import type { GazeVariantModel } from '../tasks/gazeMapping/gazeMappingService';
import type { TimeseriesSample, CameraActualSettingsLite } from './sessionExport';

export interface SessionExportInputV2 {
  timeseries: TimeseriesSample[];
  saccades: SaccadeEvent[];
  blinks: BlinkEvent[];
  dots: DotRecord[];
  trackingMode: TrackingMode;
  eyeSelectionMode: EyeSelectionMode;
  camera?: CameraActualSettingsLite;
  gaze?: GazeVariantModel;
}

const PRIMARY_COLUMNS = [
  'timestamp',
  'eye_x',
  'eye_y',
  'eye_p',
  'saccade_event',
  'saccade_direction',
  'saccade_magnitude',
  'blink',
  'tracking_mode',
] as const;

const SECONDARY_COLUMNS = [
  'timestamp_performance_now',
  'tracking_mode',
  'eye_selection_mode',
  'left_eye_x_local',
  'left_eye_y_local',
  'right_eye_x_local',
  'right_eye_y_local',
  'binocular_x_local',
  'binocular_y_local',
  'left_eye_reliability',
  'right_eye_reliability',
  'head_yaw',
  'head_pitch',
  'head_roll',
  'saccade_ongoing',
  'saccade_onset_direction_deg',
  'saccade_onset_magnitude',
  'saccade_onset_confidence',
  'saccade_onset_head_motion_label',
  'blink_ongoing',
  'blink_onset_confidence',
  'dot_active',
  'dot_x',
  'dot_y',
  'gaze_x_mapped',
  'gaze_y_mapped',
  'gaze_mapping_id',
  'gaze_mapping_reliability',
  'camera_actual_width_px',
  'camera_actual_height_px',
  'camera_actual_frame_rate_hz',
] as const;

export function trackingModeLabel(input: SessionExportInputV2): string {
  const signal = input.trackingMode === 'auto' ? 'iris' : input.trackingMode;
  return `${signal}_${input.eyeSelectionMode}`;
}

/** Choose which eye-local pair drives `eye_x`/`eye_y` for the primary output. */
function selectedEye(
  sample: TimeseriesSample,
  mode: EyeSelectionMode,
): { x: number; y: number; reliability: number } {
  const leftRel = sample.leftEyeReliability;
  const rightRel = sample.rightEyeReliability;
  switch (mode) {
    case 'left':
      return { x: sample.leftEyeXLocal, y: sample.leftEyeYLocal, reliability: leftRel };
    case 'right':
      return { x: sample.rightEyeXLocal, y: sample.rightEyeYLocal, reliability: rightRel };
    case 'binocular':
      return {
        x: sample.binocularXLocal,
        y: sample.binocularYLocal,
        reliability: (leftRel + rightRel) / 2,
      };
    case 'both':
      // "both" presents each eye separately; for the primary single signal,
      // report the more reliable eye each sample.
      return rightRel > leftRel
        ? { x: sample.rightEyeXLocal, y: sample.rightEyeYLocal, reliability: rightRel }
        : { x: sample.leftEyeXLocal, y: sample.leftEyeYLocal, reliability: leftRel };
  }
}

/** Direction unit vector → angle in [0, 360) degrees. */
function directionToDegrees(dir: { x: number; y: number }): number {
  const rad = Math.atan2(dir.y, dir.x);
  const deg = (rad * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}

/** Index of the first time-series sample whose timestamp is >= onset, or -1. */
function firstSampleAtOrAfter(samples: TimeseriesSample[], onsetMs: number): number {
  for (let i = 0; i < samples.length; i++) {
    if ((samples[i] as TimeseriesSample).timestampPerformanceNow >= onsetMs) return i;
  }
  return -1;
}

/** Whether `tsMs` falls within any of the given event windows. */
function withinEvent(events: { onsetMs: number; offsetMs: number }[], tsMs: number): boolean {
  for (const e of events) {
    if (tsMs >= e.onsetMs && tsMs <= e.offsetMs) return true;
  }
  return false;
}

/** Active dot at `tsMs`, or undefined when there isn't one. */
function activeDot(dots: DotRecord[], tsMs: number): DotRecord | undefined {
  for (const d of dots) {
    const end = d.offsetMs ?? Number.POSITIVE_INFINITY;
    if (tsMs >= d.onsetMs && tsMs <= end) return d;
  }
  return undefined;
}

/** Escape a CSV field for write. */
function escapeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatNumber(value: number | undefined): string {
  if (value === undefined || value === null || !Number.isFinite(value)) return '';
  return String(value);
}

function header(columns: ReadonlyArray<string>): string {
  return columns.join(',');
}

export function buildPrimaryCsv(input: SessionExportInputV2): string {
  const label = trackingModeLabel(input);
  // Map saccade onsets to the first time-series sample at or after each onset.
  const onsetIndexBySaccade = new Map<number, SaccadeEvent>();
  for (const s of input.saccades) {
    const idx = firstSampleAtOrAfter(input.timeseries, s.onsetMs);
    if (idx >= 0) onsetIndexBySaccade.set(idx, s);
  }
  const lines: string[] = [header(PRIMARY_COLUMNS)];
  for (let i = 0; i < input.timeseries.length; i++) {
    const sample = input.timeseries[i] as TimeseriesSample;
    const ts = sample.timestampPerformanceNow;
    const eye = selectedEye(sample, input.eyeSelectionMode);
    const saccadeOngoing = withinEvent(input.saccades, ts) ? 1 : 0;
    const blinkOngoing = withinEvent(input.blinks, ts) ? 1 : 0;
    const onset = onsetIndexBySaccade.get(i);
    const dir = onset ? directionToDegrees(onset.direction) : undefined;
    const mag = onset ? onset.relativeAmplitude : 0;
    const cells = [
      formatNumber(ts),
      formatNumber(eye.x),
      formatNumber(eye.y),
      formatNumber(eye.reliability),
      String(saccadeOngoing),
      onset ? formatNumber(dir) : '',
      formatNumber(mag),
      String(blinkOngoing),
      escapeField(label),
    ];
    lines.push(cells.join(','));
  }
  return lines.join('\n');
}

export function buildSecondaryCsv(input: SessionExportInputV2): string {
  const label = trackingModeLabel(input);
  const onsetIndexBySaccade = new Map<number, SaccadeEvent>();
  for (const s of input.saccades) {
    const idx = firstSampleAtOrAfter(input.timeseries, s.onsetMs);
    if (idx >= 0) onsetIndexBySaccade.set(idx, s);
  }
  const onsetIndexByBlink = new Map<number, BlinkEvent>();
  for (const b of input.blinks) {
    const idx = firstSampleAtOrAfter(input.timeseries, b.onsetMs);
    if (idx >= 0) onsetIndexByBlink.set(idx, b);
  }

  const gaze = input.gaze && input.gaze.model.reliability > 0 ? input.gaze : undefined;
  const camera = input.camera;

  const lines: string[] = [header(SECONDARY_COLUMNS)];
  for (let i = 0; i < input.timeseries.length; i++) {
    const sample = input.timeseries[i] as TimeseriesSample;
    const ts = sample.timestampPerformanceNow;
    const sOnset = onsetIndexBySaccade.get(i);
    const bOnset = onsetIndexByBlink.get(i);
    const dot = activeDot(input.dots, ts);
    let gazeX: number | undefined;
    let gazeY: number | undefined;
    if (gaze) {
      const eye =
        gaze.eye === 'left'
          ? { x: sample.leftEyeXLocal, y: sample.leftEyeYLocal }
          : gaze.eye === 'right'
            ? { x: sample.rightEyeXLocal, y: sample.rightEyeYLocal }
            : { x: sample.binocularXLocal, y: sample.binocularYLocal };
      const mapped = applyGazeMap(gaze.model, {
        xLocal: eye.x,
        yLocal: eye.y,
        yawDeg: sample.headYaw ?? 0,
        pitchDeg: sample.headPitch ?? 0,
      });
      gazeX = mapped.x;
      gazeY = mapped.y;
    }
    const row: Record<(typeof SECONDARY_COLUMNS)[number], string> = {
      timestamp_performance_now: formatNumber(ts),
      tracking_mode: label,
      eye_selection_mode: input.eyeSelectionMode,
      left_eye_x_local: formatNumber(sample.leftEyeXLocal),
      left_eye_y_local: formatNumber(sample.leftEyeYLocal),
      right_eye_x_local: formatNumber(sample.rightEyeXLocal),
      right_eye_y_local: formatNumber(sample.rightEyeYLocal),
      binocular_x_local: formatNumber(sample.binocularXLocal),
      binocular_y_local: formatNumber(sample.binocularYLocal),
      left_eye_reliability: formatNumber(sample.leftEyeReliability),
      right_eye_reliability: formatNumber(sample.rightEyeReliability),
      head_yaw: formatNumber(sample.headYaw),
      head_pitch: formatNumber(sample.headPitch),
      head_roll: formatNumber(sample.headRoll),
      saccade_ongoing: withinEvent(input.saccades, ts) ? '1' : '0',
      saccade_onset_direction_deg: sOnset ? formatNumber(directionToDegrees(sOnset.direction)) : '',
      saccade_onset_magnitude: sOnset ? formatNumber(sOnset.relativeAmplitude) : '',
      saccade_onset_confidence: sOnset ? formatNumber(sOnset.confidence) : '',
      saccade_onset_head_motion_label: sOnset ? sOnset.headMotionLabel : '',
      blink_ongoing: withinEvent(input.blinks, ts) ? '1' : '0',
      blink_onset_confidence: bOnset ? formatNumber(bOnset.confidence) : '',
      dot_active: dot ? '1' : '0',
      dot_x: dot ? formatNumber(dot.xScreen) : '',
      dot_y: dot ? formatNumber(dot.yScreen) : '',
      gaze_x_mapped: formatNumber(gazeX),
      gaze_y_mapped: formatNumber(gazeY),
      gaze_mapping_id: gaze ? gaze.id : '',
      gaze_mapping_reliability: gaze ? formatNumber(gaze.model.reliability) : '',
      camera_actual_width_px: formatNumber(camera?.widthPx),
      camera_actual_height_px: formatNumber(camera?.heightPx),
      camera_actual_frame_rate_hz: formatNumber(camera?.frameRateHz),
    };
    lines.push(SECONDARY_COLUMNS.map((c) => escapeField(row[c])).join(','));
  }
  return lines.join('\n');
}

export const PRIMARY_HEADER = header(PRIMARY_COLUMNS);
export const SECONDARY_HEADER = header(SECONDARY_COLUMNS);

const EVENTS_COLUMNS = [
  'event_type',
  'onset_timestamp',
  'offset_timestamp',
  'duration_ms',
  'direction_deg',
  'magnitude',
] as const;

/**
 * One event per row: saccades (with direction and magnitude) and blinks
 * (direction and magnitude left empty), sorted by onset.
 */
export function buildEventsCsv(input: SessionExportInputV2): string {
  interface Row {
    onsetMs: number;
    cells: string[];
  }
  const rows: Row[] = [];
  for (const s of input.saccades) {
    rows.push({
      onsetMs: s.onsetMs,
      cells: [
        'saccade',
        formatNumber(s.onsetMs),
        formatNumber(s.offsetMs),
        formatNumber(s.durationMs),
        formatNumber(directionToDegrees(s.direction)),
        formatNumber(s.relativeAmplitude),
      ],
    });
  }
  for (const b of input.blinks) {
    rows.push({
      onsetMs: b.onsetMs,
      cells: [
        'blink',
        formatNumber(b.onsetMs),
        formatNumber(b.offsetMs),
        formatNumber(b.durationMs),
        '',
        '',
      ],
    });
  }
  rows.sort((a, b) => a.onsetMs - b.onsetMs);
  return [header(EVENTS_COLUMNS), ...rows.map((r) => r.cells.join(','))].join('\n');
}

export const EVENTS_HEADER = header(EVENTS_COLUMNS);

