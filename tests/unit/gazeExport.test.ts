import { describe, expect, it } from 'vitest';
import { buildSessionCsv } from '../../src/export/sessionExport';
import type { TimeseriesSample } from '../../src/export/sessionExport';
import { parseCombinedCsv } from '../../src/export/combinedCsv';
import { fitGazeMap } from '../../src/tasks/gazeMapping/fitGazeMap';
import type { GazeVariantModel } from '../../src/tasks/gazeMapping/gazeMappingService';

const timeseries: TimeseriesSample[] = [
  {
    timestampPerformanceNow: 0,
    leftEyeXLocal: 0.1,
    leftEyeYLocal: 0.0,
    rightEyeXLocal: 0.1,
    rightEyeYLocal: 0.0,
    binocularXLocal: 0.1,
    binocularYLocal: 0.0,
    leftEyeReliability: 0.8,
    rightEyeReliability: 0.8,
    headYaw: 0,
    headPitch: 0,
  },
];

function identityVariant(): GazeVariantModel {
  // A model with known coefficients: gaze_x = 2*xLocal, gaze_y = 3*yLocal + 0.5.
  // xLocal and yLocal must vary independently or the fit is underdetermined.
  const xs = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.2, 0.1];
  const ys = [0.3, 0.0, 0.45, 0.1, 0.25, 0.4, 0.05, 0.2, 0.35, 0.15, 0.4, 0.0];
  const model = fitGazeMap(
    xs.map((xLocal, i) => {
      const yLocal = ys[i]!;
      return {
        features: { xLocal, yLocal, yawDeg: 0, pitchDeg: 0 },
        targetX: 2 * xLocal,
        targetY: 3 * yLocal + 0.5,
      };
    }),
  );
  return { id: 'iris_binocular', signal: 'iris', eye: 'binocular', model };
}

describe('gaze columns in combined CSV', () => {
  it('populates gaze_* columns when a gaze model is provided', () => {
    const gaze = identityVariant();
    const csv = buildSessionCsv({
      timeseries,
      saccades: [],
      blinks: [],
      dots: [],
      trackingMode: 'iris',
      eyeSelectionMode: 'binocular',
      gaze,
    });
    const parsed = parseCombinedCsv(csv);
    const tsRow = parsed.rows.find((r) => r.row_type === 'timeseries')!;
    expect(parseFloat(tsRow.gaze_x_mapped!)).toBeCloseTo(2 * 0.1, 3);
    expect(parseFloat(tsRow.gaze_y_mapped!)).toBeCloseTo(0.5, 3);
    expect(tsRow.gaze_mapping_id).toBe('iris_binocular');
    expect(parseFloat(tsRow.gaze_mapping_reliability!)).toBeGreaterThan(0.99);
  });

  it('leaves gaze columns empty when no gaze model is provided', () => {
    const csv = buildSessionCsv({
      timeseries,
      saccades: [],
      blinks: [],
      dots: [],
      trackingMode: 'iris',
      eyeSelectionMode: 'binocular',
    });
    const parsed = parseCombinedCsv(csv);
    const tsRow = parsed.rows.find((r) => r.row_type === 'timeseries')!;
    expect(tsRow.gaze_x_mapped).toBe('');
    expect(tsRow.gaze_mapping_id).toBe('');
  });

  it('still retains the original eye-local signal alongside the mapped output', () => {
    const csv = buildSessionCsv({
      timeseries,
      saccades: [],
      blinks: [],
      dots: [],
      trackingMode: 'iris',
      eyeSelectionMode: 'binocular',
      gaze: identityVariant(),
    });
    const parsed = parseCombinedCsv(csv);
    const tsRow = parsed.rows.find((r) => r.row_type === 'timeseries')!;
    expect(parseFloat(tsRow.binocular_x_local!)).toBeCloseTo(0.1);
    expect(parseFloat(tsRow.left_eye_x_local!)).toBeCloseTo(0.1);
  });
});
