/**
 * Saccade detection from the eye-local signal (PROPOSAL.md §7, §8).
 *
 * Pure and velocity-threshold based: a saccade is a run of samples whose
 * eye-local speed exceeds an onset threshold, bracketed by the surrounding
 * sub-threshold samples. Detection considers eye-local displacement and
 * velocity, selected-signal reliability, left/right consistency, blink state,
 * head-pose state, and landmark stability (§7). Direction and amplitude are in
 * the eye-local frame (no gaze mapping yet).
 */
import type {
  EyeSelectionMode,
  SaccadeEvent,
  Selection,
} from '../tracking/TrackingBackend';
import {
  DEFAULT_HEAD_MOTION_THRESHOLDS,
  headMotionConfidenceFactor,
  labelHeadMotion,
} from './headMotionLabels';

export interface SaccadeDetectorSample {
  tsMs: number;
  /** Selected eye-local position. */
  x: number;
  y: number;
  /** Eye-local speed, eye-width units per second. */
  speed: number;
  /** Selected-signal reliability, 0..1. */
  reliability: number;
  /** True during a blink or eye-signal loss. */
  blink: boolean;
  /** True when left and right eyes agree (binocular consistency). */
  binocularConsistent: boolean;
  /** Head angular speed at this sample, degrees per second. */
  headSpeedDegPerSec: number;
  /** Head-pose reliability, 0..1. */
  headReliability: number;
}

export interface SaccadeDetectorConfig {
  selectedSignal: Selection;
  eyeSelectionMode: EyeSelectionMode;
  onsetSpeed?: number;
  offsetSpeed?: number;
  minDurationMs?: number;
  maxDurationMs?: number;
  minAmplitude?: number;
  stillMaxDegPerSec?: number;
  movingMaxDegPerSec?: number;
  minHeadReliability?: number;
}

interface ResolvedConfig {
  onsetSpeed: number;
  offsetSpeed: number;
  minDurationMs: number;
  maxDurationMs: number;
  minAmplitude: number;
}

const DEFAULTS: ResolvedConfig = {
  onsetSpeed: 1.0,
  offsetSpeed: 0.4,
  minDurationMs: 8,
  maxDurationMs: 200,
  minAmplitude: 0.03,
};

export function detectSaccades(
  samples: SaccadeDetectorSample[],
  config: SaccadeDetectorConfig,
): SaccadeEvent[] {
  const cfg: ResolvedConfig = {
    onsetSpeed: config.onsetSpeed ?? DEFAULTS.onsetSpeed,
    offsetSpeed: config.offsetSpeed ?? DEFAULTS.offsetSpeed,
    minDurationMs: config.minDurationMs ?? DEFAULTS.minDurationMs,
    maxDurationMs: config.maxDurationMs ?? DEFAULTS.maxDurationMs,
    minAmplitude: config.minAmplitude ?? DEFAULTS.minAmplitude,
  };
  const thresholds = {
    stillMaxDegPerSec: config.stillMaxDegPerSec ?? DEFAULT_HEAD_MOTION_THRESHOLDS.stillMaxDegPerSec,
    movingMaxDegPerSec:
      config.movingMaxDegPerSec ?? DEFAULT_HEAD_MOTION_THRESHOLDS.movingMaxDegPerSec,
    minReliability: config.minHeadReliability ?? DEFAULT_HEAD_MOTION_THRESHOLDS.minReliability,
  };

  const events: SaccadeEvent[] = [];
  const n = samples.length;
  let i = 0;
  while (i < n) {
    if ((samples[i] as SaccadeDetectorSample).speed < cfg.onsetSpeed) {
      i += 1;
      continue;
    }
    // Run of samples at or above the offset speed, starting from the crossing.
    const runStart = i;
    let runEnd = i;
    while (runEnd + 1 < n && (samples[runEnd + 1] as SaccadeDetectorSample).speed >= cfg.offsetSpeed) {
      runEnd += 1;
    }

    // Bracket with the surrounding sub-threshold samples for clean endpoints.
    const onsetIdx = Math.max(0, runStart - 1);
    const offsetIdx = Math.min(n - 1, runEnd + 1);
    const onset = samples[onsetIdx] as SaccadeDetectorSample;
    const offset = samples[offsetIdx] as SaccadeDetectorSample;

    i = runEnd + 1;

    // Blink-related signal loss must not be classified as a saccade (§7).
    if (containsBlink(samples, onsetIdx, offsetIdx)) {
      continue;
    }

    const dx = offset.x - onset.x;
    const dy = offset.y - onset.y;
    const amplitude = Math.hypot(dx, dy);
    const durationMs = offset.tsMs - onset.tsMs;
    if (amplitude < cfg.minAmplitude) continue;
    if (durationMs < cfg.minDurationMs || durationMs > cfg.maxDurationMs) continue;

    const peakHeadSpeed = peakHeadSpeedOver(samples, runStart, runEnd);
    const meanHeadReliability = meanHeadReliabilityOver(samples, runStart, runEnd);
    const headMotionLabel = labelHeadMotion(
      { peakHeadSpeedDegPerSec: peakHeadSpeed, headReliability: meanHeadReliability },
      thresholds,
    );

    const meanReliability = meanReliabilityOver(samples, runStart, runEnd);
    const consistencyFactor = consistencyOver(samples, runStart, runEnd);
    const confidence = clamp01(
      meanReliability * consistencyFactor * headMotionConfidenceFactor(headMotionLabel),
    );

    const inv = amplitude === 0 ? 0 : 1 / amplitude;
    events.push({
      onsetMs: onset.tsMs,
      offsetMs: offset.tsMs,
      durationMs,
      direction: { x: dx * inv, y: dy * inv },
      relativeAmplitude: amplitude,
      selectedSignal: config.selectedSignal,
      eyeSelectionMode: config.eyeSelectionMode,
      headMotionLabel,
      confidence,
    });
  }
  return events;
}

function containsBlink(samples: SaccadeDetectorSample[], from: number, to: number): boolean {
  for (let i = from; i <= to; i++) {
    if ((samples[i] as SaccadeDetectorSample).blink) return true;
  }
  return false;
}

function peakHeadSpeedOver(samples: SaccadeDetectorSample[], from: number, to: number): number {
  let peak = 0;
  for (let i = from; i <= to; i++) {
    peak = Math.max(peak, (samples[i] as SaccadeDetectorSample).headSpeedDegPerSec);
  }
  return peak;
}

function meanReliabilityOver(samples: SaccadeDetectorSample[], from: number, to: number): number {
  return meanOver(samples, from, to, (s) => s.reliability);
}

function meanHeadReliabilityOver(
  samples: SaccadeDetectorSample[],
  from: number,
  to: number,
): number {
  return meanOver(samples, from, to, (s) => s.headReliability);
}

function consistencyOver(samples: SaccadeDetectorSample[], from: number, to: number): number {
  return meanOver(samples, from, to, (s) => (s.binocularConsistent ? 1 : 0.6));
}

function meanOver(
  samples: SaccadeDetectorSample[],
  from: number,
  to: number,
  pick: (s: SaccadeDetectorSample) => number,
): number {
  let sum = 0;
  let count = 0;
  for (let i = from; i <= to; i++) {
    sum += pick(samples[i] as SaccadeDetectorSample);
    count += 1;
  }
  return count === 0 ? 0 : sum / count;
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
