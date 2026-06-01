import { describe, expect, it } from 'vitest';
import {
  GazeMappingService,
  collectGazeSamples,
  fitGazeVariants,
  gazeVariantId,
} from '../../src/tasks/gazeMapping/gazeMappingService';
import type { TimeseriesSample } from '../../src/export/sessionExport';
import type { DotRecord } from '../../src/tasks/followTheDots/followTheDotsController';

/**
 * Build a synthetic session where the binocular eye-local x/y map linearly to
 * the dot positions, so the binocular variant should fit well.
 */
function syntheticSession(): { dots: DotRecord[]; timeseries: TimeseriesSample[] } {
  const dots: DotRecord[] = [];
  const timeseries: TimeseriesSample[] = [];
  let t = 0;
  const positions = [
    [0.1, 0.1],
    [0.9, 0.1],
    [0.1, 0.9],
    [0.9, 0.9],
    [0.5, 0.5],
    [0.3, 0.7],
    [0.7, 0.3],
  ];
  for (const [px, py] of positions) {
    const onsetMs = t;
    // eye-local signal proportional to dot position (a clean linear relation)
    const xLocal = (px! - 0.5) * 0.4;
    const yLocal = (py! - 0.5) * 0.4;
    for (let k = 0; k < 5; k++) {
      timeseries.push({
        timestampPerformanceNow: t,
        leftEyeXLocal: xLocal,
        leftEyeYLocal: yLocal,
        rightEyeXLocal: xLocal,
        rightEyeYLocal: yLocal,
        binocularXLocal: xLocal,
        binocularYLocal: yLocal,
        leftEyeReliability: 0.8,
        rightEyeReliability: 0.8,
        headYaw: 0,
        headPitch: 0,
      });
      t += 33;
    }
    dots.push({
      xScreen: px!,
      yScreen: py!,
      onsetMs,
      offsetMs: t,
      trackingMode: 'iris',
      eyeSelectionMode: 'binocular',
      reliabilityAtOnset: 0.8,
    });
    t += 33;
  }
  return { dots, timeseries };
}

describe('collectGazeSamples', () => {
  it('produces one sample per dot, averaging the window', () => {
    const { dots, timeseries } = syntheticSession();
    const samples = collectGazeSamples(dots, timeseries, 'binocular');
    expect(samples).toHaveLength(dots.length);
    expect(samples[0]!.targetX).toBeCloseTo(0.1);
  });

  it('skips dots with no samples in their window', () => {
    const dots: DotRecord[] = [
      { xScreen: 0.5, yScreen: 0.5, onsetMs: 10_000, offsetMs: 11_000, trackingMode: 'iris', eyeSelectionMode: 'binocular', reliabilityAtOnset: 0.8 },
    ];
    expect(collectGazeSamples(dots, [], 'binocular')).toHaveLength(0);
  });
});

describe('fitGazeVariants', () => {
  it('fits iris variants and ranks by reliability', () => {
    const { dots, timeseries } = syntheticSession();
    const variants = fitGazeVariants(dots, timeseries);
    expect(variants.map((v) => v.id)).toContain(gazeVariantId('iris', 'binocular'));
    // sorted descending
    for (let i = 1; i < variants.length; i++) {
      expect(variants[i - 1]!.model.reliability).toBeGreaterThanOrEqual(
        variants[i]!.model.reliability,
      );
    }
    // the clean binocular relation should fit well
    const bino = variants.find((v) => v.eye === 'binocular')!;
    expect(bino.model.reliability).toBeGreaterThan(0.9);
  });
});

describe('GazeMappingService', () => {
  it('fits, reports availability, and switches the active variant', () => {
    const { dots, timeseries } = syntheticSession();
    const service = new GazeMappingService();
    const variants = service.fit(dots, timeseries);
    expect(service.isAvailable()).toBe(true);
    expect(service.getActive()?.id).toBe(variants[0]!.id);

    const other = variants[1]!.id;
    service.setActive(other);
    expect(service.getActive()?.id).toBe(other);
  });
});
