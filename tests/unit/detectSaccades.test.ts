import { describe, expect, it } from 'vitest';
import { MockTrackingBackend } from '../../src/tracking/MockTrackingBackend';
import type { MockProgramme } from '../../src/tracking/MockTrackingBackend';
import { velocitySeries } from '../../src/signals/velocity';
import { detectSaccades } from '../../src/events/detectSaccades';
import type { SaccadeDetectorSample } from '../../src/events/detectSaccades';

const config = { selectedSignal: 'iris' as const, eyeSelectionMode: 'left' as const };

/** Build clean detector samples from the mock's left-eye position. */
function sampleMock(
  programme: MockProgramme,
  fromMs: number,
  toMs: number,
  stepMs: number,
  ctx: { headSpeedDegPerSec: number; headReliability: number } = {
    headSpeedDegPerSec: 0,
    headReliability: 0.9,
  },
): SaccadeDetectorSample[] {
  const backend = new MockTrackingBackend(programme);
  const xs: number[] = [];
  const ys: number[] = [];
  const ts: number[] = [];
  const blink: boolean[] = [];
  for (let t = fromMs; t <= toMs; t += stepMs) {
    const r = backend.frameAt(t, t);
    const eye = r.leftEye?.irisCentre;
    xs.push(eye?.xLocal ?? 0);
    ys.push(eye?.yLocal ?? 0);
    ts.push(t);
    blink.push((r.leftEye?.blinkState ?? 'open') !== 'open');
  }
  const speeds = velocitySeries(xs, ys, ts);
  return ts.map((tsMs, i) => ({
    tsMs,
    x: xs[i] as number,
    y: ys[i] as number,
    speed: speeds[i] as number,
    reliability: 0.9,
    blink: blink[i] as boolean,
    binocularConsistent: true,
    headSpeedDegPerSec: ctx.headSpeedDegPerSec,
    headReliability: ctx.headReliability,
  }));
}

const rightwardProgramme: MockProgramme = {
  frameIntervalMs: 1000 / 30,
  saccades: [{ atMs: 1000, durationMs: 50, amplitude: 0.3, directionDeg: 0 }],
  blinks: [],
  headPoseChanges: [],
  dropouts: [],
};

describe('detectSaccades', () => {
  it('finds a programmed rightward saccade with correct sign and plausible timing', () => {
    const samples = sampleMock(rightwardProgramme, 800, 1300, 5);
    const events = detectSaccades(samples, config);
    expect(events).toHaveLength(1);
    const ev = events[0]!;
    expect(ev.direction.x).toBeGreaterThan(0.8); // participant's right (§5)
    expect(Math.abs(ev.direction.y)).toBeLessThan(0.3);
    expect(ev.relativeAmplitude).toBeGreaterThan(0.2);
    expect(ev.onsetMs).toBeGreaterThanOrEqual(980);
    expect(ev.onsetMs).toBeLessThanOrEqual(1010);
    expect(ev.offsetMs).toBeGreaterThanOrEqual(1045);
    expect(ev.offsetMs).toBeLessThanOrEqual(1075);
    expect(ev.selectedSignal).toBe('iris');
    expect(ev.eyeSelectionMode).toBe('left');
  });

  it('detects a leftward saccade as negative x', () => {
    const leftward: MockProgramme = {
      ...rightwardProgramme,
      saccades: [{ atMs: 1000, durationMs: 50, amplitude: 0.3, directionDeg: 180 }],
    };
    const events = detectSaccades(sampleMock(leftward, 800, 1300, 5), config);
    expect(events).toHaveLength(1);
    expect(events[0]!.direction.x).toBeLessThan(-0.8);
  });

  it('labels a still head context', () => {
    const events = detectSaccades(
      sampleMock(rightwardProgramme, 800, 1300, 5, { headSpeedDegPerSec: 3, headReliability: 0.9 }),
      config,
    );
    expect(events[0]!.headMotionLabel).toBe('saccade_head_still');
  });

  it('labels a moderate head-movement context', () => {
    const events = detectSaccades(
      sampleMock(rightwardProgramme, 800, 1300, 5, { headSpeedDegPerSec: 30, headReliability: 0.9 }),
      config,
    );
    expect(events[0]!.headMotionLabel).toBe('saccade_during_head_movement');
    // moderate motion should reduce confidence below the still case
    expect(events[0]!.confidence).toBeLessThan(0.9);
  });

  it('labels an extreme head-movement context as uncertain', () => {
    const events = detectSaccades(
      sampleMock(rightwardProgramme, 800, 1300, 5, { headSpeedDegPerSec: 150, headReliability: 0.9 }),
      config,
    );
    expect(events[0]!.headMotionLabel).toBe('uncertain_head_motion');
  });

  it('does not classify a blink-time position jump as a saccade', () => {
    // High-speed displacement, but every sample is flagged as a blink.
    const base = 0;
    const samples: SaccadeDetectorSample[] = [];
    for (let i = 0; i < 10; i++) {
      samples.push({
        tsMs: base + i * 5,
        x: i < 5 ? 0 : 0.4, // big jump mid-run
        y: 0,
        speed: i === 5 ? 80 : 0.1,
        reliability: 0.3,
        blink: true,
        binocularConsistent: false,
        headSpeedDegPerSec: 2,
        headReliability: 0.9,
      });
    }
    expect(detectSaccades(samples, config)).toHaveLength(0);
  });

  it('ignores low-amplitude jitter below threshold', () => {
    const flat: MockProgramme = { ...rightwardProgramme, saccades: [] };
    expect(detectSaccades(sampleMock(flat, 0, 1000, 5), config)).toHaveLength(0);
  });
});
