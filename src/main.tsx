import { StrictMode } from 'react';
import type { ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { lazy, Suspense } from 'react';
import { App } from './app/App';
import 'uplot/dist/uPlot.min.css';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

// Dev-only spike benchmark, code-split and only loaded when explicitly
// requested with `?spike=mediapipe`. The default boot path always renders the
// app with MockTrackingBackend (PROPOSAL.md §27 Phase 7).
const spikeRequested =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('spike') === 'mediapipe';

const SpikeBenchmark = lazy(() =>
  import('./app/SpikeBenchmark').then((m) => ({ default: m.SpikeBenchmark })),
);

function Root(): ReactElement {
  if (spikeRequested) {
    return (
      <Suspense fallback={<p className="p-4 text-sm">Loading spike benchmark…</p>}>
        <SpikeBenchmark />
      </Suspense>
    );
  }
  return <App />;
}

createRoot(rootElement).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
