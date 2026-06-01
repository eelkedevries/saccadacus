/**
 * Typed message protocol between the main thread, the tracking worker, and
 * the signal worker (PROPOSAL.md §22).
 *
 * Every message carries `pageTimestampMs`, the `performance.now()` value
 * captured on the main thread at the moment the originating event occurred.
 * The single canonical clock rule (§24) requires that this value travel
 * through the pipeline unchanged.
 */
import type {
  TrackingBackendConfig,
  TrackingFrameResult,
  VideoFrameLike,
} from '../tracking/TrackingBackend';

export interface MessageBase {
  /** `performance.now()` captured on the main thread; unchanged across hops. */
  pageTimestampMs: number;
}

/** Messages sent from the main thread to the tracking worker. */
export type MainToTrackingMessage =
  | (MessageBase & { kind: 'init'; config: TrackingBackendConfig })
  | (MessageBase & { kind: 'frame'; frame: VideoFrameLike; videoMediaTimeMs?: number })
  | (MessageBase & { kind: 'dispose' });

/** Messages sent from the tracking worker back to the main thread. */
export type TrackingToMainMessage =
  | (MessageBase & { kind: 'ready' })
  | (MessageBase & { kind: 'frameResult'; result: TrackingFrameResult })
  | (MessageBase & { kind: 'error'; message: string })
  | (MessageBase & { kind: 'disposed' });

/** Messages sent from the main thread to the signal worker. */
export type MainToSignalMessage =
  | (MessageBase & { kind: 'init' })
  | (MessageBase & { kind: 'frameResult'; result: TrackingFrameResult })
  | (MessageBase & { kind: 'dispose' });

/** Messages sent from the signal worker back to the main thread. */
export type SignalToMainMessage =
  | (MessageBase & { kind: 'ready' })
  | (MessageBase & { kind: 'frameAcked' })
  | (MessageBase & { kind: 'error'; message: string })
  | (MessageBase & { kind: 'disposed' });

/** Helper: type guard verifying a value looks like one of our messages. */
export function hasPageTimestamp(value: unknown): value is MessageBase {
  if (typeof value !== 'object' || value === null) return false;
  if (!('pageTimestampMs' in value)) return false;
  return typeof value.pageTimestampMs === 'number';
}
