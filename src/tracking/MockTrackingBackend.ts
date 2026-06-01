/**
 * Deterministic synthetic tracking backend.
 *
 * `MockTrackingBackend` is the default backend through Phase 7 (AGENTS.md hard
 * rules). It produces a reproducible stream of eye-local, head-pose, and
 * reliability signals containing programmable saccades, blinks, head-pose
 * movements, and tracking dropouts (PROPOSAL.md §20). It performs no camera or
 * computer-vision work and ignores the frame pixels entirely.
 *
 * The synthetic timeline is driven by an internal frame counter, not by the
 * incoming `pageTimestampMs`, so the same seed and programme always yield the
 * same sequence regardless of wall-clock timing. `pageTimestampMs` is echoed
 * back unchanged in every result, as the single canonical clock requires
 * (PROPOSAL.md §24).
 */
import type {
  BlinkState,
  EyeFeatureResult,
  HeadPoseResult,
  TrackingBackend,
  TrackingBackendConfig,
  TrackingFrameResult,
  VideoFrameLike,
} from './TrackingBackend';

export interface MockSaccadeSpec {
  /** Synthetic-time onset, milliseconds. */
  atMs: number;
  durationMs: number;
  /** Eye-local amplitude in eye-width units. */
  amplitude: number;
  /** Direction in degrees; 0 = participant's right, 90 = up (PROPOSAL.md §5). */
  directionDeg: number;
}

export interface MockBlinkSpec {
  atMs: number;
  durationMs: number;
}

export interface MockHeadPoseSpec {
  atMs: number;
  durationMs: number;
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

export interface MockDropoutSpec {
  atMs: number;
  durationMs: number;
}

export interface MockProgramme {
  /** Synthetic time advanced per processed frame, milliseconds. */
  frameIntervalMs: number;
  saccades: MockSaccadeSpec[];
  blinks: MockBlinkSpec[];
  headPoseChanges: MockHeadPoseSpec[];
  dropouts: MockDropoutSpec[];
}

/** Pre-resolved saccade with absolute from/to fixation positions. */
interface ResolvedSaccade {
  onsetMs: number;
  offsetMs: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

const DEG_TO_RAD = Math.PI / 180;
const DEFAULT_FRAME_INTERVAL_MS = 1000 / 30;

/** Deterministic value noise in [-1, 1) from integer salts. No internal state. */
function noise(seed: number, salt: number, n: number): number {
  let t = (seed ^ Math.imul(salt, 0x9e3779b1) ^ Math.imul(n, 0x85ebca77)) >>> 0;
  t = Math.imul(t ^ (t >>> 15), 1 | t);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
}

/** Mulberry32 PRNG used only to synthesise a default programme from a seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDefaultProgramme(seed: number): MockProgramme {
  const rand = mulberry32(seed || 1);
  const saccades: MockSaccadeSpec[] = [];
  for (let i = 0; i < 5; i++) {
    saccades.push({
      atMs: 800 + i * 1600 + Math.floor(rand() * 200),
      durationMs: 40 + Math.floor(rand() * 30),
      amplitude: 0.1 + rand() * 0.25,
      directionDeg: Math.floor(rand() * 360),
    });
  }
  const blinks: MockBlinkSpec[] = [];
  for (let i = 0; i < 3; i++) {
    blinks.push({ atMs: 1200 + i * 2500 + Math.floor(rand() * 300), durationMs: 120 });
  }
  const headPoseChanges: MockHeadPoseSpec[] = [];
  for (let i = 0; i < 2; i++) {
    headPoseChanges.push({
      atMs: 2000 + i * 3500,
      durationMs: 600,
      yawDeg: (rand() * 2 - 1) * 12,
      pitchDeg: (rand() * 2 - 1) * 8,
      rollDeg: (rand() * 2 - 1) * 5,
    });
  }
  const dropouts: MockDropoutSpec[] = [{ atMs: 5200, durationMs: 250 }];
  return { frameIntervalMs: DEFAULT_FRAME_INTERVAL_MS, saccades, blinks, headPoseChanges, dropouts };
}

export class MockTrackingBackend implements TrackingBackend {
  private programme: MockProgramme;
  private readonly explicitProgramme: MockProgramme | undefined;
  private resolvedSaccades: ResolvedSaccade[] = [];
  private seed = 1;
  private frameIndex = 0;

  /**
   * @param programme Optional explicit programme. When omitted, a deterministic
   *   default programme is generated from `config.seed` at initialise time.
   */
  constructor(programme?: MockProgramme) {
    this.explicitProgramme = programme;
    this.programme = programme ?? buildDefaultProgramme(1);
    this.resolveSaccades();
  }

  initialise(config: TrackingBackendConfig): Promise<void> {
    this.seed = config.seed ?? 1;
    this.frameIndex = 0;
    this.programme = this.explicitProgramme ?? buildDefaultProgramme(this.seed);
    this.resolveSaccades();
    return Promise.resolve();
  }

