/**
 * Blink detection (PROPOSAL.md §7).
 *
 * Blinks are detected separately from saccades so that blink-related signal
 * loss is not mistaken for eye movement. A blink is a contiguous run of
 * non-open blink states bracketed by open states; a run that reaches `closed`
 * is treated as a confident blink.
 */
import type { BlinkEvent, BlinkState } from '../tracking/TrackingBackend';

export interface BlinkDetectorSample {
  tsMs: number;
  blinkState: BlinkState;
  reliability: number;
}

export interface BlinkDetectorConfig {
  eye?: BlinkEvent['eye'];
  minDurationMs?: number;
}

const BLINK_PHASES: ReadonlySet<BlinkState> = new Set<BlinkState>([
  'closing',
  'closed',
  'opening',
]);

export function detectBlinks(
  samples: BlinkDetectorSample[],
  config: BlinkDetectorConfig = {},
): BlinkEvent[] {
  const eye = config.eye ?? 'both';
  const minDurationMs = config.minDurationMs ?? 0;

  const events: BlinkEvent[] = [];
  const n = samples.length;
  let i = 0;
  while (i < n) {
    if (!BLINK_PHASES.has((samples[i] as BlinkDetectorSample).blinkState)) {
      i += 1;
      continue;
    }
    const start = i;
    let reachedClosed = false;
    while (i < n && BLINK_PHASES.has((samples[i] as BlinkDetectorSample).blinkState)) {
      if ((samples[i] as BlinkDetectorSample).blinkState === 'closed') {
        reachedClosed = true;
      }
      i += 1;
    }
    const end = i - 1;
    const onsetMs = (samples[start] as BlinkDetectorSample).tsMs;
    // Offset is the first open sample after the run, if any, else the last
    // blink-phase sample.
    const offsetMs =
      i < n ? (samples[i] as BlinkDetectorSample).tsMs : (samples[end] as BlinkDetectorSample).tsMs;
    const durationMs = offsetMs - onsetMs;
    if (durationMs < minDurationMs) continue;

    events.push({
      onsetMs,
      offsetMs,
      durationMs,
      eye,
      confidence: reachedClosed ? 0.9 : 0.6,
    });
  }
  return events;
}
