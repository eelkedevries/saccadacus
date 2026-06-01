/// <reference lib="webworker" />
/**
 * Signal worker.
 *
 * Receives `TrackingFrameResult`s and runs the signal pipeline: it writes the
 * eye-local position, velocity, reliability, and head-pose signals into ring
 * buffers (PROPOSAL.md §22). Event detection (saccades, blinks, head-motion
 * labels) is added in Phase 5. Continuous signals live in the ring buffers
 * owned by the pipeline and are never placed in a reactive store.
 *
 * `pageTimestampMs` is preserved on every reply, keeping the single canonical
 * clock intact (PROPOSAL.md §24).
 */
import type { MainToSignalMessage, SignalToMainMessage } from './protocol';
import { SignalPipeline } from '../signals/signalPipeline';

export type PostToMainFromSignal = (message: SignalToMainMessage) => void;

export function createSignalWorkerHandler(
  postToMain: PostToMainFromSignal,
  pipeline: SignalPipeline = new SignalPipeline(),
): (message: MainToSignalMessage) => void {
  return function handle(message: MainToSignalMessage): void {
    switch (message.kind) {
      case 'init':
        pipeline.reset();
        postToMain({ kind: 'ready', pageTimestampMs: message.pageTimestampMs });
        return;
      case 'frameResult':
        pipeline.ingest(message.result);
        postToMain({ kind: 'frameAcked', pageTimestampMs: message.pageTimestampMs });
        return;
      case 'dispose':
        pipeline.reset();
        postToMain({ kind: 'disposed', pageTimestampMs: message.pageTimestampMs });
        return;
    }
  };
}

declare const self: DedicatedWorkerGlobalScope | undefined;

if (typeof self !== 'undefined' && typeof self.postMessage === 'function') {
  const scope: DedicatedWorkerGlobalScope = self;
  const handle = createSignalWorkerHandler((msg) => scope.postMessage(msg));
  scope.addEventListener('message', (event: MessageEvent<MainToSignalMessage>) => {
    handle(event.data);
  });
}
