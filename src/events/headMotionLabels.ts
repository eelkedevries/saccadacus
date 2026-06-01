/**
 * Head-motion-aware event labelling (PROPOSAL.md §8).
 *
 * A detected saccade is labelled by the head-pose context during its window:
 *   - `saccade_head_still`           head essentially still,
 *   - `saccade_during_head_movement` moderate head motion, retained,
 *   - `uncertain_head_motion`        extreme/abrupt motion or unreliable head
 *                                    pose; marked unreliable.
 *
 * The v1 product intentionally does NOT model `head_movement_without_saccade`
 * or `compensatory_eye_movement` (PROPOSAL.md §8, §29).
 */
import type { HeadMotionLabel } from '../tracking/TrackingBackend';

export interface HeadMotionContext {
  /** Peak head angular speed during the event window, degrees per second. */
  peakHeadSpeedDegPerSec: number;
  /** Head-pose reliability during the window, 0..1. */
  headReliability: number;
}

export interface HeadMotionThresholds {
  stillMaxDegPerSec: number;
  movingMaxDegPerSec: number;
  minReliability: number;
}

export const DEFAULT_HEAD_MOTION_THRESHOLDS: HeadMotionThresholds = {
  stillMaxDegPerSec: 15,
  movingMaxDegPerSec: 60,
  minReliability: 0.4,
};

export function labelHeadMotion(
  context: HeadMotionContext,
  thresholds: HeadMotionThresholds = DEFAULT_HEAD_MOTION_THRESHOLDS,
): HeadMotionLabel {
  if (context.headReliability < thresholds.minReliability) {
    return 'uncertain_head_motion';
  }
  if (context.peakHeadSpeedDegPerSec <= thresholds.stillMaxDegPerSec) {
    return 'saccade_head_still';
  }
  if (context.peakHeadSpeedDegPerSec <= thresholds.movingMaxDegPerSec) {
    return 'saccade_during_head_movement';
  }
  return 'uncertain_head_motion';
}

/** Confidence multiplier reflecting how trustworthy the head-motion context is. */
export function headMotionConfidenceFactor(label: HeadMotionLabel): number {
  switch (label) {
    case 'saccade_head_still':
      return 1;
    case 'saccade_during_head_movement':
      return 0.7;
    case 'uncertain_head_motion':
      return 0.3;
  }
}
