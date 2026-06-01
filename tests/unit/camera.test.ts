import { describe, expect, it, vi } from 'vitest';
import {
  buildCameraConstraints,
  readActualSettings,
} from '../../src/camera/cameraConstraints';
import { CameraController } from '../../src/camera/cameraController';
import type { CameraState } from '../../src/camera/cameraController';

describe('cameraConstraints', () => {
  it('builds video-only constraints with ideal values', () => {
    const c = buildCameraConstraints({ widthPx: 640, heightPx: 480, frameRateHz: 30 });
    expect(c.audio).toBe(false);
    expect(c.video).toEqual({
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30 },
    });
  });

  it('includes facingMode when provided', () => {
    const c = buildCameraConstraints({
      widthPx: 1280,
      heightPx: 720,
      frameRateHz: 30,
      facingMode: 'user',
    });
    const video = c.video as MediaTrackConstraints;
    expect(video.facingMode).toEqual({ ideal: 'user' });
  });

  it('reads actual settings, replacing missing fields with null', () => {
    const track = {
      getSettings: () => ({ width: 800, height: 600 }),
    } as unknown as MediaStreamTrack;
    const actual = readActualSettings(track);
    expect(actual.widthPx).toBe(800);
    expect(actual.heightPx).toBe(600);
    expect(actual.frameRateHz).toBeNull();
    expect(actual.deviceId).toBeNull();
    expect(actual.facingMode).toBeNull();
  });
});

function fakeStream(
  width: number,
  height: number,
): { stream: MediaStream; stopSpy: ReturnType<typeof vi.fn> } {
  const stopSpy = vi.fn();
  const track = {
    kind: 'video',
    stop: stopSpy,
    getSettings: () => ({ width, height, frameRate: 30 }),
  } as unknown as MediaStreamTrack;
  const stream = {
    getVideoTracks: () => [track],
    getTracks: () => [track],
  } as unknown as MediaStream;
  return { stream, stopSpy };
}

describe('CameraController', () => {
  it('transitions idle → requestingPermission → preparingBackend → ready', async () => {
    const states: CameraState[] = [];
    let resolveBackend!: () => void;
    const backendReady = new Promise<void>((r) => {
      resolveBackend = r;
    });
    const controller = new CameraController({
      getUserMedia: () => Promise.resolve(fakeStream(640, 480).stream),
      awaitBackendReady: () => backendReady,
    });
    controller.subscribe((s) => states.push(s));
    const startPromise = controller.start({ widthPx: 640, heightPx: 480, frameRateHz: 30 });
    // Yield twice so the start coroutine reaches awaitBackendReady.
    await Promise.resolve();
    await Promise.resolve();
    resolveBackend();
    await startPromise;
    const statuses = states.map((s) => s.status);
    expect(statuses).toContain('requestingPermission');
    expect(statuses).toContain('preparingBackend');
    expect(statuses[statuses.length - 1]).toBe('ready');
    expect(states[states.length - 1]?.actualSettings?.widthPx).toBe(640);
  });

  it('reports a British-spelled status string in preparingBackend', async () => {
    const controller = new CameraController({
      getUserMedia: () => Promise.resolve(fakeStream(320, 240).stream),
      awaitBackendReady: () => new Promise(() => {}), // never resolves
    });
    void controller.start({ widthPx: 320, heightPx: 240, frameRateHz: 30 });
    // Wait until the controller has advanced past permission.
    await Promise.resolve();
    await Promise.resolve();
    const state = controller.getState();
    expect(state.status).toBe('preparingBackend');
    expect(state.message).toMatch(/Initialising tracking/);
  });

  it('moves to error when getUserMedia rejects', async () => {
    const controller = new CameraController({
      getUserMedia: () => Promise.reject(new Error('NotAllowedError')),
      awaitBackendReady: () => Promise.resolve(),
    });
    await controller.start({ widthPx: 640, heightPx: 480, frameRateHz: 30 });
    const state = controller.getState();
    expect(state.status).toBe('error');
    expect(state.errorMessage).toMatch(/NotAllowedError/);
  });

  it('moves to error when the backend fails to initialise', async () => {
    const controller = new CameraController({
      getUserMedia: () => Promise.resolve(fakeStream(640, 480).stream),
      awaitBackendReady: () => Promise.reject(new Error('model load failed')),
    });
    await controller.start({ widthPx: 640, heightPx: 480, frameRateHz: 30 });
    const state = controller.getState();
    expect(state.status).toBe('error');
    expect(state.errorMessage).toMatch(/model load failed/);
  });

  it('stop() stops the tracks and sets status to disposed', async () => {
    const { stream, stopSpy } = fakeStream(640, 480);
    const controller = new CameraController({
      getUserMedia: () => Promise.resolve(stream),
      awaitBackendReady: () => Promise.resolve(),
    });
    await controller.start({ widthPx: 640, heightPx: 480, frameRateHz: 30 });
    controller.stop();
    expect(controller.getState().status).toBe('disposed');
    expect(stopSpy).toHaveBeenCalled();
  });
});
