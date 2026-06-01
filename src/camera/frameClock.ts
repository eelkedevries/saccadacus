/**
 * Main-thread frame pacing.
 *
 * Pacing is driven by a scheduler (`requestAnimationFrame` by default). Every
 * tick stamps `pageTimestampMs` from `performance.now()` — the single
 * canonical clock (PROPOSAL.md §13, §24).
 *
 * `HTMLVideoElement.requestVideoFrameCallback` is used ONLY to read the
 * `mediaTime` and `presentationTime` of the most recently presented frame and
 * forward them as `videoMediaTimeMs`. It MUST NOT drive pacing, because
 * Firefox is known to rate-limit its callback rate (PROPOSAL.md §25; AGENTS.md
 * hard rules). When rVFC is unavailable, `videoMediaTimeMs` is simply omitted
 * and pacing is unaffected.
 */

export interface FrameTick {
  /** `performance.now()` at the moment of frame ingestion. */
  pageTimestampMs: number;
  /** `mediaTime` from rVFC if available, otherwise undefined. */
  videoMediaTimeMs?: number;
}

export interface FrameClockDeps {
  now: () => number;
  /** Returns a handle that can later be cancelled. */
  schedule: (callback: () => void) => number;
  cancel: (handle: number) => void;
  /** Inferred capability: whether the runtime supports rVFC. */
  rvfcAvailable: boolean;
  /**
   * Register an rVFC callback. Called once per call; the implementation must
   * itself re-register if continuous metadata updates are desired. Receives
   * `mediaTimeMs` (already converted from seconds). May be null when rVFC is
   * unavailable; in that case it must not be called.
   */
  registerRvfc: ((onMeta: (mediaTimeMs: number) => void) => void) | null;
}

/** Default deps wired to the real browser. */
export function browserFrameClockDeps(video: HTMLVideoElement | null): FrameClockDeps {
  const rvfcAvailable =
    video !== null &&
    typeof (video as { requestVideoFrameCallback?: unknown }).requestVideoFrameCallback ===
      'function';
  return {
    now: () => performance.now(),
    schedule: (cb) => requestAnimationFrame(cb),
    cancel: (handle) => cancelAnimationFrame(handle),
    rvfcAvailable,
    registerRvfc: rvfcAvailable
      ? (onMeta) => {
          const v = video as HTMLVideoElement & {
            requestVideoFrameCallback: (cb: (now: number, metadata: { mediaTime: number }) => void) => number;
          };
          v.requestVideoFrameCallback((_now, metadata) => {
            onMeta(metadata.mediaTime * 1000);
          });
        }
      : null,
  };
}

export class FrameClock {
  private running = false;
  private handle: number | null = null;
  private pendingMediaTimeMs: number | undefined;
  /** rVFC re-registration is requested on the next tick. */
  private rvfcPrimed = false;
  private readonly onTick: (tick: FrameTick) => void;

  constructor(
    private readonly deps: FrameClockDeps,
    onTick: (tick: FrameTick) => void,
  ) {
    this.onTick = onTick;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.primeRvfc();
    this.handle = this.deps.schedule(this.loop);
  }

  stop(): void {
    this.running = false;
    if (this.handle !== null) {
      this.deps.cancel(this.handle);
      this.handle = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Returns the pacing source name. rVFC is never reported here. */
  pacingSource(): 'scheduler' {
    return 'scheduler';
  }

  /** True iff rVFC metadata capture is enabled. */
  rvfcEnabled(): boolean {
    return this.deps.rvfcAvailable && this.deps.registerRvfc !== null;
  }

  private readonly loop = (): void => {
    if (!this.running) return;
    const pageTimestampMs = this.deps.now();
    const videoMediaTimeMs = this.pendingMediaTimeMs;
    this.pendingMediaTimeMs = undefined;
    this.onTick(
      videoMediaTimeMs !== undefined ? { pageTimestampMs, videoMediaTimeMs } : { pageTimestampMs },
    );
    this.primeRvfc();
    this.handle = this.deps.schedule(this.loop);
  };

  private primeRvfc(): void {
    if (this.rvfcPrimed) return;
    if (!this.rvfcEnabled() || this.deps.registerRvfc === null) return;
    this.rvfcPrimed = true;
    this.deps.registerRvfc((mediaTimeMs) => {
      this.pendingMediaTimeMs = mediaTimeMs;
      this.rvfcPrimed = false;
    });
  }
}
