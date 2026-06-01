/**
 * Camera controller: permission request, stream lifecycle, and the loading
 * state from permission grant until the tracking backend reports ready.
 *
 * Model initialisation may be substantially slower on Firefox than on
 * Chromium (PROPOSAL.md §25), so a distinct `preparingBackend` state must be
 * visible to the user from the moment camera permission is granted until the
 * backend reports ready. User-facing strings are in British spelling and
 * carry no marketing copy (PROPOSAL.md §28).
 */
import type { CameraActualSettings, CameraTarget } from './cameraConstraints';
import { buildCameraConstraints, readActualSettings } from './cameraConstraints';

export type CameraStatus =
  | 'idle'
  | 'requestingPermission'
  | 'preparingBackend'
  | 'ready'
  | 'error'
  | 'disposed';

export interface CameraState {
  status: CameraStatus;
  /** User-facing status message; British spelling, plain text. */
  message: string;
  actualSettings: CameraActualSettings | null;
  errorMessage: string | null;
}

export interface CameraControllerDeps {
  getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;
  /** Backend-ready signal, e.g. resolved by the worker `ready` message. */
  awaitBackendReady: () => Promise<void>;
}

const INITIAL_STATE: CameraState = {
  status: 'idle',
  message: 'Camera not started.',
  actualSettings: null,
  errorMessage: null,
};

/** User-facing strings, all British spelling, no marketing copy. */
const messageFor: Record<CameraStatus, string> = {
  idle: 'Camera not started.',
  requestingPermission: 'Requesting camera permission.',
  preparingBackend: 'Initialising tracking. This may take a few seconds.',
  ready: 'Tracking active.',
  error: 'Camera error.',
  disposed: 'Camera stopped.',
};

export class CameraController {
  private state: CameraState = INITIAL_STATE;
  private stream: MediaStream | null = null;
  private readonly listeners = new Set<(state: CameraState) => void>();

  constructor(private readonly deps: CameraControllerDeps) {}

  getState(): CameraState {
    return this.state;
  }

  subscribe(listener: (state: CameraState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  async start(target: CameraTarget): Promise<void> {
    if (this.state.status === 'ready' || this.state.status === 'preparingBackend') {
      return;
    }
    this.setStatus('requestingPermission');
    let stream: MediaStream;
    try {
      stream = await this.deps.getUserMedia(buildCameraConstraints(target));
    } catch (err) {
      this.setError(`Permission denied or no camera available: ${describeError(err)}`);
      return;
    }
    this.stream = stream;

    const videoTrack = stream.getVideoTracks()[0];
    const actualSettings = videoTrack ? readActualSettings(videoTrack) : null;

    this.setStatus('preparingBackend', { actualSettings });

    try {
      await this.deps.awaitBackendReady();
    } catch (err) {
      this.setError(`Tracking backend failed to initialise: ${describeError(err)}`);
      return;
    }

    this.setStatus('ready', { actualSettings });
  }

  stop(): void {
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    this.setStatus('disposed');
  }

  getStream(): MediaStream | null {
    return this.stream;
  }

  private setStatus(
    status: CameraStatus,
    overrides: Partial<Omit<CameraState, 'status' | 'message'>> = {},
  ): void {
    this.state = {
      status,
      message: messageFor[status],
      actualSettings: overrides.actualSettings ?? this.state.actualSettings,
      errorMessage: overrides.errorMessage ?? null,
    };
    this.notify();
  }

  private setError(errorMessage: string): void {
    this.state = {
      status: 'error',
      message: messageFor.error,
      actualSettings: this.state.actualSettings,
      errorMessage,
    };
    this.notify();
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }
}

function describeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return 'unknown';
}
