/**
 * Real camera tracking (PROPOSAL.md §22, §25, §27 Phase 8).
 *
 * Drives the production MediaPipe backend with live camera frames on the main
 * thread, writing into the same ring-buffer pipeline and event tracker as the
 * synthetic session so all downstream panels (tasks, export, gaze mapping) work
 * unchanged. The adapter and CV library are dynamically imported so they are
 * code-split and only fetched once camera tracking starts (§26).
 *
 * This is browser-only orchestration (camera, canvas capture, model inference)
 * and is not exercised by unit tests; the pieces it composes are individually
 * tested. The explicit loading state from permission grant to backend-ready is
 * surfaced via the UI store (§25).
 */
import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { SignalPipeline, SignalChannel } from '../signals/signalPipeline';
import { LiveEventTracker } from '../events/liveEventTracker';
import { drawCameraOverlay } from '../visualisation/cameraOverlay';
import { TracesController } from '../visualisation/tracesCanvas';
import {
  createEventMarkerPlugin,
  blinksToBands,
  saccadesToBands,
} from '../visualisation/eventMarkers';
import type { EventBand } from '../visualisation/eventMarkers';
import { buildCameraConstraints, readActualSettings } from '../camera/cameraConstraints';
import { createAggregateThrottle, useUiStore } from '../state/uiStore';
import { clearSessionRegistry, sessionRegistry } from './sessionRegistry';

