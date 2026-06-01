import type { ReactElement } from 'react';
import type { TrackingMode } from '../../tracking/TrackingBackend';
import { useUiStore } from '../../state/uiStore';

const MODES: { value: TrackingMode; label: string }[] = [
  { value: 'auto', label: 'Automatic' },
  { value: 'iris', label: 'Iris centre' },
  { value: 'pupil', label: 'Pupil centre' },
];

export function TrackingModeSwitch(): ReactElement {
  const trackingMode = useUiStore((s) => s.trackingMode);
  const setTrackingMode = useUiStore((s) => s.setTrackingMode);

  return (
    <fieldset className="border border-neutral-700 p-3">
      <legend className="px-1 text-sm">Tracking mode</legend>
      <div className="flex gap-2" role="radiogroup" aria-label="Tracking mode">
        {MODES.map((m) => (
          <button
            key={m.value}
            type="button"
            role="radio"
            aria-checked={trackingMode === m.value}
            onClick={() => setTrackingMode(m.value)}
            className={
              trackingMode === m.value
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
