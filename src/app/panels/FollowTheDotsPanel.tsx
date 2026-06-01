import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { FollowTheDotsController } from '../../tasks/followTheDots/followTheDotsController';
import type { DotRecord } from '../../tasks/followTheDots/followTheDotsController';
import { useUiStore } from '../../state/uiStore';
import { sessionRegistry } from '../sessionRegistry';

const DOT_INTERVAL_MS = 1200;

export function FollowTheDotsPanel(): ReactElement {
  const trackingMode = useUiStore((s) => s.trackingMode);
  const eyeSelectionMode = useUiStore((s) => s.eyeSelectionMode);
  const faceReliability = useUiStore((s) => s.faceReliability);

  const controllerRef = useRef<FollowTheDotsController | null>(null);
  const [running, setRunning] = useState(false);
  const [dotCount, setDotCount] = useState(0);
  const [activeDot, setActiveDot] = useState<DotRecord | undefined>(undefined);

  useEffect(() => {
    sessionRegistry.getDots = () => controllerRef.current?.getDots() ?? [];
    return () => {
      delete sessionRegistry.getDots;
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const controller = controllerRef.current;
      if (!controller) return;
      controller.advance(performance.now(), faceReliability);
      setActiveDot(controller.current());
      setDotCount(controller.getDots().length);
    }, DOT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [running, faceReliability]);

  const start = (): void => {
    const controller = new FollowTheDotsController({ trackingMode, eyeSelectionMode });
    controller.start(performance.now(), faceReliability);
    controllerRef.current = controller;
    setRunning(true);
    setActiveDot(controller.current());
    setDotCount(controller.getDots().length);
  };

  const stop = (): void => {
    controllerRef.current?.stop(performance.now());
    setRunning(false);
    setActiveDot(undefined);
    setDotCount(controllerRef.current?.getDots().length ?? 0);
  };

  return (
    <section className="border border-neutral-700 p-3" aria-label="Follow-the-dots task">
      <h2 className="text-sm font-medium">Follow-the-dots task</h2>
      <p className="mt-1 text-xs text-neutral-400">
        Optional. Follow each dot with your eyes. Used later to fit gaze mapping.
      </p>
      <div className="mt-2 flex items-center gap-3">
        {running ? (
          <button type="button" className="border border-neutral-600 px-3 py-1 text-sm" onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="button" className="border border-blue-500 px-3 py-1 text-sm" onClick={start}>
            Start follow-the-dots task
          </button>
        )}
        <span className="text-sm" aria-label="Dots shown">
          Dots shown: {dotCount}
        </span>
      </div>

      {running && activeDot ? (
        <div className="relative mt-3 h-48 border border-neutral-800 bg-neutral-950">
          <span
            data-testid="follow-dot"
            className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400"
            style={{ left: `${activeDot.xScreen * 100}%`, top: `${activeDot.yScreen * 100}%` }}
          />
        </div>
      ) : null}
    </section>
  );
}