export function useRealTracking(
  videoRef: RefObject<HTMLVideoElement | null>,
  overlayRef: RefObject<HTMLCanvasElement | null>,
  tracesRef: RefObject<HTMLDivElement | null>,
): { message: string } {
  const [message, setMessage] = useState('Starting camera…');

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let backend: { processFrame: (f: HTMLCanvasElement, t: number) => Promise<unknown>; dispose: () => Promise<void> } | null =
      null;
    let traces: TracesController | null = null;
    let videoEl: HTMLVideoElement | null = null;
    let raf = 0;
    let busy = false;
    let bands: EventBand[] = [];
    const pipeline = new SignalPipeline();
    const tracker = new LiveEventTracker();
    const throttle = createAggregateThrottle((s) => useUiStore.getState().applyAggregate(s));
    const captureCanvas = document.createElement('canvas');
    const constraints = buildCameraConstraints({
      widthPx: 640,
      heightPx: 480,
      frameRateHz: 30,
      facingMode: 'user',
    });

    const fail = (msg: string): void => {
      if (cancelled) return;
      setMessage(msg);
      useUiStore.getState().setTrackingStatus('error');
    };

    // Mobile browsers may pause the video or stop the camera track when the
    // page is backgrounded; on return the feed can be black. Re-play, and if
    // the track was ended by the OS, re-acquire the stream.
    const resume = async (): Promise<void> => {
      if (cancelled || document.visibilityState !== 'visible') return;
      const video = videoRef.current;
      if (!video) return;
      const track = stream?.getVideoTracks()[0];
      try {
        if (!stream || !track || track.readyState === 'ended') {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          video.srcObject = stream;
        }
        if (video.paused) await video.play();
      } catch {
        // Leave the last message; the loop resumes if/when the feed recovers.
      }
    };
    const onVisibility = (): void => {
      void resume();
    };
    const onVideoPause = (): void => {
      void resume();
    };
    document.addEventListener('visibilitychange', onVisibility);

    const setup = async (): Promise<void> => {
      try {
        setMessage('Requesting camera permission.');
        useUiStore.getState().setTrackingStatus('preparing');
        stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) return;
        const video = videoRef.current;
        if (video) {
          videoEl = video;
          video.srcObject = stream;
          video.addEventListener('pause', onVideoPause);
          await video.play();
        }
        const track = stream.getVideoTracks()[0];
        const settings = track ? readActualSettings(track) : null;
        if (settings) {
          sessionRegistry.camera = {
            ...(settings.widthPx !== null ? { widthPx: settings.widthPx } : {}),
            ...(settings.heightPx !== null ? { heightPx: settings.heightPx } : {}),
            ...(settings.frameRateHz !== null ? { frameRateHz: settings.frameRateHz } : {}),
          };
        }

        setMessage('Initialising tracking. This may take a few seconds.');
        const { createMediaPipeBackend } = await import(
          '../tracking/backendAdapters/mediaPipeFaceLandmarker'
        );
        const created = await createMediaPipeBackend({
          frameWidth: settings?.widthPx ?? 640,
          frameHeight: settings?.heightPx ?? 480,
        });
        if (cancelled) {
          await created.backend.dispose();
          return;
        }
        backend = created.backend;
        useUiStore.getState().setActiveDelegate(created.delegate);

        sessionRegistry.pipeline = pipeline;
        sessionRegistry.tracker = tracker;
        useUiStore.getState().setTrackingStatus('tracking');
        setMessage(`Tracking active (${created.delegate} delegate).`);

        if (tracesRef.current) {
          traces = new TracesController({
            container: tracesRef.current,
            buffer: pipeline.signalBuffer,
            title: 'Eye-local position (binocular)',
            widthPx: tracesRef.current.clientWidth || 480,
            heightPx: 160,
            series: [
              { channel: SignalChannel.BinocularX, label: 'x', stroke: '#1e88e5' },
              { channel: SignalChannel.BinocularY, label: 'y', stroke: '#43a047' },
            ],
            plugins: [createEventMarkerPlugin(() => bands)],
          });
        }
        loop();
      } catch (err) {
        fail(`Camera or model error: ${err instanceof Error ? err.message : String(err)}`);
      }
    };

    const loop = (): void => {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && backend && !busy && video.videoWidth > 0) {
        captureCanvas.width = video.videoWidth;
        captureCanvas.height = video.videoHeight;
        const ctx = captureCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
          busy = true;
          const tsMs = performance.now();
          void backend
            .processFrame(captureCanvas, tsMs)
            .then((result) => {
              busy = false;
              if (cancelled) return;
              const frameResult = result as Parameters<typeof pipeline.ingest>[0];
              sessionRegistry.latestResult = frameResult;
              const summary = pipeline.ingest(frameResult);
              const events = tracker.ingest(frameResult);
              bands = [...saccadesToBands(events.saccades), ...blinksToBands(events.blinks)];
              traces?.update();
              const overlay = overlayRef.current;
              if (overlay) {
                // Size the overlay canvas to match the source frame so
                // normalised landmark coordinates map to visually-aligned
                // positions when both video and canvas are CSS-scaled together.
                if (overlay.width !== captureCanvas.width || overlay.height !== captureCanvas.height) {
                  overlay.width = captureCanvas.width;
                  overlay.height = captureCanvas.height;
                }
                const octx = overlay.getContext('2d');
                if (octx) {
                  drawCameraOverlay(octx, frameResult, {
                    widthPx: overlay.width,
                    heightPx: overlay.height,
                  });
                }
              }
              if (summary) {
                throttle({
                  leftReliability: summary.leftReliability,
                  rightReliability: summary.rightReliability,
                  faceReliability: summary.faceReliability,
                  activeSelection: 'iris',
                  saccadeCount: events.saccadeCount,
                  blinkCount: events.blinkCount,
                });
              }
            })
            .catch(() => {
              busy = false;
            });
        }
      }
      raf = requestAnimationFrame(loop);
    };

    void setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', onVisibility);
      videoEl?.removeEventListener('pause', onVideoPause);
      traces?.destroy();
      if (stream) {
        for (const t of stream.getTracks()) t.stop();
      }
      void backend?.dispose();
      clearSessionRegistry();
      useUiStore.getState().setTrackingStatus('idle');
      useUiStore.getState().setActiveDelegate(null);
    };
  }, [videoRef, overlayRef, tracesRef]);

  return { message };
}
