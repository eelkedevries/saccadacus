/// <reference lib="webworker" />
/**
 * Tracking worker.
 *
 * Hosts a single `TrackingBackend` instance. `MockTrackingBackend` is the
 * default and remains so through Phase 7 (AGENTS.md hard rules; PROPOSAL.md
 * §20). Frames arrive as `ImageBitmap`, `VideoFrame`, or `HTMLCanvasElement`
 * already transferred from the main thread; only landmark-derived numeric
 * results travel back — frame pixels do NOT cross the boundary again
 * (PROPOSAL.md §22). `pageTimestampMs` is preserved by the backend
 * (`MockTrackingBackend` and any future adapter must echo it back unchanged,
 * PROPOSAL.md §24).
 */
import type { TrackingBackend } from '../tracking/TrackingBackend';
import { MockTrackingBackend } from '../tracking/MockTrackingBackend';
import type { MainToTrackingMessage, TrackingToMainMessage } from './protocol';

export type PostToMain = (message: TrackingToMainMessage) => void;

/**
 * Pure message handler — easy to test without a real Worker context.
 *
 * @param backendFactory injection point for tests; defaults to `MockTrackingBackend`.
 */
export function createTrackingWorkerHandler(
  postToMain: PostToMain,
  backendFactory: () => TrackingBackend = () => new MockTrackingBackend(),
): (message: MainToTrackingMessage) => Promise<void> {
  let backend: TrackingBackend | null = null;

  return async function handle(message: MainToTrackingMessage): Promise<void> {
    try {
      switch (message.kind) {
        case 'init': {
          backend = backendFactory();
          await backend.initialise(message.config);
          postToMain({ kind: 'ready', pageTimestampMs: message.pageTimestampMs });
          return;
        }
        case 'frame': {
          if (!backend) {
            postToMain({
              kind: 'error',
              message: 'Tracking backend not initialised.',
              pageTimestampMs: message.pageTimestampMs,
            });
            return;
          }
          const result = await backend.processFrame(message.frame, message.pageTimestampMs);
          // Forward mediaTime metadata captured on the page side, if any.
          if (message.videoMediaTimeMs !== undefined && result.videoMediaTimeMs === undefined) {
            result.videoMediaTimeMs = message.videoMediaTimeMs;
          }
          postToMain({
            kind: 'frameResult',
            result,
            pageTimestampMs: message.pageTimestampMs,
          });
          return;
        }
        case 'dispose': {
          if (backend) {
            await backend.dispose();
            backend = null;
          }
          postToMain({ kind: 'disposed', pageTimestampMs: message.pageTimestampMs });
          return;
        }
      }
    } catch (err) {
      postToMain({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
        pageTimestampMs: message.pageTimestampMs,
      });
    }
  };
}

// Worker entry point. Guarded so that importing this file in a test
// environment (where `self` is not a DedicatedWorkerGlobalScope) does not
// register handlers.
declare const self: DedicatedWorkerGlobalScope | undefined;

if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  const scope: DedicatedWorkerGlobalScope = self;
  const handle = createTrackingWorkerHandler((msg) => scope.postMessage(msg));
  scope.addEventListener('message', (event: MessageEvent<MainToTrackingMessage>) => {
    void handle(event.data);
  });
}
