import type { ReactElement } from 'react';
import { useUiStore } from '../../state/uiStore';

function formatReliability(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function StatusPanel(): ReactElement {
  const trackingStatus = useUiStore((s) => s.trackingStatus);
  const activeSelection = useUiStore((s) => s.activeSelection);
  const leftReliability = useUiStore((s) => s.leftReliability);
  const rightReliability = useUiStore((s) => s.rightReliability);
  const faceReliability = useUiStore((s) => s.faceReliability);
  const saccadeCount = useUiStore((s) => s.saccadeCount);
  const blinkCount = useUiStore((s) => s.blinkCount);
  const gazeMappingAvailable = useUiStore((s) => s.gazeMappingAvailable);
  const exportStatus = useUiStore((s) => s.exportStatus);

  return (
    <section className="border border-neutral-700 p-3" aria-label="Status">
      <h2 className="text-sm font-medium">Status</h2>
      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        <dt>Tracking</dt>
        <dd>{trackingStatus}</dd>
        <dt>Active signal</dt>
        <dd>{activeSelection}</dd>
        <dt>Left eye reliability</dt>
        <dd>{formatReliability(leftReliability)}</dd>
        <dt>Right eye reliability</dt>
        <dd>{formatReliability(rightReliability)}</dd>
        <dt>Face reliability</dt>
        <dd>{formatReliability(faceReliability)}</dd>
        <dt>Saccades</dt>
        <dd>{saccadeCount}</dd>
        <dt>Blinks</dt>
        <dd>{blinkCount}</dd>
        <dt>Gaze mapping</dt>
        <dd>{gazeMappingAvailable ? 'available' : 'not available'}</dd>
        <dt>Export</dt>
        <dd>{exportStatus}</dd>
      </dl>
    </section>
  );
}
