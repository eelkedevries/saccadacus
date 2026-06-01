/**
 * Throwaway MediaPipe Face Landmarker adapter (PROPOSAL.md §20, §27 Phase 7).
 *
 * This is the ONLY directory permitted to import a computer-vision/face-landmark
 * library, and the only place `any` is allowed. It is a spike: it must not be
 * wired into the default boot path (MockTrackingBackend remains default through
 * Phase 7). The real library is loaded with a dynamic import so it is
 * code-split and only fetched when the spike runs (§26).
 *
 * Landmark-to-eye-local mapping reuses the pure `projectEyeLocal` and head-pose
 * decomposition so the rest of the pipeline is unchanged. Sign conventions for
 * the eye-local axes are approximate here and are validated via the quality
 * check when the production backend lands in Phase 8.
 */
import type {
  TrackingBackend,
  TrackingBackendConfig,
  TrackingFrameResult,
  VideoFrameLike,
  BlinkState,
} from '../TrackingBackend';
import { projectEyeLocal } from '../../signals/eyeLocalCoordinates';
import type { Point2D } from '../../signals/eyeLocalCoordinates';
import { decomposeHeadPose } from '../../signals/headPose';

export type Delegate = 'CPU' | 'GPU';

export interface MediaPipeAdapterOptions {
  delegate?: Delegate;
  /** Base URL of the tasks-vision wasm fileset. */
  wasmBaseUrl?: string;
  /** URL of the face_landmarker .task model asset. */
  modelAssetPath?: string;
}

const DEFAULT_WASM_BASE =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const DEFAULT_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

// Canonical MediaPipe face-mesh indices used for the eye-local frame.
const IDX = {
  rightEyeOuter: 33,
  rightEyeInner: 133,
  rightIris: 468,
  leftEyeInner: 362,
  leftEyeOuter: 263,
  leftIris: 473,
} as const;

/** Convert a normalised image landmark to a y-up participant-frame point. */
function toParticipant(landmark: { x: number; y: number }): Point2D {
  // Selfie view is mirrored; flip x so positive points to the participant's
  // right, and flip y so positive points up.
  return { x: -landmark.x, y: -landmark.y };
}

export class MediaPipeFaceLandmarkerBackend implements TrackingBackend {
  private landmarker: any = null;
  private readonly options: Required<MediaPipeAdapterOptions>;
  private initLatencyMs = 0;

  constructor(options: MediaPipeAdapterOptions = {}) {
    this.options = {
      delegate: options.delegate ?? 'CPU',
      wasmBaseUrl: options.wasmBaseUrl ?? DEFAULT_WASM_BASE,
      modelAssetPath: options.modelAssetPath ?? DEFAULT_MODEL,
    };
  }

  /** Wall-clock duration of model initialisation, a §27 benchmark metric. */
  getInitLatencyMs(): number {
    return this.initLatencyMs;
  }

  async initialise(_config: TrackingBackendConfig): Promise<void> {
    const start = performance.now();
    const vision: any = await import('@mediapipe/tasks-vision');
    const fileset = await vision.FilesetResolver.forVisionTasks(this.options.wasmBaseUrl);
    this.landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath: this.options.modelAssetPath,
        delegate: this.options.delegate,
      },
      runningMode: 'VIDEO',
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
    this.initLatencyMs = performance.now() - start;
  }

  processFrame(frame: VideoFrameLike, pageTimestampMs: number): Promise<TrackingFrameResult> {
    if (!this.landmarker) {
      throw new Error('MediaPipeFaceLandmarkerBackend.processFrame called before initialise');
    }
    const start = performance.now();
    // detectForVideo needs a monotonically increasing timestamp; performance.now
    // satisfies that. The page timestamp is echoed back unchanged regardless.
    const detection: any = this.landmarker.detectForVideo(frame as any, pageTimestampMs);
    const backendLatencyMs = performance.now() - start;

    const landmarks: Array<{ x: number; y: number; z: number }> | undefined =
      detection.faceLandmarks?.[0];

    if (!landmarks || landmarks.length === 0) {
      return Promise.resolve({ pageTimestampMs, backendLatencyMs, faceReliability: 0 });
    }

    const blink = blinkStateFromBlendshapes(detection.faceBlendshapes?.[0]);

    const leftEye = eyeFeature(
      landmarks,
      IDX.leftEyeInner,
      IDX.leftEyeOuter,
      IDX.leftIris,
      blink.left,
    );
    const rightEye = eyeFeature(
      landmarks,
      IDX.rightEyeOuter,
      IDX.rightEyeInner,
      IDX.rightIris,
      blink.right,
    );

    const matrix: number[] | undefined = detection.facialTransformationMatrixes?.[0]?.data;
    const headPose = matrix
      ? decomposeHeadPose({ matrix, reliability: 0.9 })
      : undefined;

    const overlayLandmarks = {
      leftEye: overlayEye(landmarks, IDX.leftEyeInner, IDX.leftEyeOuter, IDX.leftIris),
      rightEye: overlayEye(landmarks, IDX.rightEyeOuter, IDX.rightEyeInner, IDX.rightIris),
    };

    return Promise.resolve({
      pageTimestampMs,
      backendLatencyMs,
      leftEye,
      rightEye,
      ...(headPose ? { headPose } : {}),
      faceReliability: 0.9,
      overlayLandmarks,
    });
  }

  dispose(): Promise<void> {
    if (this.landmarker) {
      this.landmarker.close?.();
      this.landmarker = null;
    }
    return Promise.resolve();
  }
}

