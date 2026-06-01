import { describe, expect, it } from 'vitest';
import { SignalPipeline } from '../../src/signals/signalPipeline';
import { buildSessionCsv, extractTimeseries } from '../../src/export/sessionExport';
import { parseCombinedCsv } from '../../src/export/combinedCsv';
import type { TrackingFrameResult } from '../../src/tracking/TrackingBackend';
import type { SaccadeEvent, BlinkEvent } from '../../src/tracking/TrackingBackend';
import type { DotRecord } from '../../src/tasks/followTheDots/followTheDotsController';

function frame(tsMs: number, x: number): TrackingFrameResult {
  return {
    pageTimestampMs: tsMs,
    faceReliability: 0.9,
    leftEye: {
      irisCentre: { xLocal: x, yLocal: 0, reliability: 0.8 },
      selected: 'iris',
      selectedReliability: 0.8,
      blinkState: 'open',
    },
    rightEye: {
      irisCentre: { xLocal: x, yLocal: 0, reliability: 0.7 },
      selected: 'iris',
      selectedReliability: 0.7,
      blinkState: 'open',
    },
    headPose: { yawDeg: 2, pitchDeg: 1, rollDeg: 0, reliability: 0.9 },
  };
}

describe('extractTimeseries', () => {
  it('produces aligned samples with head pose matched by timestamp', () => {
    const p = new SignalPipeline(16);
    p.ingest(frame(0, 0.1));
    p.ingest(frame(33, 0.2));
    const ts = extractTimeseries(p.signalBuffer, p.headBuffer);
    expect(ts).toHaveLength(2);
    expect(ts[0]!.timestampPerformanceNow).toBe(0);
    expect(ts[0]!.leftEyeXLocal).toBeCloseTo(0.1, 5);
    expect(ts[0]!.headYaw).toBeCloseTo(2);
  });
});

describe('buildSessionCsv', () => {
  const saccade: SaccadeEvent = {
    onsetMs: 100,
    offsetMs: 150,
    durationMs: 50,
    direction: { x: 1, y: 0 },
    relativeAmplitude: 0.3,
    selectedSignal: 'iris',
    eyeSelectionMode: 'binocular',
    headMotionLabel: 'saccade_head_still',
    confidence: 0.8,
  };
  const blink: BlinkEvent = {
    onsetMs: 200,
    offsetMs: 320,
    durationMs: 120,
    eye: 'both',
    confidence: 0.9,
  };
  const dot: DotRecord = {
    xScreen: 0.4,
    yScreen: 0.6,
    onsetMs: 400,
    offsetMs: 1600,
    trackingMode: 'iris',
    eyeSelectionMode: 'binocular',
    reliabilityAtOnset: 0.8,
  };

  it('produces a single CSV with all three row types', () => {
    const p = new SignalPipeline(16);
    p.ingest(frame(0, 0.1));
    p.ingest(frame(33, 0.2));
    const csv = buildSessionCsv({
      timeseries: extractTimeseries(p.signalBuffer, p.headBuffer),
      saccades: [saccade],
      blinks: [blink],
      dots: [dot],
      trackingMode: 'iris',
      eyeSelectionMode: 'binocular',
      camera: { widthPx: 640, heightPx: 480, frameRateHz: 30 },
    });
    const parsed = parseCombinedCsv(csv);
    const types = parsed.rows.map((r) => r.row_type);
    expect(types).toContain('timeseries');
    expect(types).toContain('event');
    expect(types).toContain('dot');
    expect(types.filter((t) => t === 'timeseries')).toHaveLength(2);
    expect(types.filter((t) => t === 'event')).toHaveLength(2); // saccade + blink
    expect(types.filter((t) => t === 'dot')).toHaveLength(1);
  });

  it('records actual camera settings on time-series rows', () => {
    const p = new SignalPipeline(16);
    p.ingest(frame(0, 0.1));
    const csv = buildSessionCsv({
      timeseries: extractTimeseries(p.signalBuffer, p.headBuffer),
      saccades: [],
      blinks: [],
      dots: [],
      trackingMode: 'iris',
      eyeSelectionMode: 'binocular',
      camera: { widthPx: 1280, heightPx: 720, frameRateHz: 24 },
    });
    const parsed = parseCombinedCsv(csv);
    const tsRow = parsed.rows.find((r) => r.row_type === 'timeseries')!;
    expect(parseFloat(tsRow.camera_actual_width_px!)).toBe(1280);
    expect(parseFloat(tsRow.camera_actual_frame_rate_hz!)).toBe(24);
  });

  it('does not include any raw landmark columns', () => {
    const csv = buildSessionCsv({
      timeseries: [],
      saccades: [],
      blinks: [],
      dots: [dot],
      trackingMode: 'iris',
      eyeSelectionMode: 'binocular',
    });
    const header = csv.split('\n')[0]!;
    expect(header).not.toMatch(/landmark/i);
    expect(header).not.toMatch(/raw/i);
  });
});
