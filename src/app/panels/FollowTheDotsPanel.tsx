import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { FollowTheDotsController } from '../../tasks/followTheDots/followTheDotsController';
import type { DotRecord } from '../../tasks/followTheDots/followTheDotsController';
import { useUiStore } from '../../state/uiStore';
import { sessionRegistry } from '../sessionRegistry';
import { extractTimeseries } from '../../export/sessionExport';
import { GazeMappingService } from '../../tasks/gazeMapping/gazeMappingService';

const DOT_INTERVAL_MS = 1200;

export function FollowTheDotsPanel(): ReactElement {
  const trackingMode = useUiStore((s) => s.trackingMode);
  const eyeSelectionMode = useUiStore((s) => s.eyeSelectionMode);
  const faceReliability = useUiStore((s) => s.faceReliability);
  const setGazeVariants = useUiStore((s) => s.setGazeVariants);
  const setActiveGazeVariant = useUiStore((s) => s.setActiveGazeVariant);
  const setGazeMappingAvailable = useUiStore((s) => s.setGazeMappingAvailable);
  const [mappingNote, setMappingNote] = useState<string>('');

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
    const controller = controllerRef.current;
    controller?.stop(performance.now());
    setRunning(false);
    setActiveDot(undefined);
    setDotCount(controller?.getDots().length ?? 0);
    fitGazeMapping(controller?.getDots() ?? []);
  };

  const fitGazeMapping = (dots: DotRecord[]): void => {
    const pipeline = sessionRegistry.pipeline;
    if (!pipeline || dots.length < 5) {
      setMappingNote('Not enough dots to fit gaze mapping (need at least five).');
      return;
    }
    const timeseries = extractTimeseries(pipeline.signalBuffer, pipeline.headBuffer);
    const service = new GazeMappingService();
    const variants = service.fit(dots, timeseries);
    sessionRegistry.gazeMapping = service;
    const reliable = variants
      .filter((v) => v.model.reliability > 0)
      .map((v) => ({ id: v.id, reliability: v.model.reliability }));
    if (reliable.length === 0) {
      setMappingNote('Gaze mapping could not be fitted reliably from these dots.');
      return;
    }
    setGazeVariants(reliable);
    setActiveGazeVariant(reliable[0]!.id);
    setGazeMappingAvailable(true);
    setMappingNote(`Gaze mapping fitted: ${reliable.length} variant(s) available.`);
  };

  return (
    <section className="border border-neutral-700 p-3" aria-label="Follow-the-dots task">
      <h2 className="text-sm font-medium">Follow-the-dots task</h2>
      <p className="mt-1 text-xs text-neutral-400">
        Optional. Follow each dot with your eyes. Used later to fit gaze mapping.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          className="border border-blue-500 px-3 py-1 text-sm disabled:border-neutral-700 disabled:text-neutral-500"
          onClick={start}
          disabled={running}
        >
          Start follow-the-dots task
        </button>
        <span className="text-sm" aria-label="Dots shown">
          Dots shown: {dotCount}
        </span>
      </div>
      {mappingNote ? <p className="mt-2 text-xs text-neutral-400">{mappingNote}</p> : null}

      {running && activeDot ? (
        <div
          className="fixed inset-0 z-50 bg-neutral-950"
          role="dialog"
          aria-label="Follow-the-dots fullscreen"
        >
          <span
            data-testid="follow-dot"
            className="absolute h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-400"
            style={{
              left: `${activeDot.xScreen * 100}%`,
              top: `${activeDot.yScreen * 100}%`,
            }}
          />
          <button
            type="button"
            onClick={stop}
            className="absolute top-4 right-4 border border-neutral-500 bg-neutral-900/80 px-3 py-1 text-sm text-neutral-100"
          >
            Stop
          </button>
          <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-neutral-400">
            Follow the dot with your eyes. Keep your head reasonably still. Tap Stop
            to finish.
          </p>
        </div>
      ) : null}
    </section>
  );
}
