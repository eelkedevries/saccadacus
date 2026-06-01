/**
 * Calibration-free quality check (PROPOSAL.md §10).
 *
 * Guides the user through simple instructed eye and head movements to verify
 * signal direction, strength, reliability, and head-motion handling. This is a
 * functional check, NOT a gaze calibration. The assessment indicates whether
 * the current tracking and eye-selection modes are reliable and whether iris
 * or pupil tracking is currently better. User-facing strings use British
 * spelling and carry no marketing copy.
 */
import type { Selection } from '../../tracking/TrackingBackend';

export type QualityStepId =
  | 'look_left'
  | 'look_right'
  | 'look_up'
  | 'look_down'
  | 'blink'
  | 'head_still'
  | 'head_move';

export interface QualityStep {
  id: QualityStepId;
  instruction: string;
}

export const QUALITY_STEPS: ReadonlyArray<QualityStep> = [
  { id: 'look_left', instruction: 'Look to your left and hold.' },
  { id: 'look_right', instruction: 'Look to your right and hold.' },
  { id: 'look_up', instruction: 'Look up and hold.' },
  { id: 'look_down', instruction: 'Look down and hold.' },
  { id: 'blink', instruction: 'Blink a few times.' },
  { id: 'head_still', instruction: 'Keep your head still and look ahead.' },
  { id: 'head_move', instruction: 'Move your head slightly from side to side.' },
];

export interface QualityStepResult {
  id: QualityStepId;
  /** Net eye-local horizontal change observed during the step. */
  observedDx: number;
  /** Net eye-local vertical change observed during the step. */
  observedDy: number;
  irisReliability: number;
  pupilReliability: number;
}

export interface QualityThresholds {
  /** Minimum eye-local displacement to count a direction as confirmed. */
  minDisplacement: number;
  /** Minimum mean reliability for the recommended signal to be "reliable". */
  minReliability: number;
}

export const DEFAULT_QUALITY_THRESHOLDS: QualityThresholds = {
  minDisplacement: 0.05,
  minReliability: 0.5,
};

export interface QualityAssessment {
  /** True when every present direction step moved the signal correctly. */
  directionsOk: boolean;
  recommendedSignal: Selection;
  signalReliable: boolean;
  notes: string[];
}

/** Expected sign of (dx, dy) per direction step, from the participant view (§5). */
const EXPECTED: Partial<Record<QualityStepId, { axis: 'x' | 'y'; sign: 1 | -1 }>> = {
  look_left: { axis: 'x', sign: -1 },
  look_right: { axis: 'x', sign: 1 },
  look_up: { axis: 'y', sign: 1 },
  look_down: { axis: 'y', sign: -1 },
};

export function assessQuality(
  results: QualityStepResult[],
  thresholds: QualityThresholds = DEFAULT_QUALITY_THRESHOLDS,
): QualityAssessment {
  const notes: string[] = [];
  let directionsOk = true;

  for (const result of results) {
    const expected = EXPECTED[result.id];
    if (!expected) continue;
    const observed = expected.axis === 'x' ? result.observedDx : result.observedDy;
    const correctSign = Math.sign(observed) === expected.sign;
    const strongEnough = Math.abs(observed) >= thresholds.minDisplacement;
    if (!correctSign || !strongEnough) {
      directionsOk = false;
      notes.push(`Signal during "${result.id}" was weak or in the wrong direction.`);
    }
  }

  const irisMean = mean(results.map((r) => r.irisReliability));
  const pupilMean = mean(results.map((r) => r.pupilReliability));
  const recommendedSignal: Selection = pupilMean > irisMean ? 'pupil' : 'iris';
  const recommendedMean = recommendedSignal === 'pupil' ? pupilMean : irisMean;
  const signalReliable = directionsOk && recommendedMean >= thresholds.minReliability;

  notes.push(
    recommendedSignal === 'iris'
      ? 'Iris-centre tracking is currently the more reliable signal.'
      : 'Pupil-centre tracking is currently the more reliable signal.',
  );
  notes.push(
    signalReliable
      ? 'The current tracking and eye-selection modes appear reliable.'
      : 'The current tracking and eye-selection modes may be unreliable.',
  );

  return { directionsOk, recommendedSignal, signalReliable, notes };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}
