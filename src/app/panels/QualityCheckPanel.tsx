import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { QualityCheckController } from '../../tasks/qualityCheck/qualityCheckController';
import type { QualityAssessment } from '../../tasks/qualityCheck/qualityCheck';
import { sessionRegistry } from '../sessionRegistry';

const STEP_MS = 2500;
const SAMPLE_MS = 100;

export function QualityCheckPanel(): ReactElement {
  const controllerRef = useRef<QualityCheckController | null>(null);
  const [instruction, setInstruction] = useState<string>('');
  const [running, setRunning] = useState(false);
  const [assessment, setAssessment] = useState<QualityAssessment | null>(null);

  useEffect(() => {
    if (!running) return;
    let elapsed = 0;
    const id = setInterval(() => {
      const controller = controllerRef.current;
      if (!controller) return;
      const result = sessionRegistry.latestResult;
      const left = result?.leftEye;
      if (left) {
        controller.ingest({
          xLocal: left.irisCentre?.xLocal ?? left.pupilCentre?.xLocal ?? 0,
          yLocal: left.irisCentre?.yLocal ?? left.pupilCentre?.yLocal ?? 0,
          irisReliability: left.irisCentre?.reliability ?? 0,
          pupilReliability: left.pupilCentre?.reliability ?? 0,
        });
      }
      elapsed += SAMPLE_MS;
      if (elapsed >= STEP_MS) {
        elapsed = 0;
        controller.endStep();
        if (controller.isComplete()) {
          setAssessment(controller.assess());
          setRunning(false);
          setInstruction('');
        } else {
          setInstruction(controller.currentStep()?.instruction ?? '');
        }
      }
    }, SAMPLE_MS);
    return () => clearInterval(id);
  }, [running]);

  const start = (): void => {
    const controller = new QualityCheckController();
    controller.begin();
    controllerRef.current = controller;
    setAssessment(null);
    setInstruction(controller.currentStep()?.instruction ?? '');
    setRunning(true);
  };

  return (
    <section className="border border-neutral-700 p-3" aria-label="Quality check">
      <h2 className="text-sm font-medium">Quality check</h2>
      <p className="mt-1 text-xs text-neutral-400">
        A functional check of signal direction and reliability. This is not a gaze
        calibration.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          className="border border-blue-500 px-3 py-1 text-sm"
          onClick={start}
          disabled={running}
        >
          Start quality check
        </button>
        {running ? <span className="text-sm">{instruction}</span> : null}
      </div>

      {assessment ? (
        <div className="mt-3 text-sm" aria-label="Quality assessment">
          <p>Recommended signal: {assessment.recommendedSignal}</p>
          <p>Reliable: {assessment.signalReliable ? 'yes' : 'no'}</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-neutral-300">
            {assessment.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
