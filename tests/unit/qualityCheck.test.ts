import { describe, expect, it } from 'vitest';
import { assessQuality } from '../../src/tasks/qualityCheck/qualityCheck';
import type { QualityStepResult } from '../../src/tasks/qualityCheck/qualityCheck';
import { QualityCheckController } from '../../src/tasks/qualityCheck/qualityCheckController';

function goodResults(irisRel = 0.8, pupilRel = 0.5): QualityStepResult[] {
  return [
    { id: 'look_left', observedDx: -0.2, observedDy: 0, irisReliability: irisRel, pupilReliability: pupilRel },
    { id: 'look_right', observedDx: 0.2, observedDy: 0, irisReliability: irisRel, pupilReliability: pupilRel },
    { id: 'look_up', observedDx: 0, observedDy: 0.2, irisReliability: irisRel, pupilReliability: pupilRel },
    { id: 'look_down', observedDx: 0, observedDy: -0.2, irisReliability: irisRel, pupilReliability: pupilRel },
  ];
}

describe('assessQuality', () => {
  it('passes when all directions are correct and reliability is high', () => {
    const a = assessQuality(goodResults());
    expect(a.directionsOk).toBe(true);
    expect(a.signalReliable).toBe(true);
    expect(a.recommendedSignal).toBe('iris');
  });

  it('fails directions when a movement is in the wrong direction', () => {
    const results = goodResults();
    results[0]!.observedDx = 0.2; // look_left moved right
    const a = assessQuality(results);
    expect(a.directionsOk).toBe(false);
    expect(a.signalReliable).toBe(false);
  });

  it('fails directions when movement is too weak', () => {
    const results = goodResults();
    results[2]!.observedDy = 0.01; // look_up barely moved
    expect(assessQuality(results).directionsOk).toBe(false);
  });

  it('recommends pupil when pupil reliability is higher', () => {
    const a = assessQuality(goodResults(0.4, 0.85));
    expect(a.recommendedSignal).toBe('pupil');
  });

  it('marks unreliable when reliability is low despite correct directions', () => {
    const a = assessQuality(goodResults(0.2, 0.2));
    expect(a.directionsOk).toBe(true);
    expect(a.signalReliable).toBe(false);
  });
});

describe('QualityCheckController', () => {
  it('steps through all instructions and produces an assessment', () => {
    const c = new QualityCheckController();
    c.begin();
    // look_left: move left
    c.ingest({ xLocal: 0, yLocal: 0, irisReliability: 0.8, pupilReliability: 0.4 });
    c.ingest({ xLocal: -0.2, yLocal: 0, irisReliability: 0.8, pupilReliability: 0.4 });
    c.endStep();
    // remaining steps with minimal samples
    while (!c.isComplete()) {
      c.ingest({ xLocal: 0, yLocal: 0, irisReliability: 0.8, pupilReliability: 0.4 });
      c.endStep();
    }
    const results = c.getResults();
    expect(results[0]!.id).toBe('look_left');
    expect(results[0]!.observedDx).toBeCloseTo(-0.2);
    expect(c.assess().recommendedSignal).toBe('iris');
  });
});
