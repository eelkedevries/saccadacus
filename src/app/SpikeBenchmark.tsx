/**
 * Dev-only spike benchmark page (PROPOSAL.md §27 Phase 7).
 *
 * Rendered ONLY when the page is opened with `?spike=mediapipe`; the default
 * boot path always renders the app with MockTrackingBackend. This page benches
 * the throwaway MediaPipe adapter on the current device under a chosen
 * delegate, so the target browsers (including Firefox on Android) can be
 * measured from a phone. It does not change the default backend.
 */
import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  buildCameraConstraints,
  readActualSettings,
} from '../camera/cameraConstraints';
import type { CameraActualSettings } from '../camera/cameraConstraints';
import { benchmarkFaceLandmarker } from '../tracking/backendAdapters/benchmark';
import type { BenchmarkResult, BenchmarkOptions } from '../tracking/backendAdapters/benchmark';
import type { Delegate } from '../tracking/backendAdapters/mediaPipeFaceLandmarker';

const FRAMES = 150;

export function SpikeBenchmark(): ReactElement {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [delegate, setDelegate] = useState<Delegate>('CPU');
  const [status, setStatus] = useState('Idle. Grant camera permission, then run.');
  const [settings, setSettings] = useState<CameraActualSettings | null>(null);
  const [results, setResults] = useState<BenchmarkResult[]>([]);

  const grant = async (): Promise<void> => {
    try {
      setStatus('Requesting camera permission.');
      const stream = await navigator.mediaDevices.getUserMedia(
        buildCameraConstraints({ widthPx: 640, heightPx: 480, frameRateHz: 30, facingMode: 'user' }),
      );
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }
      const track = stream.getVideoTracks()[0];
      setSettings(track ? readActualSettings(track) : null);
      setStatus('Camera ready. Run a benchmark.');
    } catch (err) {
      setStatus(`Camera error: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const run = async (): Promise<void> => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setStatus('No 2D context available.');
      return;
    }
    setStatus(`Running ${delegate} benchmark (${FRAMES} frames). Loading model on first run…`);
    const options: BenchmarkOptions = {
      delegate,
      frames: FRAMES,
      getFrame: () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas;
      },
    };
    try {
      const result = await benchmarkFaceLandmarker(options);
      setResults((prev) => [...prev, result]);
      setStatus('Benchmark complete.');
    } catch (err) {
      setStatus(`Benchmark failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <main className="min-h-screen bg-neutral-900 p-4 text-neutral-100">
      <h1 className="text-xl font-medium">saccadacus — backend spike benchmark</h1>
      <p className="mt-1 text-sm text-neutral-400">
        Dev-only. Measures the MediaPipe Face Landmarker adapter on this device.
        The default application is unaffected.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" className="border border-blue-500 px-3 py-1 text-sm" onClick={() => void grant()}>
          Grant camera
        </button>
        <fieldset className="flex gap-2" aria-label="Delegate">
          {(['CPU', 'GPU'] as const).map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={delegate === d}
              className={delegate === d ? 'border border-blue-500 px-3 py-1 text-sm' : 'border border-neutral-600 px-3 py-1 text-sm'}
              onClick={() => setDelegate(d)}
            >
              {d}
            </button>
          ))}
        </fieldset>
        <button type="button" className="border border-neutral-600 px-3 py-1 text-sm" onClick={() => void run()}>
          Run benchmark
        </button>
      </div>

      <p className="mt-2 text-sm">{status}</p>
      {settings ? (
        <p className="text-xs text-neutral-400">
          Camera actual: {settings.widthPx}×{settings.heightPx} @ {settings.frameRateHz} Hz
        </p>
      ) : null}

      <video ref={videoRef} className="mt-3 w-64 border border-neutral-700" muted playsInline />
      <canvas ref={canvasRef} className="hidden" />

      {results.length > 0 ? (
        <table className="mt-4 text-sm">
          <thead>
            <tr className="text-left">
              <th className="pr-4">Delegate</th>
              <th className="pr-4">Init (ms)</th>
              <th className="pr-4">Mean frame (ms)</th>
              <th className="pr-4">p95 frame (ms)</th>
              <th className="pr-4">Effective FPS</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r, i) => (
              <tr key={i}>
                <td className="pr-4">{r.delegate}</td>
                <td className="pr-4">{r.initLatencyMs.toFixed(0)}</td>
                <td className="pr-4">{r.meanFrameLatencyMs.toFixed(1)}</td>
                <td className="pr-4">{r.p95FrameLatencyMs.toFixed(1)}</td>
                <td className="pr-4">{r.effectiveFps.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </main>
  );
}