  processFrame(_frame: VideoFrameLike, pageTimestampMs: number): Promise<TrackingFrameResult> {
    const tMs = this.frameIndex * this.programme.frameIntervalMs;
    this.frameIndex += 1;

    const result = this.frameAt(tMs, pageTimestampMs);
    return Promise.resolve(result);
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }

  /** Pure: the synthetic result for a given synthetic time. Exposed for tests. */
  frameAt(tMs: number, pageTimestampMs: number): TrackingFrameResult {
    if (this.inDropout(tMs)) {
      return { pageTimestampMs, faceReliability: 0.05 };
    }

    const blinkState = this.blinkStateAt(tMs);
    const blinkReliabilityFactor =
      blinkState === 'closed' ? 0.1 : blinkState === 'open' ? 1 : 0.5;

    const pos = this.eyeLocalAt(tMs);
    const headPose = this.headPoseAt(tMs);
    const faceReliability = clamp01(0.95 + 0.03 * noise(this.seed, 11, Math.round(tMs)));

    const leftEye = this.eyeResult(tMs, pos, blinkState, blinkReliabilityFactor, 1);
    const rightEye = this.eyeResult(tMs, pos, blinkState, blinkReliabilityFactor, 2);

    return {
      pageTimestampMs,
      videoMediaTimeMs: tMs,
      backendLatencyMs: 0,
      leftEye,
      rightEye,
      headPose,
      faceReliability,
    };
  }

  private resolveSaccades(): void {
    const ordered = [...this.programme.saccades].sort((a, b) => a.atMs - b.atMs);
    let x = 0;
    let y = 0;
    this.resolvedSaccades = ordered.map((s) => {
      const fromX = x;
      const fromY = y;
      x += s.amplitude * Math.cos(s.directionDeg * DEG_TO_RAD);
      y += s.amplitude * Math.sin(s.directionDeg * DEG_TO_RAD);
      return { onsetMs: s.atMs, offsetMs: s.atMs + s.durationMs, fromX, fromY, toX: x, toY: y };
    });
  }

  private eyeLocalAt(tMs: number): { x: number; y: number } {
    let x = 0;
    let y = 0;
    for (const s of this.resolvedSaccades) {
      if (tMs >= s.offsetMs) {
        x = s.toX;
        y = s.toY;
      } else if (tMs >= s.onsetMs) {
        const progress = (tMs - s.onsetMs) / (s.offsetMs - s.onsetMs);
        x = s.fromX + (s.toX - s.fromX) * progress;
        y = s.fromY + (s.toY - s.fromY) * progress;
        break;
      } else {
        break;
      }
    }
    return { x, y };
  }

  private eyeResult(
    tMs: number,
    pos: { x: number; y: number },
    blinkState: BlinkState,
    reliabilityFactor: number,
    salt: number,
  ): EyeFeatureResult {
    const jitterX = 0.002 * noise(this.seed, salt * 10 + 1, Math.round(tMs));
    const jitterY = 0.002 * noise(this.seed, salt * 10 + 2, Math.round(tMs));
    const xLocal = pos.x + jitterX;
    const yLocal = pos.y + jitterY;
    const irisReliability = clamp01(
      (0.9 + 0.05 * noise(this.seed, salt * 10 + 3, Math.round(tMs))) * reliabilityFactor,
    );
    const pupilReliability = clamp01(
      (0.7 + 0.08 * noise(this.seed, salt * 10 + 4, Math.round(tMs))) * reliabilityFactor,
    );
    return {
      irisCentre: { xLocal, yLocal, reliability: irisReliability },
      pupilCentre: { xLocal, yLocal, reliability: pupilReliability },
      selected: 'iris',
      selectedReliability: irisReliability,
      blinkState,
    };
  }

  private headPoseAt(tMs: number): HeadPoseResult {
    let yawDeg = 0.3 * noise(this.seed, 21, Math.round(tMs));
    let pitchDeg = 0.3 * noise(this.seed, 22, Math.round(tMs));
    let rollDeg = 0.2 * noise(this.seed, 23, Math.round(tMs));
    for (const h of this.programme.headPoseChanges) {
      if (tMs >= h.atMs && tMs < h.atMs + h.durationMs) {
        const progress = (tMs - h.atMs) / h.durationMs;
        const factor = Math.sin(Math.PI * progress);
        yawDeg += h.yawDeg * factor;
        pitchDeg += h.pitchDeg * factor;
        rollDeg += h.rollDeg * factor;
      }
    }
    return { yawDeg, pitchDeg, rollDeg, translationX: 0, translationY: 0, translationZ: 0, reliability: 0.9 };
  }

  private blinkStateAt(tMs: number): BlinkState {
    for (const b of this.programme.blinks) {
      if (tMs >= b.atMs && tMs < b.atMs + b.durationMs) {
        const progress = (tMs - b.atMs) / b.durationMs;
        if (progress < 0.25) return 'closing';
        if (progress < 0.6) return 'closed';
        return 'opening';
      }
    }
    return 'open';
  }

  private inDropout(tMs: number): boolean {
    return this.programme.dropouts.some((d) => tMs >= d.atMs && tMs < d.atMs + d.durationMs);
  }
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
