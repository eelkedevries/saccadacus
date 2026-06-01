import { describe, expect, it } from 'vitest';
import { createTrackingWorkerHandler } from '../../src/workers/trackingWorker';
import { createSignalWorkerHandler } from '../../src/workers/signalWorker';
import { hasPageTimestamp } from '../../src/workers/protocol';
import type {
  MainToSignalMessage,
  MainToTrackingMessage,
  SignalToMainMessage,
  TrackingToMainMessage,
} from '../../src/workers/protocol';
import type { VideoFrameLike } from '../../src/tracking/TrackingBackend';

const fakeFrame: VideoFrameLike = document.createElement('canvas');

describe('worker message protocol', () => {
  it('hasPageTimestamp accepts messages with a numeric pageTimestampMs', () => {
    expect(hasPageTimestamp({ kind: 'ready', pageTimestampMs: 1 })).toBe(true);
    expect(hasPageTimestamp({ kind: 'ready', pageTimestampMs: 'oops' })).toBe(false);
    expect(hasPageTimestamp(null)).toBe(false);
    expect(hasPageTimestamp({})).toBe(false);
  });

  describe('tracking worker handler', () => {
    it('preserves pageTimestampMs through init → ready', async () => {
      const posted: TrackingToMainMessage[] = [];
      const handle = createTrackingWorkerHandler((m) => posted.push(m));
      const init: MainToTrackingMessage = {
        kind: 'init',
        config: { frameWidth: 640, frameHeight: 480, seed: 1 },
        pageTimestampMs: 1234.5,
      };
      await handle(init);
      expect(posted).toEqual([{ kind: 'ready', pageTimestampMs: 1234.5 }]);
    });

    it('echoes pageTimestampMs in frame results and in the embedded result', async () => {
      const posted: TrackingToMainMessage[] = [];
      const handle = createTrackingWorkerHandler((m) => posted.push(m));
      await handle({
        kind: 'init',
        config: { frameWidth: 640, frameHeight: 480, seed: 1 },
        pageTimestampMs: 0,
      });
      await handle({ kind: 'frame', frame: fakeFrame, pageTimestampMs: 555.5 });
      const last = posted[posted.length - 1];
      expect(last?.kind).toBe('frameResult');
      if (last?.kind === 'frameResult') {
        expect(last.pageTimestampMs).toBe(555.5);
        expect(last.result.pageTimestampMs).toBe(555.5);
      }
    });

    it('reports an error if a frame is sent before init', async () => {
      const posted: TrackingToMainMessage[] = [];
      const handle = createTrackingWorkerHandler((m) => posted.push(m));
      await handle({ kind: 'frame', frame: fakeFrame, pageTimestampMs: 9 });
      expect(posted[0]?.kind).toBe('error');
      expect(posted[0]?.pageTimestampMs).toBe(9);
    });

    it('forwards page-side videoMediaTimeMs when the backend did not set one', async () => {
      const posted: TrackingToMainMessage[] = [];
      const handle = createTrackingWorkerHandler((m) => posted.push(m), () => ({
        initialise: () => Promise.resolve(),
        processFrame: (_frame, ts) =>
          Promise.resolve({ pageTimestampMs: ts, faceReliability: 1 }),
        dispose: () => Promise.resolve(),
      }));
      await handle({
        kind: 'init',
        config: { frameWidth: 64, frameHeight: 48 },
        pageTimestampMs: 0,
      });
      await handle({
        kind: 'frame',
        frame: fakeFrame,
        pageTimestampMs: 100,
        videoMediaTimeMs: 7,
      });
      const last = posted[posted.length - 1];
      expect(last?.kind).toBe('frameResult');
      if (last?.kind === 'frameResult') {
        expect(last.result.videoMediaTimeMs).toBe(7);
      }
    });

    it('disposes the backend and confirms with disposed', async () => {
      const posted: TrackingToMainMessage[] = [];
      const handle = createTrackingWorkerHandler((m) => posted.push(m));
      await handle({
        kind: 'init',
        config: { frameWidth: 64, frameHeight: 48 },
        pageTimestampMs: 0,
      });
      await handle({ kind: 'dispose', pageTimestampMs: 42 });
      const last = posted[posted.length - 1];
      expect(last?.kind).toBe('disposed');
      expect(last?.pageTimestampMs).toBe(42);
    });
  });

  describe('signal worker handler', () => {
    it('replies to init and frameResult while preserving pageTimestampMs', () => {
      const posted: SignalToMainMessage[] = [];
      const handle = createSignalWorkerHandler((m) => posted.push(m));
      const init: MainToSignalMessage = { kind: 'init', pageTimestampMs: 1 };
      const frame: MainToSignalMessage = {
        kind: 'frameResult',
        pageTimestampMs: 2,
        result: { pageTimestampMs: 2, faceReliability: 0.9 },
      };
      handle(init);
      handle(frame);
      expect(posted).toEqual([
        { kind: 'ready', pageTimestampMs: 1 },
        { kind: 'frameAcked', pageTimestampMs: 2 },
      ]);
    });
  });

  it('round-trips pageTimestampMs across the full main → tracking → signal chain', async () => {
    const trackingOut: TrackingToMainMessage[] = [];
    const signalOut: SignalToMainMessage[] = [];
    const tracking = createTrackingWorkerHandler((m) => trackingOut.push(m));
    const signal = createSignalWorkerHandler((m) => signalOut.push(m));

    await tracking({
      kind: 'init',
      config: { frameWidth: 64, frameHeight: 48 },
      pageTimestampMs: 100,
    });
    signal({ kind: 'init', pageTimestampMs: 100 });
    await tracking({ kind: 'frame', frame: fakeFrame, pageTimestampMs: 200.5 });

    const fr = trackingOut.find((m) => m.kind === 'frameResult');
    expect(fr?.pageTimestampMs).toBe(200.5);
    if (fr?.kind === 'frameResult') {
      signal({ kind: 'frameResult', pageTimestampMs: fr.pageTimestampMs, result: fr.result });
    }
    expect(signalOut[signalOut.length - 1]?.pageTimestampMs).toBe(200.5);
  });
});
