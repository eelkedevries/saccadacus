import { useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useLiveSession } from '../useLiveSession';
import { useRealTracking } from '../useRealTracking';

type Mode = 'synthetic' | 'camera';

function SyntheticLiveView(): ReactElement {
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const tracesRef = useRef<HTMLDivElement | null>(null);
  useLiveSession(overlayRef, tracesRef);

  return (
    <div className="space-y-3">
      <canvas
        ref={overlayRef}
        width={480}
        height={320}
        className="w-full border border-neutral-700"
        aria-label="Synthetic overlay"
      />
      <p className="text-xs text-neutral-400">
        Synthetic signals from the mock backend. Start camera tracking to use your
        own camera.
      </p>
      <div ref={tracesRef} className="w-full" aria-label="Eye-local position traces" />
    </div>
  );
}

function CameraLiveView(): ReactElement {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const tracesRef = useRef<HTMLDivElement | null>(null);
  const centringWrapperRef = useRef<HTMLDivElement | null>(null);
  const { message } = useRealTracking(videoRef, overlayRef, tracesRef, centringWrapperRef);

  return (
    <div className="space-y-3">
      <div className="relative w-full overflow-hidden border border-neutral-700 bg-neutral-950">
        <div
          ref={centringWrapperRef}
          className="relative h-full w-full will-change-transform"
          style={{ transformOrigin: '0 0' }}
        >
          <video ref={videoRef} className="block w-full" muted playsInline />
          <canvas
            ref={overlayRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-label="Camera overlay"
          />
        </div>
      </div>
      <p className="text-xs text-neutral-400">{message}</p>
      <div ref={tracesRef} className="w-full" aria-label="Eye-local position traces" />
    </div>
  );
}

export function LiveView(): ReactElement {
  const [mode, setMode] = useState<Mode>('synthetic');

  const toggleCamera = (): void => {
    setMode((m) => (m === 'camera' ? 'synthetic' : 'camera'));
  };

  return (
    <section className="space-y-3" aria-label="Live view">
      <div className="flex gap-2" role="group" aria-label="Live view source">
        <button
          type="button"
          aria-pressed={mode === 'camera'}
          className={
            mode === 'camera'
              ? 'border border-blue-500 px-3 py-1 text-sm'
              : 'border border-neutral-600 px-3 py-1 text-sm'
          }
          onClick={toggleCamera}
        >
          {mode === 'camera' ? 'Stop camera tracking' : 'Start camera tracking'}
        </button>
        <button
          type="button"
          aria-pressed={mode === 'synthetic'}
          className={
            mode === 'synthetic'
              ? 'border border-blue-500 px-3 py-1 text-sm'
              : 'border border-neutral-600 px-3 py-1 text-sm'
          }
          onClick={() => setMode('synthetic')}
        >
          Synthetic demo
        </button>
      </div>
      {mode === 'camera' ? <CameraLiveView /> : <SyntheticLiveView />}
    </section>
  );
}
