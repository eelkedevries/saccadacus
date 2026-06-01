/**
 * Follow-the-dots task (PROPOSAL.md §11).
 *
 * Presents dots at random screen positions until the user stops. Each dot
 * records its normalised screen position, onset and offset/replacement
 * timestamps, the active tracking and eye modes, and the reliability at onset.
 * All timestamps use the same `performance.now()` clock as the tracking data,
 * so dots align with the eye-local and head-pose time series (§11, §13).
 */
import type {
  DotEvent,
  EyeSelectionMode,
  TrackingMode,
} from '../../tracking/TrackingBackend';

export interface DotRecord {
  /** Normalised screen position in [0, 1]. */
  xScreen: number;
  yScreen: number;
  onsetMs: number;
  offsetMs?: number;
  trackingMode: TrackingMode;
  eyeSelectionMode: EyeSelectionMode;
  reliabilityAtOnset: number;
}

export interface FollowTheDotsOptions {
  trackingMode: TrackingMode;
  eyeSelectionMode: EyeSelectionMode;
  /** Injectable RNG for deterministic tests; defaults to Math.random. */
  rng?: () => number;
  /** Margin keeping dots away from screen edges, normalised. */
  margin?: number;
}

export class FollowTheDotsController {
  private readonly rng: () => number;
  private readonly margin: number;
  private dots: DotRecord[] = [];
  private active: DotRecord | undefined;
  private running = false;

  constructor(private options: FollowTheDotsOptions) {
    this.rng = options.rng ?? Math.random;
    this.margin = options.margin ?? 0.05;
  }

  isRunning(): boolean {
    return this.running;
  }

  current(): DotRecord | undefined {
    return this.active;
  }

  /** Begin the task and place the first dot. */
  start(nowMs: number, reliabilityAtOnset: number): void {
    if (this.running) return;
    this.dots = [];
    this.running = true;
    this.active = this.placeDot(nowMs, reliabilityAtOnset);
  }

  /** Close the current dot and place a new one. */
  advance(nowMs: number, reliabilityAtOnset: number): void {
    if (!this.running) return;
    if (this.active) {
      this.active.offsetMs = nowMs;
      this.dots.push(this.active);
    }
    this.active = this.placeDot(nowMs, reliabilityAtOnset);
  }

  /** Stop the task, closing the current dot. */
  stop(nowMs: number): void {
    if (!this.running) return;
    if (this.active) {
      this.active.offsetMs = nowMs;
      this.dots.push(this.active);
      this.active = undefined;
    }
    this.running = false;
  }

  /** All recorded dots, including the active one if running. */
  getDots(): DotRecord[] {
    return this.active ? [...this.dots, this.active] : [...this.dots];
  }

  toDotEvents(): DotEvent[] {
    return this.getDots().map((d) => ({
      onsetMs: d.onsetMs,
      offsetMs: d.offsetMs,
      xScreen: d.xScreen,
      yScreen: d.yScreen,
    }));
  }

  private placeDot(nowMs: number, reliabilityAtOnset: number): DotRecord {
    const span = 1 - 2 * this.margin;
    return {
      xScreen: this.margin + this.rng() * span,
      yScreen: this.margin + this.rng() * span,
      onsetMs: nowMs,
      trackingMode: this.options.trackingMode,
      eyeSelectionMode: this.options.eyeSelectionMode,
      reliabilityAtOnset,
    };
  }
}
