import { useRef } from 'react';
import type { ReactElement } from 'react';
import { useLiveSession } from '../useLiveSession';

export function LiveView(): ReactElement {
  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const tracesRef = useRef<HTMLDivElement | null>(null);
  useLiveSession(overlayRef, tracesRef);

  return (
    <section className="space-y-3" aria-label="Live view">
      <div className="relative">
        <canvas
          ref={overlayRef}
          width={480}
          height={320}
          className="w-full border border-neutral-700"
          aria-label="Camera overlay (synthetic)"
        />
        <p className="mt-1 text-xs text-neutral-400">
          Synthetic overlay. Eye markers, head-pose axes, and the reliability bar
          are driven by the mock backend.
        </p>
      </div>
      <div ref={tracesRef} className="w-full" aria-label="Eye-local position traces" />
    </section>
  );
}
