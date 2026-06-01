/**
 * Gaze-mapping service (PROPOSAL.md §12).
 *
 * Builds per-dot training samples from the recorded time series and fits a
 * gaze map for each available eye/signal variant. Only iris-based variants are
 * fitted while the backend provides no separate pupil signal; the structure
 * admits pupil variants when that signal becomes available. Each variant
 * reports its fit reliability so the UI can offer switching among the reliable
 * ones.
 */
import type { DotRecord } from '../followTheDots/followTheDotsController';
import type { TimeseriesSample } from '../../export/sessionExport';
import { fitGazeMap } from './fitGazeMap';
import type { GazeMapModel, GazeSample } from './fitGazeMap';

export type GazeEye = 'left' | 'right' | 'binocular';
export type GazeSignal = 'iris' | 'pupil';

export interface GazeVariantModel {
  id: string;
  signal: GazeSignal;
  eye: GazeEye;
  model: GazeMapModel;
}

/** Variant id, e.g. "iris_binocular". */
export function gazeVariantId(signal: GazeSignal, eye: GazeEye): string {
  return `${signal}_${eye}`;
}

function eyeLocal(sample: TimeseriesSample, eye: GazeEye): { x: number; y: number } {
  switch (eye) {
    case 'left':
      return { x: sample.leftEyeXLocal, y: sample.leftEyeYLocal };
    case 'right':
      return { x: sample.rightEyeXLocal, y: sample.rightEyeYLocal };
    case 'binocular':
      return { x: sample.binocularXLocal, y: sample.binocularYLocal };
  }
}

/**
 * Build training samples for one variant: per dot, average the eye-local signal
 * and head pose over the dot's display window. Dots with no samples in window
 * are skipped.
 */
export function collectGazeSamples(
  dots: DotRecord[],
  timeseries: TimeseriesSample[],
  eye: GazeEye,
): GazeSample[] {
  const samples: GazeSample[] = [];
  for (const dot of dots) {
    const end = dot.offsetMs ?? Number.POSITIVE_INFINITY;
    const inWindow = timeseries.filter(
      (s) => s.timestampPerformanceNow >= dot.onsetMs && s.timestampPerformanceNow <= end,
    );
    if (inWindow.length === 0) continue;

    let sumX = 0;
    let sumY = 0;
    let sumYaw = 0;
    let sumPitch = 0;
    for (const s of inWindow) {
      const local = eyeLocal(s, eye);
      sumX += local.x;
      sumY += local.y;
      sumYaw += s.headYaw ?? 0;
      sumPitch += s.headPitch ?? 0;
    }
    const n = inWindow.length;
    samples.push({
      features: { xLocal: sumX / n, yLocal: sumY / n, yawDeg: sumYaw / n, pitchDeg: sumPitch / n },
      targetX: dot.xScreen,
      targetY: dot.yScreen,
    });
  }
  return samples;
}

/**
 * Fit a gaze map for each available eye variant of the iris signal. Returns the
 * variants sorted by descending reliability.
 */
export function fitGazeVariants(
  dots: DotRecord[],
  timeseries: TimeseriesSample[],
): GazeVariantModel[] {
  const eyes: GazeEye[] = ['left', 'right', 'binocular'];
  const variants: GazeVariantModel[] = eyes.map((eye) => {
    const samples = collectGazeSamples(dots, timeseries, eye);
    return {
      id: gazeVariantId('iris', eye),
      signal: 'iris',
      eye,
      model: fitGazeMap(samples),
    };
  });
  return variants.sort((a, b) => b.model.reliability - a.model.reliability);
}

/** Holds the fitted variants and the currently selected one. */
export class GazeMappingService {
  private variants: GazeVariantModel[] = [];
  private activeId: string | null = null;

  fit(dots: DotRecord[], timeseries: TimeseriesSample[]): GazeVariantModel[] {
    this.variants = fitGazeVariants(dots, timeseries);
    this.activeId = this.variants[0]?.id ?? null;
    return this.variants;
  }

  getVariants(): GazeVariantModel[] {
    return this.variants;
  }

  isAvailable(): boolean {
    return this.variants.some((v) => v.model.reliability > 0);
  }

  setActive(id: string): void {
    if (this.variants.some((v) => v.id === id)) {
      this.activeId = id;
    }
  }

  getActive(): GazeVariantModel | undefined {
    return this.variants.find((v) => v.id === this.activeId);
  }
}
