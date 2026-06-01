import { describe, expect, it } from 'vitest';
import { detectBlinks } from '../../src/events/detectBlinks';
import type { BlinkDetectorSample } from '../../src/events/detectBlinks';
import type { BlinkState } from '../../src/tracking/TrackingBackend';

function samples(states: [number, BlinkState][]): BlinkDetectorSample[] {
  return states.map(([tsMs, blinkState]) => ({ tsMs, blinkState, reliability: 0.5 }));
}

describe('detectBlinks', () => {
  it('detects a single complete blink', () => {
    const s = samples([
      [0, 'open'],
      [33, 'closing'],
      [66, 'closed'],
      [99, 'opening'],
      [132, 'open'],
    ]);
    const blinks = detectBlinks(s);
    expect(blinks).toHaveLength(1);
    expect(blinks[0]?.onsetMs).toBe(33);
    expect(blinks[0]?.offsetMs).toBe(132);
    expect(blinks[0]?.durationMs).toBe(99);
    expect(blinks[0]?.confidence).toBeCloseTo(0.9); // reached closed
    expect(blinks[0]?.eye).toBe('both');
  });

  it('detects two separate blinks', () => {
    const s = samples([
      [0, 'open'],
      [10, 'closed'],
      [20, 'open'],
      [30, 'open'],
      [40, 'closed'],
      [50, 'open'],
    ]);
    expect(detectBlinks(s)).toHaveLength(2);
  });

  it('assigns lower confidence when closed is never reached', () => {
    const s = samples([
      [0, 'open'],
      [10, 'closing'],
      [20, 'opening'],
      [30, 'open'],
    ]);
    const blinks = detectBlinks(s);
    expect(blinks).toHaveLength(1);
    expect(blinks[0]?.confidence).toBeCloseTo(0.6);
  });

  it('returns no blinks for an all-open series', () => {
    expect(detectBlinks(samples([[0, 'open'], [10, 'open']]))).toHaveLength(0);
  });

  it('honours the eye option', () => {
    const blinks = detectBlinks(samples([[0, 'closed'], [10, 'open']]), { eye: 'left' });
    expect(blinks[0]?.eye).toBe('left');
  });
});
