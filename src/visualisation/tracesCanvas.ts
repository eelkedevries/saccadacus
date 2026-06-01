/**
 * Live trace canvases (PROPOSAL.md §9, §23).
 *
 * uPlot instances are backed by `Float32Array` slices read directly from ring
 * buffers; React does not mediate these updates. `readTraceData` assembles the
 * uPlot-aligned data from a ring buffer and is pure, so it is unit-tested
 * directly; the `TracesController` wraps uPlot construction and the redraw loop.
 */
import uPlot from 'uplot';
import type { RingBuffer } from '../signals/ringBuffer';

/** uPlot aligned data: [xValues, ...seriesValues]. */
export type AlignedTraceData = number[][];

/**
 * Read aligned uPlot data from a ring buffer: timestamps as the x axis and the
 * requested channels as series, all ordered oldest to newest.
 */
export function readTraceData(buffer: RingBuffer, channels: number[]): AlignedTraceData {
  const xs = Array.from(buffer.timestampsOrdered());
  const series = channels.map((c) => Array.from(buffer.channelOrdered(c)));
  return [xs, ...series];
}

export interface TraceSeriesSpec {
  channel: number;
  label: string;
  stroke: string;
}

export interface TracesControllerOptions {
  container: HTMLElement;
  buffer: RingBuffer;
  series: TraceSeriesSpec[];
  title: string;
  widthPx: number;
  heightPx: number;
}

export class TracesController {
  private readonly plot: uPlot;
  private readonly channels: number[];

  constructor(private readonly options: TracesControllerOptions) {
    this.channels = options.series.map((s) => s.channel);
    const opts: uPlot.Options = {
      title: options.title,
      width: options.widthPx,
      height: options.heightPx,
      series: [
        {},
        ...options.series.map((s) => ({ label: s.label, stroke: s.stroke })),
      ],
      scales: { x: { time: false } },
    };
    const initial = readTraceData(options.buffer, this.channels) as uPlot.AlignedData;
    this.plot = new uPlot(opts, initial, options.container);
  }

  /** Read the latest ring-buffer slice and push it to uPlot. */
  update(): void {
    this.plot.setData(readTraceData(this.options.buffer, this.channels) as uPlot.AlignedData);
  }

  resize(widthPx: number, heightPx: number): void {
    this.plot.setSize({ width: widthPx, height: heightPx });
  }

  destroy(): void {
    this.plot.destroy();
  }
}
