/**
 * Reliability aggregation and signal selection (PROPOSAL.md §4, §5).
 *
 * Reliability is tracked per eye and per signal type (iris/pupil). `auto` mode
 * picks whichever signal type is currently more reliable; manual `iris`/`pupil`
 * modes force the choice. Binocular combination is a reliability-weighted
 * average of the available eye signals. All functions are pure.
 */
import type { EyeSelectionMode, Selection, TrackingMode } from '../tracking/TrackingBackend';

/**
 * Choose the signal type for a frame. `auto` selects the higher reliability,
 * breaking ties toward iris (the default for ordinary webcam use, §4).
 */
export function chooseSelection(
  mode: TrackingMode,
  irisReliability: number,
  pupilReliability: number,
): Selection {
  if (mode === 'iris') return 'iris';
  if (mode === 'pupil') return 'pupil';
  return pupilReliability > irisReliability ? 'pupil' : 'iris';
}

/**
 * Reliability-weighted average of two values. When both weights are zero the
 * plain mean is returned so the output stays defined.
 */
export function combineBinocular(
  leftValue: number,
  leftReliability: number,
  rightValue: number,
  rightReliability: number,
): number {
  const wl = Math.max(0, leftReliability);
  const wr = Math.max(0, rightReliability);
  const total = wl + wr;
  if (total === 0) {
    return (leftValue + rightValue) / 2;
  }
  return (leftValue * wl + rightValue * wr) / total;
}

/**
 * The reliability scalar to report for a given eye-selection mode. For `both`
 * the higher of the two eyes is reported, since either may be inspected.
 */
export function eyeSelectionReliability(
  mode: EyeSelectionMode,
  leftReliability: number,
  rightReliability: number,
): number {
  switch (mode) {
    case 'left':
      return leftReliability;
    case 'right':
      return rightReliability;
    case 'binocular':
      return (leftReliability + rightReliability) / 2;
    case 'both':
      return Math.max(leftReliability, rightReliability);
  }
}

/** Exponential moving average for smoothing a reliability scalar over time. */
export function smoothReliability(previous: number, sample: number, alpha = 0.2): number {
  const a = clamp01(alpha);
  return previous * (1 - a) + sample * a;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
