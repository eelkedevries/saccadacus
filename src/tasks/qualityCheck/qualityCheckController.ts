/**
 * Quality-check runner (PROPOSAL.md §10).
 *
 * Steps through the instructed movements, accumulating eye-local displacement
 * and reliability per step, then produces a `QualityAssessment`. Pure of any
 * rendering concern so it can be unit-tested directly.
 */
import {
  QUALITY_STEPS,
  assessQuality,
} from './qualityCheck';
import type {
  QualityAssessment,
  QualityStep,
  QualityStepResult,
} from './qualityCheck';

export interface QualitySample {
  xLocal: number;
  yLocal: number;
  irisReliability: number;
  pupilReliability: number;
}

interface StepAccumulator {
  firstX: number;
  firstY: number;
  lastX: number;
  lastY: number;
  irisSum: number;
  pupilSum: number;
  count: number;
}

export class QualityCheckController {
  private stepIndex = -1;
  private accumulator: StepAccumulator | undefined;
  private readonly results: QualityStepResult[] = [];

  steps(): ReadonlyArray<QualityStep> {
    return QUALITY_STEPS;
  }

  currentStep(): QualityStep | undefined {
    return this.stepIndex >= 0 ? QUALITY_STEPS[this.stepIndex] : undefined;
  }

  isComplete(): boolean {
    return this.stepIndex >= QUALITY_STEPS.length;
  }

  /** Start the first step. */
  begin(): void {
    this.stepIndex = 0;
    this.results.length = 0;
    this.accumulator = undefined;
  }

  ingest(sample: QualitySample): void {
    if (this.stepIndex < 0 || this.isComplete()) return;
    if (!this.accumulator) {
      this.accumulator = {
        firstX: sample.xLocal,
        firstY: sample.yLocal,
        lastX: sample.xLocal,
        lastY: sample.yLocal,
        irisSum: sample.irisReliability,
        pupilSum: sample.pupilReliability,
        count: 1,
      };
      return;
    }
    this.accumulator.lastX = sample.xLocal;
    this.accumulator.lastY = sample.yLocal;
    this.accumulator.irisSum += sample.irisReliability;
    this.accumulator.pupilSum += sample.pupilReliability;
    this.accumulator.count += 1;
  }

  /** Finalise the current step and advance to the next. */
  endStep(): void {
    const step = this.currentStep();
    if (step && this.accumulator) {
      const a = this.accumulator;
      this.results.push({
        id: step.id,
        observedDx: a.lastX - a.firstX,
        observedDy: a.lastY - a.firstY,
        irisReliability: a.irisSum / a.count,
        pupilReliability: a.pupilSum / a.count,
      });
    }
    this.stepIndex += 1;
    this.accumulator = undefined;
  }

  getResults(): QualityStepResult[] {
    return [...this.results];
  }

  assess(): QualityAssessment {
    return assessQuality(this.results);
  }
}
