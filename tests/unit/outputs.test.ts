import { describe, expect, it } from 'vitest';
import { buildEventsCsv, buildPrimaryCsv, buildSecondaryCsv } from '../../src/export/outputs';
import type { TimeseriesSample } from '../../src/export/sessionExport';
import type { SaccadeEvent, BlinkEvent } from '../../src/tracking/TrackingBackend';
import type { DotRecord } from '../../src/tasks/followTheDots/followTheDotsController';

function sample(ts: number, x: number, y: number, rel = 0.8): TimeseriesSample {
  return {
    timestampPerformanceNow: ts,
    leftEyeXLocal: x,
    leftEyeYLocal: y,
    rightEyeXLocal: x,
    rightEyeYLocal: y,
    binocularXLocal: x,
    binocularYLocal: y,
    leftEyeReliability: rel,
    rightEyeReliability: rel,
    headYaw: 0,
    headPitch: 0,
    headRoll: 0,
  };
}

const saccade: SaccadeEvent = {
  onsetMs: 100,
  offsetMs: 150,
  durationMs: 50,
  direction: { x: 1, y: 0 }, // 0 degrees, participant's right
  relativeAmplitude: 0.3,
  selectedSignal: 'iris',
  eyeSelectionMode: 'binocular',
  headMotionLabel: 'saccade_head_still',
  confidence: 0.8,
};

const blink: BlinkEvent = {
  onsetMs: 200,
  offsetMs: 250,
  durationMs: 50,
  eye: 'both',
  confidence: 0.9,
};

const dot: DotRecord = {
  xScreen: 0.4,
  yScreen: 0.6,
  onsetMs: 0,
  offsetMs: 500,
  trackingMode: 'iris',
  eyeSelectionMode: 'binocular',
  reliabilityAtOnset: 0.8,
};

function lines(csv: string): string[] {
  return csv.split('\n');
}

function cellsForRow(csv: string, header: string, predicate: (cells: string[]) => boolean): string[] {
  const all = lines(csv);
  const cols = (all[0] as string).split(',');
  const idx = cols.indexOf(header);
  expect(idx).toBeGreaterThanOrEqual(0);
  for (const row of all.slice(1)) {
    const cs = row.split(',');
    if (predicate(cs)) return cs;
  }
  throw new Error('No row matched predicate');
}

describe('buildPrimaryCsv', () => {
  const timeseries = [
    sample(0, 0, 0),
    sample(100, 0.1, 0),
    sample(125, 0.2, 0),
    sample(200, 0.25, 0),
    sample(225, 0.25, 0),
  ];
  const input = {
    timeseries,
    saccades: [saccade],
    blinks: [blink],
    dots: [dot],
    trackingMode: 'iris' as const,
    eyeSelectionMode: 'binocular' as const,
  };

  it('emits the prescribed header', () => {
    const csv = buildPrimaryCsv(input);
    expect(lines(csv)[0]).toBe(
      'timestamp,eye_x,eye_y,eye_p,saccade_event,saccade_direction,saccade_magnitude,blink,tracking_mode',
    );
  });

  it('emits one row per time point in order', () => {
    const all = lines(buildPrimaryCsv(input));
    expect(all).toHaveLength(timeseries.length + 1);
    const timestamps = all.slice(1).map((r) => Number(r.split(',')[0]));
    expect(timestamps).toEqual([0, 100, 125, 200, 225]);
  });

  it('flags saccade_event for each sample inside the saccade window', () => {
    const all = lines(buildPrimaryCsv(input));
    const idxFor = (t: number): number => all.findIndex((r) => r.startsWith(`${t},`));
    const get = (row: string, col: number): string => row.split(',')[col] as string;
    expect(get(all[idxFor(0)] as string, 4)).toBe('0');
    expect(get(all[idxFor(100)] as string, 4)).toBe('1');
    expect(get(all[idxFor(125)] as string, 4)).toBe('1');
    expect(get(all[idxFor(200)] as string, 4)).toBe('0');
  });

  it('writes saccade_direction and saccade_magnitude only at the onset row', () => {
    const csv = buildPrimaryCsv(input);
    const all = lines(csv);
    const onset = all.find((r) => r.startsWith('100,')) as string;
    const ongoing = all.find((r) => r.startsWith('125,')) as string;
    const onsetCells = onset.split(',');
    const ongoingCells = ongoing.split(',');
    expect(onsetCells[5]).toBe('0'); // direction 0 degrees for {x:1,y:0}
    expect(Number(onsetCells[6])).toBeCloseTo(0.3);
    expect(ongoingCells[5]).toBe(''); // empty on subsequent ongoing samples
    expect(ongoingCells[6]).toBe('0');
  });

  it('flags blink for each sample inside the blink window', () => {
    const csv = buildPrimaryCsv(input);
    const all = lines(csv);
    const inBlink = all.find((r) => r.startsWith('225,')) as string;
    const cells = inBlink.split(',');
    expect(cells[7]).toBe('1'); // blink ongoing
  });

  it('uses the selected eye mode for eye_x/eye_y/eye_p', () => {
    const csv = buildPrimaryCsv({
      ...input,
      timeseries: [
        {
          ...sample(0, 0, 0),
          leftEyeXLocal: 0.5,
          rightEyeXLocal: 0.1,
          leftEyeReliability: 0.4,
          rightEyeReliability: 0.9,
        },
      ],
      eyeSelectionMode: 'right',
    });
    const cells = (lines(csv)[1] as string).split(',');
    expect(Number(cells[1])).toBeCloseTo(0.1);
    expect(Number(cells[3])).toBeCloseTo(0.9);
  });

  it('writes the tracking_mode label on every row', () => {
    const csv = buildPrimaryCsv(input);
    for (const row of lines(csv).slice(1)) {
      const cells = row.split(',');
      expect(cells[cells.length - 1]).toBe('iris_binocular');
    }
  });

  it('encodes a 90-degree direction for a {x:0,y:1} saccade vector', () => {
    const csv = buildPrimaryCsv({
      ...input,
      saccades: [{ ...saccade, direction: { x: 0, y: 1 } }],
    });
    const onset = (lines(csv).find((r) => r.startsWith('100,')) as string).split(',');
    expect(Number(onset[5])).toBeCloseTo(90);
  });
});

