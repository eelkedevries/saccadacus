import type { ReactElement } from 'react';
import { useUiStore } from '../../state/uiStore';
import { sessionRegistry } from '../sessionRegistry';

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

/**
 * Switch between available gaze-mapped signal variants (PROPOSAL.md §12).
 * Only shown once gaze mapping is available; each variant displays its fit
 * reliability so the user can pick a reliable mapping.
 */
export function MappedSignalSwitch(): ReactElement | null {
  const gazeMappingAvailable = useUiStore((s) => s.gazeMappingAvailable);
  const gazeVariants = useUiStore((s) => s.gazeVariants);
  const activeGazeVariant = useUiStore((s) => s.activeGazeVariant);
  const setActiveGazeVariant = useUiStore((s) => s.setActiveGazeVariant);

  if (!gazeMappingAvailable || gazeVariants.length === 0) {
    return null;
  }

  const select = (id: string): void => {
    setActiveGazeVariant(id);
    sessionRegistry.gazeMapping?.setActive(id);
  };

  return (
    <fieldset className="border border-neutral-700 p-3" aria-label="Mapped signal">
      <legend className="px-1 text-sm">Gaze-mapped signal</legend>
      <p className="mb-2 text-xs text-neutral-400">
        The eye-local signal is still recorded and exported. Mapped output is shown
        by default once available.
      </p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Gaze-mapped signal">
        {gazeVariants.map((v) => (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={activeGazeVariant === v.id}
            onClick={() => select(v.id)}
            className={
              activeGazeVariant === v.id
                ? 'border border-blue-500 px-3 py-1 text-sm'
                : 'border border-neutral-600 px-3 py-1 text-sm'
            }
          >
            {v.id} ({formatPercent(v.reliability)})
          </button>
        ))}
      </div>
    </fieldset>
  );
}