export interface CreatedBackend {
  backend: MediaPipeFaceLandmarkerBackend;
  delegate: Delegate;
}

/**
 * Create and initialise the production backend with GPU-preferred, CPU-fallback
 * delegate selection (Decision 0001). Attempts the GPU (WebGL2) delegate first;
 * on initialisation failure it retries with the CPU (WASM) delegate. The active
 * delegate is returned so the UI can surface it (§25).
 */
export async function createMediaPipeBackend(
  config: TrackingBackendConfig,
  options: Omit<MediaPipeAdapterOptions, 'delegate'> & { preferred?: Delegate } = {},
): Promise<CreatedBackend> {
  const order: Delegate[] = options.preferred === 'CPU' ? ['CPU', 'GPU'] : ['GPU', 'CPU'];
  let lastError: unknown;
  for (const delegate of order) {
    const backend = new MediaPipeFaceLandmarkerBackend({ ...options, delegate });
    try {
      await backend.initialise(config);
      return { backend, delegate };
    } catch (err) {
      lastError = err;
      await backend.dispose();
    }
  }
  throw new Error(
    `MediaPipe backend failed to initialise on any delegate: ${
      lastError instanceof Error ? lastError.message : String(lastError)
    }`,
  );
}

function overlayEye(
  landmarks: Array<{ x: number; y: number }>,
  cornerAIdx: number,
  cornerBIdx: number,
  irisIdx: number,
): { cornerA: { x: number; y: number }; cornerB: { x: number; y: number }; iris: { x: number; y: number } } | undefined {
  const a = landmarks[cornerAIdx];
  const b = landmarks[cornerBIdx];
  const iris = landmarks[irisIdx];
  if (!a || !b || !iris) return undefined;
  return {
    cornerA: { x: a.x, y: a.y },
    cornerB: { x: b.x, y: b.y },
    iris: { x: iris.x, y: iris.y },
  };
}

function eyeFeature(
  landmarks: Array<{ x: number; y: number }>,
  cornerAIdx: number,
  cornerBIdx: number,
  irisIdx: number,
  blinkState: BlinkState,
): TrackingFrameResult['leftEye'] {
  const a = landmarks[cornerAIdx];
  const b = landmarks[cornerBIdx];
  const iris = landmarks[irisIdx];
  if (!a || !b || !iris) {
    return undefined;
  }
  // Order corners so leftCorner is toward the participant's left (smaller x in
  // the flipped frame), rightCorner toward the participant's right.
  const pa = toParticipant(a);
  const pb = toParticipant(b);
  const leftCorner = pa.x <= pb.x ? pa : pb;
  const rightCorner = pa.x <= pb.x ? pb : pa;
  const projected = projectEyeLocal({ leftCorner, rightCorner }, toParticipant(iris));
  const reliability = blinkState === 'closed' ? 0.2 : 0.85;
  return {
    irisCentre: { xLocal: projected.xLocal, yLocal: projected.yLocal, reliability },
    selected: 'iris',
    selectedReliability: reliability,
    blinkState,
  };
}

function blinkStateFromBlendshapes(blendshapes: any): { left: BlinkState; right: BlinkState } {
  const categories: Array<{ categoryName: string; score: number }> =
    blendshapes?.categories ?? [];
  const score = (name: string): number =>
    categories.find((c) => c.categoryName === name)?.score ?? 0;
  return {
    left: blinkStateFromScore(score('eyeBlinkLeft')),
    right: blinkStateFromScore(score('eyeBlinkRight')),
  };
}

function blinkStateFromScore(score: number): BlinkState {
  if (score >= 0.5) return 'closed';
  if (score >= 0.2) return 'closing';
  return 'open';
}