describe('buildSecondaryCsv', () => {
  const timeseries = [sample(0, 0, 0), sample(100, 0.1, 0), sample(200, 0.2, 0)];
  const input = {
    timeseries,
    saccades: [saccade],
    blinks: [blink],
    dots: [dot],
    trackingMode: 'iris' as const,
    eyeSelectionMode: 'binocular' as const,
    camera: { widthPx: 640, heightPx: 480, frameRateHz: 30 },
  };

  it('emits one row per time point with the full column set', () => {
    const all = lines(buildSecondaryCsv(input));
    const header = all[0] as string;
    expect(all).toHaveLength(timeseries.length + 1);
    for (const required of [
      'timestamp_performance_now',
      'left_eye_x_local',
      'binocular_x_local',
      'head_yaw',
      'saccade_ongoing',
      'saccade_onset_direction_deg',
      'blink_ongoing',
      'dot_active',
      'gaze_x_mapped',
      'camera_actual_width_px',
    ]) {
      expect(header.split(',')).toContain(required);
    }
  });

  it('marks dot_active when a dot covers the sample', () => {
    const csv = buildSecondaryCsv(input);
    const cells = cellsForRow(csv, 'dot_active', (cs) => cs[0] === '100');
    const cols = (lines(csv)[0] as string).split(',');
    const dotActive = cells[cols.indexOf('dot_active')];
    const dotX = cells[cols.indexOf('dot_x')];
    expect(dotActive).toBe('1');
    expect(Number(dotX)).toBeCloseTo(0.4);
  });

  it('does not include raw landmark columns', () => {
    const csv = buildSecondaryCsv(input);
    const header = (lines(csv)[0] as string).toLowerCase();
    expect(header).not.toMatch(/landmark/);
    expect(header).not.toMatch(/raw/);
  });

  it('records camera actual settings on each row', () => {
    const csv = buildSecondaryCsv(input);
    const cols = (lines(csv)[0] as string).split(',');
    const idx = cols.indexOf('camera_actual_width_px');
    for (const row of lines(csv).slice(1)) {
      expect(Number(row.split(',')[idx])).toBe(640);
    }
  });
});

describe('buildEventsCsv', () => {
  const input = {
    timeseries: [],
    saccades: [saccade],
    blinks: [blink],
    dots: [] as DotRecord[],
    trackingMode: 'iris' as const,
    eyeSelectionMode: 'binocular' as const,
  };

  it('emits the prescribed header', () => {
    expect(lines(buildEventsCsv(input))[0]).toBe(
      'event_type,onset_timestamp,offset_timestamp,duration_ms,direction_deg,magnitude',
    );
  });

  it('emits one row per event, sorted by onset', () => {
    const all = lines(buildEventsCsv(input));
    expect(all).toHaveLength(3); // header + saccade + blink
    expect((all[1] as string).split(',')[0]).toBe('saccade'); // onset 100
    expect((all[2] as string).split(',')[0]).toBe('blink'); // onset 200
  });

  it('fills direction and magnitude for saccades only', () => {
    const all = lines(buildEventsCsv(input));
    const sac = (all[1] as string).split(',');
    const bli = (all[2] as string).split(',');
    expect(Number(sac[1])).toBe(100); // onset
    expect(Number(sac[2])).toBe(150); // offset
    expect(Number(sac[3])).toBe(50); // duration
    expect(Number(sac[4])).toBeCloseTo(0); // direction 0 deg
    expect(Number(sac[5])).toBeCloseTo(0.3); // magnitude
    expect(bli[4]).toBe(''); // blink direction empty
    expect(bli[5]).toBe(''); // blink magnitude empty
    expect(Number(bli[3])).toBe(50); // blink duration
  });
});
