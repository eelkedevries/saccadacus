import { useState } from 'react';
import type { ReactElement } from 'react';
import { useUiStore } from '../../state/uiStore';
import { sessionRegistry } from '../sessionRegistry';
import { extractTimeseries } from '../../export/sessionExport';
import {
  buildPrimaryCsv,
  buildSecondaryCsv,
  trackingModeLabel,
} from '../../export/outputs';
import type { SessionExportInputV2 } from '../../export/outputs';

export function buildExportPayloadFromRegistry(): SessionExportInputV2 {
  const { pipeline, tracker, getDots, camera, gazeMapping } = sessionRegistry;
  const { trackingMode, eyeSelectionMode } = useUiStore.getState();
  const timeseries = pipeline
    ? extractTimeseries(pipeline.signalBuffer, pipeline.headBuffer)
    : [];
  const gaze = gazeMapping?.getActive();
  return {
    timeseries,
    saccades: tracker?.getCompletedSaccades() ?? [],
    blinks: tracker?.getCompletedBlinks() ?? [],
    dots: getDots?.() ?? [],
    trackingMode,
    eyeSelectionMode,
    ...(camera ? { camera } : {}),
    ...(gaze ? { gaze } : {}),
  };
}

function downloadCsv(text: string, filename: string): boolean {
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    return false;
  }
  const blob = new Blob([text], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  return true;
}

export function ExportPanel(): ReactElement {
  const exportStatus = useUiStore((s) => s.exportStatus);
  const setExportStatus = useUiStore((s) => s.setExportStatus);
  const [rowInfo, setRowInfo] = useState<string>('');

  const onExport = (): void => {
    setExportStatus('exporting');
    try {
      const payload = buildExportPayloadFromRegistry();
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const label = trackingModeLabel(payload);
      const primary = buildPrimaryCsv(payload);
      const secondary = buildSecondaryCsv(payload);
      const primaryRows = primary.split('\n').length - 1;
      const secondaryRows = secondary.split('\n').length - 1;
      const primaryOk = downloadCsv(primary, `primary_output_${label}_${ts}.csv`);
      // Trigger the second download after the first so mobile browsers don't
      // batch them into a single user-gesture suppression.
      let secondaryOk = false;
      setTimeout(() => {
        secondaryOk = downloadCsv(secondary, `secondary_output_${ts}.csv`);
        setExportStatus(primaryOk && secondaryOk ? 'ready' : 'failed');
      }, 200);
      setRowInfo(`${primaryRows} primary rows, ${secondaryRows} secondary rows`);
    } catch {
      setExportStatus('failed');
    }
  };

  return (
    <section className="border border-neutral-700 p-3" aria-label="Export">
      <h2 className="text-sm font-medium">Export</h2>
      <p className="mt-1 text-xs text-neutral-400">
        Downloads two CSV files to your device:
        <span className="block">
          • <code>primary_output</code>: one row per time point, scoped to the
          active tracking mode.
        </span>
        <span className="block">
          • <code>secondary_output</code>: the full dataset, one row per time
          point, with events and dots folded onto the time axis.
        </span>
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          className="border border-blue-500 px-3 py-1 text-sm"
          onClick={onExport}
        >
          Export CSV files
        </button>
        <span className="text-sm">Status: {exportStatus}</span>
        {rowInfo ? <span className="text-xs text-neutral-400">{rowInfo}</span> : null}
      </div>
    </section>
  );
}
