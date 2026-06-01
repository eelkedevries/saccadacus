import type { ReactElement } from 'react';
import { TrackingModeSwitch } from './panels/TrackingModeSwitch';
import { EyeSelectionSwitch } from './panels/EyeSelectionSwitch';
import { StatusPanel } from './panels/StatusPanel';
import { LiveView } from './panels/LiveView';

export function App(): ReactElement {
  return (
    <main className="min-h-screen bg-neutral-900 p-4 text-neutral-100">
      <header className="mb-4">
        <h1 className="text-xl font-medium">saccadacus</h1>
        <p className="text-sm text-neutral-400">
          Browser-based eye-movement tracking. Driven by synthetic signals until a
          camera backend is enabled.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4">
            <TrackingModeSwitch />
            <EyeSelectionSwitch />
          </div>
          <LiveView />
        </div>
        <StatusPanel />
      </div>
    </main>
  );
}
