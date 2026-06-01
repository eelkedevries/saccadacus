import { beforeEach, describe, expect, it } from 'vitest';
import { MockTrackingBackend } from '../../src/tracking/MockTrackingBackend';
import type { MockProgramme } from '../../src/tracking/MockTrackingBackend';
import type { VideoFrameLike } from '../../src/tracking/TrackingBackend';

const frame: VideoFrameLike = document.createElement('canvas');

const config = { frameWidth: 640, frameHeight: 480, seed: 42 };

describe('MockTrackingBackend', () => {
  it('echoes pageTimestampMs back unchanged', async () => {
    const backend = new MockTrackingBackend();
    await backend.initialise(config);
    for (const ts of [0, 123.45, 9999.9, 1_000_000.25]) {
      const result = await backend.processFrame(frame, ts);
      expect(result.pageTimestampMs).toBe(ts);
    }
  });

  it('produces the same sequence for the same seed', async () => {
    const a = new MockTrackingBackend();
    const b = new MockTrackingBackend();
    await a.initialise(config);
    await b.initialise(config);

    const seqA = [];
    const seqB = [];
    for (let i = 0; i < 200; i++) {
      seqA.push(await a.processFrame(frame, i));
      seqB.push(await b.processFrame(frame, i));
    }
    expect(JSON.stringify(seqA)).toBe(JSON.stringify(seqB));
  });

  it('produces a different sequence for a different seed', async () => {
    const a = new MockTrackingBackend();
    const b = new MockTrackingBackend();
    await a.initialise({ ...config, seed: 1 });
    await b.initialise({ ...config, seed: 2 });

    const collect = async (backend: MockTrackingBackend): Promise<string> => {
      const out = [];
      for (let i = 0; i < 200; i++) out.push(await backend.processFrame(frame, i));
      return JSON.stringify(out);
    };
    expect(await collect(a)).not.toBe(await collect(b));
  });

  it('resets the synthetic timeline on initialise', async () => {
    const backend = new MockTrackingBackend();
    await backend.initialise(config);
    const first = await backend.processFrame(frame, 0);
    await backend.initialise(config);
    const firstAgain = await backend.processFrame(frame, 0);
    expect(JSON.stringify(firstAgain)).toBe(JSON.stringify(first));
  });

  describe('programmed segments', () => {
    let backend: MockTrackingBackend;
    const programme: MockProgramme = {
      frameIntervalMs: 1000 / 30,
      saccades: [{ atMs: 1000, durationMs: 50, amplitude: 0.3, directionDeg: 0 }],
      blinks: [{ atMs: 2000, durationMs: 120 }],
      headPoseChanges: [{ atMs: 3000, durationMs: 400, yawDeg: 15, pitchDeg: 0, rollDeg: 0 }],
      dropouts: [{ atMs: 4000, durationMs: 200 }],
    };

    beforeEach(async () => {
      backend = new MockTrackingBackend(programme);
      await backend.initialise(config);
    });

    it('contains a rightward saccade that shifts eye-local x positive', () => {
      const before = backend.frameAt(900, 0);
      const after = backend.frameAt(1100, 0);
      const xBefore = before.leftEye?.irisCentre?.xLocal ?? 0;
      const xAfter = after.leftEye?.irisCentre?.xLocal ?? 0;
      // Direction 0 deg is the participant's right -> positive x (§5).
      expect(xAfter - xBefore).toBeGreaterThan(0.25);
    });

    it('interpolates eye-local position within the saccade window', () => {
      const mid = backend.frameAt(1025, 0); // halfway through the 50 ms saccade
      const x = mid.leftEye?.irisCentre?.xLocal ?? 0;
      expect(x).toBeGreaterThan(0.1);
      expect(x).toBeLessThan(0.25);
    });

    it('contains a blink segment with non-open blink states', () => {
      expect(backend.frameAt(1900, 0).leftEye?.blinkState).toBe('open');
      expect(backend.frameAt(2010, 0).leftEye?.blinkState).toBe('closing');
      expect(backend.frameAt(2060, 0).leftEye?.blinkState).toBe('closed');
      expect(backend.frameAt(2100, 0).leftEye?.blinkState).toBe('opening');
    });

    it('lowers eye reliability during a blink', () => {
      const open = backend.frameAt(1900, 0).leftEye?.selectedReliability ?? 0;
      const closed = backend.frameAt(2060, 0).leftEye?.selectedReliability ?? 1;
      expect(closed).toBeLessThan(open);
    });

    it('contains a head-pose movement segment', () => {
      const still = Math.abs(backend.frameAt(2500, 0).headPose?.yawDeg ?? 0);
      const moving = Math.abs(backend.frameAt(3200, 0).headPose?.yawDeg ?? 0);
      expect(moving).toBeGreaterThan(still + 5);
    });

    it('contains a dropout segment with low face reliability and no eyes', () => {
      const normal = backend.frameAt(3800, 0);
      const dropped = backend.frameAt(4100, 0);
      expect(normal.leftEye).toBeDefined();
      expect(dropped.leftEye).toBeUndefined();
      expect(dropped.rightEye).toBeUndefined();
      expect(dropped.faceReliability).toBeLessThan(0.2);
    });

    it('still echoes pageTimestampMs during a dropout', () => {
      expect(backend.frameAt(4100, 777.5).pageTimestampMs).toBe(777.5);
    });
  });
});
