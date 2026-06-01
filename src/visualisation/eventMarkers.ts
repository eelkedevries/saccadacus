/**
 * Event markers on trace canvases (PROPOSAL.md §23).
 *
 * Saccades and blinks (and later dot onsets) are drawn as translucent time
 * bands on the uPlot traces. `*ToBands` are pure and unit-tested; the plugin
 * itself draws the bands during uPlot's draw hook on the main thread.
 */
import type uPlot from 'uplot';
import type { BlinkEvent, DotEvent, SaccadeEvent } from '../tracking/TrackingBackend';

export type MarkerKind = 'saccade' | 'blink' | 'dot';

export interface EventBand {
  startMs: number;
  endMs: number;
  kind: MarkerKind;
}

const BAND_FILL: Record<MarkerKind, string> = {
  saccade: 'rgba(30, 136, 229, 0.18)',
  blink: 'rgba(176, 0, 32, 0.18)',
  dot: 'rgba(67, 160, 71, 0.18)',
};

export function saccadesToBands(events: readonly SaccadeEvent[]): EventBand[] {
  return events.map((e) => ({ startMs: e.onsetMs, endMs: e.offsetMs, kind: 'saccade' }));
}

export function blinksToBands(events: readonly BlinkEvent[]): EventBand[] {
  return events.map((e) => ({ startMs: e.onsetMs, endMs: e.offsetMs, kind: 'blink' }));
}

export function dotsToBands(events: readonly DotEvent[]): EventBand[] {
  return events.map((e) => ({
    startMs: e.onsetMs,
    endMs: e.offsetMs ?? e.onsetMs,
    kind: 'dot',
  }));
}

/**
 * A uPlot plugin that draws event bands. `getBands` is read on every draw so
 * the latest events appear without rebuilding the plot.
 */
export function createEventMarkerPlugin(getBands: () => EventBand[]): uPlot.Plugin {
  return {
    hooks: {
      draw: (u: uPlot) => {
        const ctx = u.ctx;
        const bands = getBands();
        const top = u.bbox.top;
        const height = u.bbox.height;
        ctx.save();
        for (const band of bands) {
          const x0 = u.valToPos(band.startMs, 'x', true);
          const x1 = u.valToPos(band.endMs, 'x', true);
          const w = Math.max(1, x1 - x0);
          ctx.fillStyle = BAND_FILL[band.kind];
          ctx.fillRect(x0, top, w, height);
        }
        ctx.restore();
      },
    },
  };
}
