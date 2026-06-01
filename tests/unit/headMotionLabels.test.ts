import { describe, expect, it } from 'vitest';
import {
  headMotionConfidenceFactor,
  labelHeadMotion,
} from '../../src/events/headMotionLabels';

describe('labelHeadMotion', () => {
  it('labels a still head', () => {
    expect(
      labelHeadMotion({ peakHeadSpeedDegPerSec: 5, headReliability: 0.9 }),
    ).toBe('saccade_head_still');
  });

  it('labels moderate head movement', () => {
    expect(
      labelHeadMotion({ peakHeadSpeedDegPerSec: 30, headReliability: 0.9 }),
    ).toBe('saccade_during_head_movement');
  });

  it('labels extreme head movement as uncertain', () => {
    expect(
      labelHeadMotion({ peakHeadSpeedDegPerSec: 120, headReliability: 0.9 }),
    ).toBe('uncertain_head_motion');
  });

  it('labels low head reliability as uncertain regardless of speed', () => {
    expect(
      labelHeadMotion({ peakHeadSpeedDegPerSec: 1, headReliability: 0.1 }),
    ).toBe('uncertain_head_motion');
  });

  it('respects custom thresholds at the boundary', () => {
    const thresholds = { stillMaxDegPerSec: 10, movingMaxDegPerSec: 20, minReliability: 0.3 };
    expect(
      labelHeadMotion({ peakHeadSpeedDegPerSec: 10, headReliability: 1 }, thresholds),
    ).toBe('saccade_head_still');
    expect(
      labelHeadMotion({ peakHeadSpeedDegPerSec: 10.1, headReliability: 1 }, thresholds),
    ).toBe('saccade_during_head_movement');
    expect(
      labelHeadMotion({ peakHeadSpeedDegPerSec: 20.1, headReliability: 1 }, thresholds),
    ).toBe('uncertain_head_motion');
  });

  it('maps labels to descending confidence factors', () => {
    expect(headMotionConfidenceFactor('saccade_head_still')).toBeGreaterThan(
      headMotionConfidenceFactor('saccade_during_head_movement'),
    );
    expect(headMotionConfidenceFactor('saccade_during_head_movement')).toBeGreaterThan(
      headMotionConfidenceFactor('uncertain_head_motion'),
    );
  });
});
