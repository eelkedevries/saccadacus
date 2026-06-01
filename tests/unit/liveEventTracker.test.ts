import { describe, expect, it } from 'vitest';
import { LiveEventTracker } from '../../src/events/liveEventTracker';
import { MockTrackingBackend } from '../../src/tracking/MockTrackingBackend';
import type { MockProgramme } from '../../src/tracking/MockTrackingBackend';

const programme: MockProgramme = {
  frameIntervalMs: 5, // fine resolution for clean detection
  saccades: [
    { atMs: 1000, durationMs: 50, amplitude: 0.3, directionDeg: 0 },
    { atMs: 3000, durationMs: 50, amplitude: 0.3, directionDeg: 180 },
  ],
  blinks: [{ atMs: 2000, durationMs: 120 }],
  headPoseChanges: [],
  dropouts: [],
};

describe('LiveEventTracker', () => {
  it('counts programmed saccades and blinks from a mock stream', () => {
    const backend = new MockTrackingBackend(programme);
    const tracker = new LiveEventTracker({ windowMs: 60_000 });
    // Feed frames at the programme's synthetic cadence using frameAt.
    for (let t = 0; t <= 3500; t += 5) {
      tracker.ingest(backend.frameAt(t, t));
    }
    expect(tracker.saccadeCount).toBeGreaterThanOrEqual(2);
    expect(tracker.blinkCount).toBeGreaterThanOrEqual(1);
  });

  it('does not count saccades during the blink window', () => {
    const blinkOnly: MockProgramme = {
      frameIntervalMs: 5,
      saccades: [],
      blinks: [{ atMs: 500, durationMs: 150 }],
      headPoseChanges: [],
      dropouts: [],
    };
    const backend = new MockTrackingBackend(blinkOnly);
    const tracker = new LiveEventTracker({ windowMs: 60_000 });
    for (let t = 0; t <= 1000; t += 5) {
      tracker.ingest(backend.frameAt(t, t));
    }
    expect(tracker.saccadeCount).toBe(0);
    expect(tracker.blinkCount).toBeGreaterThanOrEqual(1);
  });

  it('reset clears counts and history', () => {
    const backend = new MockTrackingBackend(programme);
    const tracker = new LiveEventTracker({ windowMs: 60_000 });
    for (let t = 0; t <= 1200; t += 5) {
      tracker.ingest(backend.frameAt(t, t));
    }
    tracker.reset();
    expect(tracker.saccadeCount).toBe(0);
    expect(tracker.blinkCount).toBe(0);
  });
});
