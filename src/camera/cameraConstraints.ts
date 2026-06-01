/**
 * Camera constraint construction and settings readback (PROPOSAL.md §25).
 *
 * The app requests a target resolution and frame rate, then reads
 * `MediaStreamTrack.getSettings()` and exposes the actual values. Later phases
 * record the actual values, not the requested ones, because advanced camera
 * constraints are unreliable on mobile Firefox.
 */

export interface CameraTarget {
  widthPx: number;
  heightPx: number;
  frameRateHz: number;
  /** `'user'` for front-facing on phones, `'environment'` for rear. */
  facingMode?: 'user' | 'environment';
}

export interface CameraActualSettings {
  widthPx: number | null;
  heightPx: number | null;
  frameRateHz: number | null;
  deviceId: string | null;
  facingMode: string | null;
}

/** Build a `getUserMedia` constraints object from a target spec. */
export function buildCameraConstraints(target: CameraTarget): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      width: { ideal: target.widthPx },
      height: { ideal: target.heightPx },
      frameRate: { ideal: target.frameRateHz },
      ...(target.facingMode ? { facingMode: { ideal: target.facingMode } } : {}),
    },
  };
}

/** Read the actual settings of a video track after the stream has started. */
export function readActualSettings(track: MediaStreamTrack): CameraActualSettings {
  const s = track.getSettings();
  return {
    widthPx: typeof s.width === 'number' ? s.width : null,
    heightPx: typeof s.height === 'number' ? s.height : null,
    frameRateHz: typeof s.frameRate === 'number' ? s.frameRate : null,
    deviceId: typeof s.deviceId === 'string' ? s.deviceId : null,
    facingMode: typeof s.facingMode === 'string' ? s.facingMode : null,
  };
}
