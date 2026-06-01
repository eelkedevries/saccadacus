/// <reference lib="webworker" />
/**
 * Signal worker stub.
 *
 * Phase 3 wires the message path and verifies `pageTimestampMs`
 * pass-through. Ring-buffer writes, eye-local projection, velocity, reliability
 * aggregation, and event detection (PROPOSAL.md §22) all land in Phase 4 and
 * later phases. For now this worker simply acknowledges each frame result.
 */
import type { MainToSignalMessage, SignalToMainMessage } from './protocol';

export type PostToMainFromSignal = (message: SignalToMainMessage) => void;

export function createSignalWorkerHandler(
  postToMain: PostToMainFromSignal,
): (message: MainToSignalMessage) => void {
  return function handle(message: MainToSignalMessage): void {
    switch (message.kind) {
      case 'init':
        postToMain({ kind: 'ready', pageTimestampMs: message.pageTimestampMs });
        return;
      case 'frameResult':
        postToMain({ kind: 'frameAcked', pageTimestampMs: message.pageTimestampMs });
        return;
      case 'dispose':
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
