import { describe, expect, it, vi } from 'vitest';

// Mock the library so the GPU delegate fails to initialise and CPU succeeds.
const createCalls: string[] = [];
vi.mock('@mediapipe/tasks-vision', () => {
  class FakeLandmarker {
    detectForVideo(): unknown {
      return { faceLandmarks: [], faceBlendshapes: [], facialTransformationMatrixes: [] };
    }
    close(): void {}
  }
  return {
    FilesetResolver: { forVisionTasks: () => Promise.resolve({}) },
    FaceLandmarker: {
      createFromOptions: (_fileset: unknown, opts: { baseOptions: { delegate: string } }) => {
        const delegate = opts.baseOptions.delegate;
        createCalls.push(delegate);
        if (delegate === 'GPU') {
          return Promise.reject(new Error('GPU delegate unavailable'));
        }
        return Promise.resolve(new FakeLandmarker());
      },
    },
  };
});

import { createMediaPipeBackend } from '../../src/tracking/backendAdapters/mediaPipeFaceLandmarker';

describe('createMediaPipeBackend delegate fallback', () => {
  it('falls back from GPU to CPU when GPU initialisation fails', async () => {
    const { delegate } = await createMediaPipeBackend({ frameWidth: 640, frameHeight: 480 });
    expect(createCalls).toEqual(['GPU', 'CPU']);
    expect(delegate).toBe('CPU');
  });
});
