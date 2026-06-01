import { describe, expect, it } from 'vitest';
import {
  chooseSelection,
  combineBinocular,
  eyeSelectionReliability,
  smoothReliability,
} from '../../src/signals/reliability';

describe('chooseSelection', () => {
  it('forces iris or pupil when the mode is explicit', () => {
    expect(chooseSelection('iris', 0.1, 0.9)).toBe('iris');
    expect(chooseSelection('pupil', 0.9, 0.1)).toBe('pupil');
  });

  it('auto-selects the more reliable signal', () => {
    expect(chooseSelection('auto', 0.4, 0.8)).toBe('pupil');
    expect(chooseSelection('auto', 0.8, 0.4)).toBe('iris');
  });

  it('breaks ties toward iris', () => {
    expect(chooseSelection('auto', 0.5, 0.5)).toBe('iris');
  });
});

describe('combineBinocular', () => {
  it('weights by reliability', () => {
    // right fully reliable, left not at all -> right value
    expect(combineBinocular(0, 0, 10, 1)).toBeCloseTo(10);
    // equal reliability -> mean
    expect(combineBinocular(0, 0.5, 10, 0.5)).toBeCloseTo(5);
    // 3:1 weighting
    expect(combineBinocular(0, 0.75, 10, 0.25)).toBeCloseTo(2.5);
  });

  it('falls back to the plain mean when both weights are zero', () => {
    expect(combineBinocular(2, 0, 6, 0)).toBeCloseTo(4);
  });
});

describe('eyeSelectionReliability', () => {
  it('reports per-mode reliability', () => {
    expect(eyeSelectionReliability('left', 0.3, 0.7)).toBe(0.3);
    expect(eyeSelectionReliability('right', 0.3, 0.7)).toBe(0.7);
    expect(eyeSelectionReliability('binocular', 0.3, 0.7)).toBeCloseTo(0.5);
    expect(eyeSelectionReliability('both', 0.3, 0.7)).toBe(0.7);
  });
});

describe('smoothReliability', () => {
  it('moves toward the new sample by alpha', () => {
    expect(smoothReliability(0, 1, 0.5)).toBeCloseTo(0.5);
    expect(smoothReliability(1, 0, 0.25)).toBeCloseTo(0.75);
  });
});
