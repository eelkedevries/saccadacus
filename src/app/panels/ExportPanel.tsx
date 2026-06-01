import { useState } from 'react';
import type { ReactElement } from 'react';
import { useUiStore } from '../../state/uiStore';
import { sessionRegistry } from '../sessionRegistry';
import { extractTimeseries } from '../../export/sessionExport';
import {
  buildEventsCsv,
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

type Kind = 'primary' | 'secondary' | 'events';

export function ExportPanel(): ReactElement {
  const exportStatus = useUiStore((s) => s.exportStatus);
  const setExportStatus = useUiStore((s) => s.setExportStatus);
  const [rowInfo, setRowInfo] = useState<string>('');

  const timestamp = (): string => new Date().toISOString().replace(/[:.]/g, '-');

  const buildFor = (
    kind: Kind,
    payload: SessionExportInputV2,
  ): { text: string; filename: string } => {
    const ts = timestamp();
    switch (kind) {
      case 'primary':
        return {
          text: buildPrimaryCsv(payload),
          filename: `primary_output_${trackingModeLabel(payload)}_${ts}.csv`,
        };
      case 'secondary':
        return { text: buildSecondaryCsv(payload), filename: `secondary_output_${ts}.csv` };
      case 'events':
        return { text: buildEventsCsv(payload), filename: `events_${ts}.csv` };
    }
  };

  const exportKinds = (kinds: Kind[]): void => {
    setExportStatus('exporting');
    try {
      const payload = buildExportPayloadFromRegistry();
      const built = kinds.map((k) => buildFor(k, payload));
      let allOk = true;
      // Sequence downloads slightly apart so mobile browsers do not suppress
      // the later ones under a single user gesture.
      built.forEach((file, i) => {
        setTimeout(() => {
          const ok = downloadCsv(file.text, file.filename);
          allOk = allOk && ok;
          if (i === built.length - 1) {
            setExportStatus(allOk ? 'ready' : 'failed');
          }
        }, i * 200);
      });
      const counts = built
        .map((f) => `${f.filename.split('_')[0]}: ${f.text.split('\n').length - 1} rows`)
        .join(', ');
      setRowInfo(counts);
    } catch {
      setExportStatus('failed');
    }
  };

  const buttonClass = 'border border-blue-500 px-3 py-1 text-sm';

  return (
    <section className="border border-neutral-700 p-3" aria-label="Export">
      <h2 className="text-sm font-medium">Export</h2>
      <p className="mt-1 text-xs text-neutral-400">
        Saves CSV files to your device. <code>primary_output</code> is one row per
        time point scoped to the active tracking mode; <code>secondary_output</code>
        is the full per-time-point dataset; <code>events</code> is one row per
        detected saccade or blink.
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" className={buttonClass} onClick={() => exportKinds(['primary'])}>
          Export primary
        </button>
        <button type="button" className={buttonClass} onClick={() => exportKinds(['secondary'])}>
          Export secondary
        </button>
        <button type="button" className={buttonClass} onClick={() => exportKinds(['events'])}>
          Export events
        </button>
        <button
          type="button"
          className="border border-neutral-500 px-3 py-1 text-sm"
          onClick={() => exportKinds(['primary', 'secondary', 'events'])}
        >
          Export all
        </button>
        <span className="text-sm">Status: {exportStatus}</span>
      </div>
      {rowInfo ? <p className="mt-1 text-xs text-neutral-400">{rowInfo}</p> : null}
    </section>
  );
}
