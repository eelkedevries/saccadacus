import { describe, expect, it, vi } from 'vitest';

// Mock the heavy CV library so the smoke test runs without network or a browser.
vi.mock('@mediapipe/tasks-vision', () => {
  class FakeLandmarker {
    detectForVideo(): unknown {
      return {
        faceLandmarks: [
          // Minimal landmark array; indices used by the adapter are populated.
          Array.from({ length: 478 }, (_, i) => ({ x: 0.5 + i * 1e-4, y: 0.5, z: 0 })),
        ],
        faceBlendshapes: [{ categories: [{ categoryName: 'eyeBlinkLeft', score: 0.0 }] }],
        facialTransformationMatrixes: [{ data: identity4x4() }],
      };
    }
    close(): void {}
  }
  return {
    FilesetResolver: { forVisionTasks: () => Promise.resolve({}) },
    FaceLandmarker: { createFromOptions: () => Promise.resolve(new FakeLandmarker()) },
  };
});

function identity4x4(): number[] {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

import { MediaPipeFaceLandmarkerBackend } from '../../src/tracking/backendAdapters/mediaPipeFaceLandmarker';
import type { TrackingBackend, VideoFrameLike } from '../../src/tracking/TrackingBackend';

const fakeFrame = {} as VideoFrameLike;

describe('MediaPipeFaceLandmarkerBackend (smoke)', () => {
  it('satisfies the TrackingBackend interface', () => {
    const backend: TrackingBackend = new MediaPipeFaceLandmarkerBackend();
    expect(typeof backend.initialise).toBe('function');
    expect(typeof backend.processFrame).toBe('function');
    expect(typeof backend.dispose).toBe('function');
  });

  it('throws if a frame is processed before initialise', () => {
    const backend = new MediaPipeFaceLandmarkerBackend();
    expect(() => backend.processFrame(fakeFrame, 0)).toThrow(/before initialise/);
  });

  it('echoes pageTimestampMs unchanged and returns derived signals', async () => {
    const backend = new MediaPipeFaceLandmarkerBackend({ delegate: 'CPU' });
    await backend.initialise({ frameWidth: 640, frameHeight: 480 });
    const result = await backend.processFrame(fakeFrame, 1234.5);
    expect(result.pageTimestampMs).toBe(1234.5);
    expect(result.faceReliability).toBeGreaterThan(0);
    expect(result.leftEye?.irisCentre).toBeDefined();
    expect(result.headPose).toBeDefined();
    expect(typeof result.backendLatencyMs).toBe('number');
    // Overlay landmark hints for the on-screen overlay (never exported to CSV).
    expect(result.overlayLandmarks?.leftEye?.iris).toBeDefined();
    expect(result.overlayLandmarks?.faceCentre).toBeDefined();
    await backend.dispose();
  });

  it('records an initialisation latency', async () => {
    const backend = new MediaPipeFaceLandmarkerBackend();
    await backend.initialise({ frameWidth: 640, frameHeight: 480 });
    expect(backend.getInitLatencyMs()).toBeGreaterThanOrEqual(0);
  });
});
