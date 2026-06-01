import { describe, expect, it } from 'vitest';
import {
  blinksToBands,
  dotsToBands,
  saccadesToBands,
} from '../../src/visualisation/eventMarkers';
import type { BlinkEvent, DotEvent, SaccadeEvent } from '../../src/tracking/TrackingBackend';

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

describe('event marker bands', () => {
  it('maps saccades to bands', () => {
    expect(saccadesToBands([saccade])).toEqual([{ startMs: 100, endMs: 150, kind: 'saccade' }]);
  });

  it('maps blinks to bands', () => {
    expect(blinksToBands([blink])).toEqual([{ startMs: 200, endMs: 320, kind: 'blink' }]);
  });

  it('maps dots, using onset when there is no offset', () => {
    const withOffset: DotEvent = { onsetMs: 10, offsetMs: 40, xScreen: 0, yScreen: 0 };
    const withoutOffset: DotEvent = { onsetMs: 50, xScreen: 0, yScreen: 0 };
    expect(dotsToBands([withOffset, withoutOffset])).toEqual([
      { startMs: 10, endMs: 40, kind: 'dot' },
      { startMs: 50, endMs: 50, kind: 'dot' },
    ]);
  });
});
