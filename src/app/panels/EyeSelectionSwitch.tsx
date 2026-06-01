import type { ReactElement } from 'react';
import type { EyeSelectionMode } from '../../tracking/TrackingBackend';
import { useUiStore } from '../../state/uiStore';

const MODES: { value: EyeSelectionMode; label: string }[] = [
  { value: 'left', label: 'Left eye' },
  { value: 'right', label: 'Right eye' },
  { value: 'binocular', label: 'Binocular' },
  { value: 'both', label: 'Both eyes' },
];

export function EyeSelectionSwitch(): ReactElement {
  const eyeSelectionMode = useUiStore((s) => s.eyeSelectionMode);
  const setEyeSelectionMode = useUiStore((s) => s.setEyeSelectionMode);

  return (
    <fieldset className="border border-neutral-700 p-3">
      <legend className="px-1 text-sm">Eye selection</legend>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Eye selection">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={eyeSelectionMode === m.value}
            onClick={() => setEyeSelectionMode(m.value)}
            className={
              eyeSelectionMode === m.value
                ? 'border border-blue-500 px-3 py-1 text-sm'
                : 'border border-neutral-600 px-3 py-1 text-sm'
            }
          >
            {m.label}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
