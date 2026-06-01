/**
 * Tracking backend interface and the core domain types for saccadacus.
 *
 * Every consumer of face, eye, and head information must depend on this module
 * rather than on any concrete computer-vision library (PROPOSAL.md §20). The
 * only directory permitted to import a CV/face-landmark library is
 * `src/tracking/backendAdapters/`.
 *
 * Sign convention (PROPOSAL.md §5, §21): eye-local `xLocal` is positive toward
 * the participant's right and negative toward their left; `yLocal` is positive
 * upward. The per-eye origin is the eye-corner midpoint and the normalisation
 * factor is the eye-corner distance (PROPOSAL.md §3).
 */

/** Concrete frame inputs accepted by a backend; conversion is the adapter's job. */
export type VideoFrameLike = ImageBitmap | VideoFrame | HTMLCanvasElement;

/** Configuration handed to a backend at initialisation time. */
export interface TrackingBackendConfig {
  /** Frame width in pixels the backend should expect. */
  frameWidth: number;
  /** Frame height in pixels the backend should expect. */
  frameHeight: number;
  /**
   * Optional seed for backends that produce deterministic output (the mock).
   * Real adapters may ignore it.
   */
  seed?: number;
}

export type Selection = 'iris' | 'pupil';
export type BlinkState = 'open' | 'closing' | 'closed' | 'opening' | 'unknown';

export interface EyeFeatureResult {
  irisCentre?: { xLocal: number; yLocal: number; reliability: number };
  pupilCentre?: { xLocal: number; yLocal: number; reliability: number };
  selected: Selection;
  selectedReliability: number;
  blinkState: BlinkState;
}

export interface HeadPoseResult {
  yawDeg: number;
  pitchDeg: number;
  rollDeg: number;
  translationX?: number;
  translationY?: number;
  translationZ?: number;
  reliability: number;
}

export interface TrackingFrameResult {
  /**
   * The `performance.now()` value captured by the caller at frame acquisition,
   * echoed back unchanged. This guarantees a single canonical clock even when
   * the backend runs in a Web Worker (PROPOSAL.md §24).
   */
  pageTimestampMs: number;
  videoMediaTimeMs?: number;
  backendLatencyMs?: number;
  leftEye?: EyeFeatureResult;
  rightEye?: EyeFeatureResult;
  headPose?: HeadPoseResult;
  faceReliability: number;
}

export type EyeSelectionMode = 'left' | 'right' | 'binocular' | 'both';
export type TrackingMode = 'auto' | 'iris' | 'pupil';
export type HeadMotionLabel =
  | 'saccade_head_still'
  | 'saccade_during_head_movement'
  | 'uncertain_head_motion';

export interface SaccadeEvent {
  onsetMs: number;
  offsetMs: number;
  durationMs: number;
  direction: { x: number; y: number };
  relativeAmplitude: number;
  selectedSignal: Selection;
  eyeSelectionMode: EyeSelectionMode;
  headMotionLabel: HeadMotionLabel;
  confidence: number;
}

export interface BlinkEvent {
  onsetMs: number;
  offsetMs: number;
  durationMs: number;
  eye: 'left' | 'right' | 'both';
  confidence: number;
}

export interface DotEvent {
  onsetMs: number;
  offsetMs?: number;
  xScreen: number;
  yScreen: number;
}

/**
 * The single interface through which the application obtains face, eye, and
 * head information. Concrete implementations live either at the project root
 * (`MockTrackingBackend`) or, for real CV models, exclusively under
 * `src/tracking/backendAdapters/`.
 */
export interface TrackingBackend {
  initialise(config: TrackingBackendConfig): Promise<void>;
  processFrame(frame: VideoFrameLike, pageTimestampMs: number): Promise<TrackingFrameResult>;
  dispose(): Promise<void>;
}
