import { describe, expect, it } from 'vitest';
import { buildCombinedCsv, parseCombinedCsv } from '../../src/export/combinedCsv';
import { CSV_HEADER } from '../../src/export/schema';
import type { CombinedRow } from '../../src/export/schema';

const timeseriesRow: CombinedRow = {
  rowType: 'timeseries',
  timestampPerformanceNow: 1000.5,
  trackingMode: 'iris',
  eyeSelectionMode: 'binocular',
  leftEyeXLocal: 0.12,
  leftEyeYLocal: -0.03,
  binocularXLocal: 0.1,
  leftEyeReliability: 0.8,
  headYaw: 1.5,
};

const eventRow: CombinedRow = {
  rowType: 'event',
  timestampPerformanceNow: 2000,
  eventType: 'saccade',
  eventOnset: 2000,
  eventOffset: 2050,
  eventDuration: 50,
  eventDirection: { x: 0.98, y: -0.2 },
  eventRelativeAmplitude: 0.3,
  eventConfidence: 0.77,
  eventHeadMotionLabel: 'saccade_head_still',
};

const dotRow: CombinedRow = {
  rowType: 'dot',
  timestampPerformanceNow: 3000,
  dotX: 0.4,
  dotY: 0.6,
  dotTimestamp: 3000,
};

describe('combined CSV', () => {
  it('starts with the canonical header', () => {
    const csv = buildCombinedCsv([timeseriesRow]);
    expect(csv.split('\n')[0]).toBe(CSV_HEADER);
  });

  it('sorts rows by the shared time axis', () => {
    const csv = buildCombinedCsv([dotRow, timeseriesRow, eventRow]);
    const parsed = parseCombinedCsv(csv);
    expect(parsed.rows.map((r) => r.row_type)).toEqual(['timeseries', 'event', 'dot']);
  });

  it('round-trips a time-series row', () => {
    const parsed = parseCombinedCsv(buildCombinedCsv([timeseriesRow]));
    const row = parsed.rows[0]!;
    expect(row.row_type).toBe('timeseries');
    expect(parseFloat(row.timestamp_performance_now!)).toBeCloseTo(1000.5);
    expect(row.tracking_mode).toBe('iris');
    expect(row.eye_selection_mode).toBe('binocular');
    expect(parseFloat(row.left_eye_x_local!)).toBeCloseTo(0.12);
    expect(parseFloat(row.left_eye_y_local!)).toBeCloseTo(-0.03);
    expect(parseFloat(row.head_yaw!)).toBeCloseTo(1.5);
    expect(row.dot_x).toBe(''); // unset columns are empty
  });

  it('round-trips an event row including the direction vector', () => {
    const parsed = parseCombinedCsv(buildCombinedCsv([eventRow]));
    const row = parsed.rows[0]!;
    expect(row.event_type).toBe('saccade');
    expect(parseFloat(row.event_duration!)).toBe(50);
    expect(row.event_head_motion_label).toBe('saccade_head_still');
    const [dx, dy] = row.event_direction!.split(';').map(Number);
    expect(dx).toBeCloseTo(0.98);
    expect(dy).toBeCloseTo(-0.2);
  });

  it('round-trips a dot row', () => {
    const parsed = parseCombinedCsv(buildCombinedCsv([dotRow]));
    const row = parsed.rows[0]!;
    expect(row.row_type).toBe('dot');
    expect(parseFloat(row.dot_x!)).toBeCloseTo(0.4);
    expect(parseFloat(row.dot_y!)).toBeCloseTo(0.6);
  });

  it('leaves gaze columns empty until Phase 8', () => {
    const parsed = parseCombinedCsv(buildCombinedCsv([timeseriesRow]));
    const row = parsed.rows[0]!;
    expect(row.gaze_x_mapped).toBe('');
    expect(row.gaze_y_mapped).toBe('');
    expect(row.gaze_mapping_id).toBe('');
  });

  it('escapes fields that contain commas or quotes', () => {
    const tricky: CombinedRow = { rowType: 'dot', gazeMappingId: 'a,b"c' };
    const parsed = parseCombinedCsv(buildCombinedCsv([tricky]));
    expect(parsed.rows[0]!.gaze_mapping_id).toBe('a,b"c');
  });
});
