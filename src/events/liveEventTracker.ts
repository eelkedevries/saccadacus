/**
 * Live event tracker (PROPOSAL.md §7, §8, §23).
 *
 * Maintains a bounded window of detector samples from the incoming
 * `TrackingFrameResult` stream, runs the pure saccade and blink detectors, and
 * tracks cumulative event counts for the throttled status panel. It also
 * exposes the current events so the trace overlay can mark them.
 *
 * Detection is fed from the full frame result (which carries blink state and
 * head pose), so it does not depend on the numeric ring-buffer layout.
 */
import type {
  BlinkEvent,
  BlinkState,
  EyeSelectionMode,
  SaccadeEvent,
  Selection,
  TrackingFrameResult,
} from '../tracking/TrackingBackend';
import { combineBinocular } from '../signals/reliability';
import { detectSaccades } from './detectSaccades';
import type { SaccadeDetectorSample } from './detectSaccades';
import { detectBlinks } from './detectBlinks';
import type { BlinkDetectorSample } from './detectBlinks';

export interface LiveEventTrackerOptions {
  windowMs?: number;
  selectedSignal?: Selection;
  eyeSelectionMode?: EyeSelectionMode;
}

interface PrevState {
  x: number;
  y: number;
  tsMs: number;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  valid: boolean;
}

export interface LiveEventResult {
  saccades: SaccadeEvent[];
  blinks: BlinkEvent[];
  saccadeCount: number;
  blinkCount: number;
}

export class LiveEventTracker {
  private readonly windowMs: number;
  private readonly selectedSignal: Selection;
  private readonly eyeSelectionMode: EyeSelectionMode;

  private saccadeSamples: SaccadeDetectorSample[] = [];
  private blinkSamples: BlinkDetectorSample[] = [];
  private prev: PrevState = {
    x: 0,
    y: 0,
    tsMs: 0,
    yawDeg: 0,
    pitchDeg: 0,
    rollDeg: 0,
    valid: false,
  };

  private lastSaccadeOffsetMs = Number.NEGATIVE_INFINITY;
  private lastBlinkOffsetMs = Number.NEGATIVE_INFINITY;
  saccadeCount = 0;
  blinkCount = 0;

  constructor(options: LiveEventTrackerOptions = {}) {
    this.windowMs = options.windowMs ?? 10_000;
    this.selectedSignal = options.selectedSignal ?? 'iris';
    this.eyeSelectionMode = options.eyeSelectionMode ?? 'binocular';
  }

  ingest(result: TrackingFrameResult): LiveEventResult {
    const tsMs = result.pageTimestampMs;
    const left = result.leftEye?.irisCentre ?? result.leftEye?.pupilCentre;
    const right = result.rightEye?.irisCentre ?? result.rightEye?.pupilCentre;
    const leftRel = result.leftEye?.selectedReliability ?? 0;
    const rightRel = result.rightEye?.selectedReliability ?? 0;

    const x = combineBinocular(left?.xLocal ?? 0, leftRel, right?.xLocal ?? 0, rightRel);
    const y = combineBinocular(left?.yLocal ?? 0, leftRel, right?.yLocal ?? 0, rightRel);
    const reliability = Math.max(leftRel, rightRel);
    const blink = isBlink(result);

    const head = result.headPose;
    const yawDeg = head?.yawDeg ?? 0;
    const pitchDeg = head?.pitchDeg ?? 0;
    const rollDeg = head?.rollDeg ?? 0;

    const dtMs = tsMs - this.prev.tsMs;
    const speed =
      this.prev.valid && dtMs > 0 ? (Math.hypot(x - this.prev.x, y - this.prev.y) / dtMs) * 1000 : 0;
    const headSpeedDegPerSec =
      this.prev.valid && dtMs > 0
        ? (Math.hypot(yawDeg - this.prev.yawDeg, pitchDeg - this.prev.pitchDeg, rollDeg - this.prev.rollDeg) /
            dtMs) *
          1000
        : 0;

    const binocularConsistent =
      left !== undefined && right !== undefined
        ? Math.abs((left.xLocal ?? 0) - (right.xLocal ?? 0)) < 0.15
        : false;

    this.saccadeSamples.push({
      tsMs,
      x,
      y,
      speed,
      reliability,
      blink,
      binocularConsistent,
      headSpeedDegPerSec,
      headReliability: head?.reliability ?? 0,
    });
    this.blinkSamples.push({ tsMs, blinkState: combinedBlinkState(result), reliability });

    this.prev = { x, y, tsMs, yawDeg, pitchDeg, rollDeg, valid: true };
    this.trim(tsMs);

    const saccades = detectSaccades(this.saccadeSamples, {
      selectedSignal: this.selectedSignal,
      eyeSelectionMode: this.eyeSelectionMode,
    });
    const blinks = detectBlinks(this.blinkSamples);

    this.countNew(saccades, blinks);

    return {
      saccades,
      blinks,
      saccadeCount: this.saccadeCount,
      blinkCount: this.blinkCount,
    };
  }

  private countNew(saccades: SaccadeEvent[], blinks: BlinkEvent[]): void {
    for (const s of saccades) {
      if (s.offsetMs > this.lastSaccadeOffsetMs) {
        this.saccadeCount += 1;
        this.lastSaccadeOffsetMs = s.offsetMs;
      }
    }
    for (const b of blinks) {
      if (b.offsetMs > this.lastBlinkOffsetMs) {
        this.blinkCount += 1;
        this.lastBlinkOffsetMs = b.offsetMs;
      }
    }
  }

  private trim(nowMs: number): void {
    const cutoff = nowMs - this.windowMs;
    this.saccadeSamples = this.saccadeSamples.filter((s) => s.tsMs >= cutoff);
    this.blinkSamples = this.blinkSamples.filter((s) => s.tsMs >= cutoff);
  }

  reset(): void {
    this.saccadeSamples = [];
    this.blinkSamples = [];
    this.prev = { x: 0, y: 0, tsMs: 0, yawDeg: 0, pitchDeg: 0, rollDeg: 0, valid: false };
    this.lastSaccadeOffsetMs = Number.NEGATIVE_INFINITY;
    this.lastBlinkOffsetMs = Number.NEGATIVE_INFINITY;
    this.saccadeCount = 0;
    this.blinkCount = 0;
  }
}

function isBlink(result: TrackingFrameResult): boolean {
  const states = [result.leftEye?.blinkState, result.rightEye?.blinkState];
  return states.some((s) => s !== undefined && s !== 'open' && s !== 'unknown');
}

function combinedBlinkState(result: TrackingFrameResult): BlinkState {
  // Prefer the most "closed" of the two eyes for a combined blink signal.
  const order: Record<BlinkState, number> = {
    open: 0,
    unknown: 0,
    opening: 1,
    closing: 2,
    closed: 3,
  };
  const l = result.leftEye?.blinkState ?? 'open';
  const r = result.rightEye?.blinkState ?? 'open';
  return order[l] >= order[r] ? l : r;
}
