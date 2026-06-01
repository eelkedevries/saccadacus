/**
 * Spike benchmark harness (PROPOSAL.md §27 Phase 7).
 *
 * Measures model initialisation latency, per-frame latency, and effective
 * frame rate for the MediaPipe adapter under a chosen delegate. Lives in the
 * backend-adapter directory because it constructs the CV adapter directly.
 * Benchmarks are run manually in a real browser; this harness collects the
 * numbers.
 */
import { MediaPipeFaceLandmarkerBackend } from './mediaPipeFaceLandmarker';
import type { Delegate } from './mediaPipeFaceLandmarker';
import type { VideoFrameLike } from '../TrackingBackend';

export interface BenchmarkResult {
  delegate: Delegate;
  framesProcessed: number;
  initLatencyMs: number;
  meanFrameLatencyMs: number;
  p95FrameLatencyMs: number;
  effectiveFps: number;
}

export interface BenchmarkOptions {
  delegate: Delegate;
  frames: number;
  /** Supplies the current frame each iteration (e.g. a capture canvas). */
  getFrame: () => VideoFrameLike;
  wasmBaseUrl?: string;
  modelAssetPath?: string;
}

/** Run the benchmark, processing `frames` frames and returning the metrics. */
export async function benchmarkFaceLandmarker(
  options: BenchmarkOptions,
): Promise<BenchmarkResult> {
  const backend = new MediaPipeFaceLandmarkerBackend({
    delegate: options.delegate,
    ...(options.wasmBaseUrl ? { wasmBaseUrl: options.wasmBaseUrl } : {}),
    ...(options.modelAssetPath ? { modelAssetPath: options.modelAssetPath } : {}),
  });

  await backend.initialise({ frameWidth: 640, frameHeight: 480 });
  const initLatencyMs = backend.getInitLatencyMs();

  const latencies: number[] = [];
  const wallStart = performance.now();
  for (let i = 0; i < options.frames; i++) {
    const t = performance.now();
    const result = await backend.processFrame(options.getFrame(), t);
    latencies.push(result.backendLatencyMs ?? performance.now() - t);
    // Yield to the event loop so the browser can present frames.
    await new Promise((r) => requestAnimationFrame(() => r(null)));
  }
  const wallMs = performance.now() - wallStart;
  await backend.dispose();

  return {
    delegate: options.delegate,
    framesProcessed: options.frames,
    initLatencyMs,
    meanFrameLatencyMs: mean(latencies),
    p95FrameLatencyMs: percentile(latencies, 95),
    effectiveFps: options.frames === 0 ? 0 : (options.frames / wallMs) * 1000,
  };
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] as number;
}
