/**
 * React effect that runs the mock live session and renders the overlay and
 * traces (PROPOSAL.md §23). Rendering stays on the main thread.
 *
 * In environments without a 2D canvas context (e.g. jsdom under unit tests)
 * the loop is skipped, so component tests stay light and deterministic.
 */
import { useEffect } from 'react';
import type { RefObject } from 'react';
import { MockLiveSession } from './mockLiveSession';
import { drawCameraOverlay } from '../visualisation/cameraOverlay';
import { TracesController } from '../visualisation/tracesCanvas';
import { SignalChannel } from '../signals/signalPipeline';
import { createAggregateThrottle, useUiStore } from '../state/uiStore';

export function canvasContextAvailable(): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const probe = document.createElement('canvas');
    return probe.getContext('2d') !== null;
  } catch {
    return false;
  }
}

export function useLiveSession(
  overlayRef: RefObject<HTMLCanvasElement | null>,
  tracesRef: RefObject<HTMLDivElement | null>,
): void {
  useEffect(() => {
    if (!canvasContextAvailable()) return;

    const session = new MockLiveSession();
    const store = useUiStore.getState();
    const throttle = createAggregateThrottle((s) => useUiStore.getState().applyAggregate(s));
    let rafHandle = 0;
    let traces: TracesController | null = null;
    let cancelled = false;

    store.setTrackingStatus('tracking');

    const run = (): void => {
      if (tracesRef.current) {
        traces = new TracesController({
          container: tracesRef.current,
          buffer: session.pipeline.signalBuffer,
          title: 'Eye-local position (binocular)',
          widthPx: tracesRef.current.clientWidth || 480,
          heightPx: 160,
          series: [
            { channel: SignalChannel.BinocularX, label: 'x', stroke: '#1e88e5' },
            { channel: SignalChannel.BinocularY, label: 'y', stroke: '#43a047' },
          ],
        });
      }

      const loop = (): void => {
        if (cancelled) return;
        const tsMs = performance.now();
        void session.step(tsMs).then(({ result, summary }) => {
          if (cancelled) return;
          const ctx = overlayRef.current?.getContext('2d');
          if (ctx && overlayRef.current) {
            drawCameraOverlay(ctx, result, {
              widthPx: overlayRef.current.width,
              heightPx: overlayRef.current.height,
            });
          }
          traces?.update();
          if (summary) {
            throttle({
              leftReliability: summary.leftReliability,
              rightReliability: summary.rightReliability,
              faceReliability: summary.faceReliability,
              activeSelection: 'iris',
              saccadeCount: 0,
              blinkCount: 0,
            });
          }
        });
        rafHandle = requestAnimationFrame(loop);
      };
      loop();
    };

    void session.start({ frameWidth: 640, frameHeight: 480, seed: 1 }).then(run);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafHandle);
      traces?.destroy();
      useUiStore.getState().setTrackingStatus('idle');
      void session.dispose();
    };
  }, [overlayRef, tracesRef]);
}
