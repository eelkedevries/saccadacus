/**
 * Main-thread mock live session (PROPOSAL.md §20, §22).
 *
 * Drives `MockTrackingBackend` through the `SignalPipeline` so the live
 * interface has data before the camera/worker backend is enabled. This runs on
 * the main thread for the synthetic demo; the real backend runs in the tracking
 * worker (Phase 8). Continuous signals are written to the pipeline's ring
 * buffers, never to a reactive store.
 */
import { MockTrackingBackend } from '../tracking/MockTrackingBackend';
import type { TrackingBackendConfig, TrackingFrameResult } from '../tracking/TrackingBackend';
import { SignalPipeline } from '../signals/signalPipeline';
import type { SignalPipelineSummary } from '../signals/signalPipeline';

export interface LiveStep {
  result: TrackingFrameResult;
  summary: SignalPipelineSummary | undefined;
}

export class MockLiveSession {
  readonly pipeline: SignalPipeline;
  private readonly backend: MockTrackingBackend;
  private readonly frame: HTMLCanvasElement | null;
  private started = false;

  constructor(pipeline = new SignalPipeline()) {
    this.pipeline = pipeline;
    this.backend = new MockTrackingBackend();
    // A throwaway canvas satisfies the VideoFrameLike contract; the mock
    // ignores frame pixels entirely.
    this.frame =
      typeof document !== 'undefined' ? document.createElement('canvas') : null;
  }

  async start(config: TrackingBackendConfig): Promise<void> {
    await this.backend.initialise(config);
    this.pipeline.reset();
    this.started = true;
  }

  isStarted(): boolean {
    return this.started;
  }

  /** Process one frame at the given page timestamp and ingest the result. */
  async step(pageTimestampMs: number): Promise<LiveStep> {
    if (!this.started) {
      throw new Error('MockLiveSession.step called before start');
    }
    const frame = this.frame ?? document.createElement('canvas');
    const result = await this.backend.processFrame(frame, pageTimestampMs);
    const summary = this.pipeline.ingest(result);
    return { result, summary };
  }

  async dispose(): Promise<void> {
    await this.backend.dispose();
    this.started = false;
  }
}
