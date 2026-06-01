import { describe, expect, it } from 'vitest';
import { applyGazeMap, fitGazeMap } from '../../src/tasks/gazeMapping/fitGazeMap';
import type { GazeSample } from '../../src/tasks/gazeMapping/fitGazeMap';

/** Generate samples from a known linear mapping of the features. */
function syntheticSamples(
  mapX: (f: { xLocal: number; yLocal: number; yawDeg: number; pitchDeg: number }) => number,
  mapY: (f: { xLocal: number; yLocal: number; yawDeg: number; pitchDeg: number }) => number,
  noise = 0,
): GazeSample[] {
  const samples: GazeSample[] = [];
  let seed = 1;
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff) * 2 - 1;
  };
  for (let i = 0; i < 30; i++) {
    const features = {
      xLocal: rand() * 0.3,
      yLocal: rand() * 0.3,
      yawDeg: rand() * 10,
      pitchDeg: rand() * 10,
    };
    samples.push({
      features,
      targetX: mapX(features) + noise * rand(),
      targetY: mapY(features) + noise * rand(),
    });
  }
  return samples;
}

describe('fitGazeMap', () => {
  it('recovers a known linear mapping with high reliability', () => {
    const samples = syntheticSamples(
      (f) => 0.5 + 1.2 * f.xLocal + 0.1 * f.yawDeg,
      (f) => 0.4 + 1.5 * f.yLocal + 0.05 * f.pitchDeg,
    );
    const model = fitGazeMap(samples);
    expect(model.reliability).toBeGreaterThan(0.99);

    const probe = { xLocal: 0.2, yLocal: -0.1, yawDeg: 3, pitchDeg: -2 };
    const mapped = applyGazeMap(model, probe);
    expect(mapped.x).toBeCloseTo(0.5 + 1.2 * 0.2 + 0.1 * 3, 4);
    expect(mapped.y).toBeCloseTo(0.4 + 1.5 * -0.1 + 0.05 * -2, 4);
  });

  it('degrades reliability with noise but stays usable', () => {
    const clean = fitGazeMap(syntheticSamples((f) => f.xLocal, (f) => f.yLocal, 0));
    const noisy = fitGazeMap(syntheticSamples((f) => f.xLocal, (f) => f.yLocal, 0.5));
    expect(noisy.reliability).toBeLessThan(clean.reliability);
  });

  it('returns zero reliability when underdetermined', () => {
    const model = fitGazeMap([
      { features: { xLocal: 0, yLocal: 0, yawDeg: 0, pitchDeg: 0 }, targetX: 0, targetY: 0 },
    ]);
    expect(model.reliability).toBe(0);
    expect(model.sampleCount).toBe(1);
  });
});
