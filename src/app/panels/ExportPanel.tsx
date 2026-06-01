import { useState } from 'react';
import type { ReactElement } from 'react';
import { useUiStore } from '../../state/uiStore';
import { sessionRegistry } from '../sessionRegistry';
import { buildSessionCsv, extractTimeseries } from '../../export/sessionExport';

export function buildCsvFromRegistry(): string {
  const { pipeline, tracker, getDots, camera } = sessionRegistry;
  const { trackingMode, eyeSelectionMode } = useUiStore.getState();
  const timeseries = pipeline
    ? extractTimeseries(pipeline.signalBuffer, pipeline.headBuffer)
    : [];
  return buildSessionCsv({
    timeseries,
    saccades: tracker?.getCompletedSaccades() ?? [],
    blinks: tracker?.getCompletedBlinks() ?? [],
    dots: getDots?.() ?? [],
    trackingMode,
    eyeSelectionMode,
    ...(camera ? { camera } : {}),
  });
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
      const csv = buildCsvFromRegistry();
      const lineCount = csv.split('\n').length - 1; // minus header
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const ok = downloadCsv(csv, `saccadacus-${ts}.csv`);
      setRowInfo(`${lineCount} data rows`);
      setExportStatus(ok ? 'ready' : 'failed');
    } catch {
      setExportStatus('failed');
    }
  };

  return (
    <section className="border border-neutral-700 p-3" aria-label="Export">
      <h2 className="text-sm font-medium">Export</h2>
      <p className="mt-1 text-xs text-neutral-400">
        Downloads one combined CSV with time-series, event, and dot rows. All data
        stays on your device.
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          className="border border-blue-500 px-3 py-1 text-sm"
          onClick={onExport}
        >
          Export combined CSV
        </button>
        <span className="text-sm">Status: {exportStatus}</span>
        {rowInfo ? <span className="text-xs text-neutral-400">{rowInfo}</span> : null}
      </div>
    </section>
  );
}
