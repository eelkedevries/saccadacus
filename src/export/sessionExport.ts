/**
 * Session export assembly (PROPOSAL.md §13, §14).
 *
 * Turns the aligned ring-buffer signals, detected events, and dot-task records
 * into `CombinedRow`s and then a single CSV. Continuous signals are read
 * directly from ring buffers; only derived values are exported (no raw
 * landmarks). Export is local/browser-side only (hard rule, §29).
 */
import type {
  BlinkEvent,
  EyeSelectionMode,
  SaccadeEvent,
  TrackingMode,
} from '../tracking/TrackingBackend';
import { RingBuffer } from '../signals/ringBuffer';
import { HeadChannel, SignalChannel } from '../signals/signalPipeline';
import type { DotRecord } from '../tasks/followTheDots/followTheDotsController';
import { applyGazeMap } from '../tasks/gazeMapping/fitGazeMap';
import type { GazeVariantModel } from '../tasks/gazeMapping/gazeMappingService';
import { buildCombinedCsv } from './combinedCsv';
import type { CombinedRow } from './schema';

export interface TimeseriesSample {
  timestampPerformanceNow: number;
  leftEyeXLocal: number;
  leftEyeYLocal: number;
  rightEyeXLocal: number;
  rightEyeYLocal: number;
  binocularXLocal: number;
  binocularYLocal: number;
  leftEyeReliability: number;
  rightEyeReliability: number;
  headYaw?: number;
  headPitch?: number;
  headRoll?: number;
}

export interface CameraActualSettingsLite {
  widthPx?: number;
  heightPx?: number;
  frameRateHz?: number;
}

export interface SessionExportInput {
  timeseries: TimeseriesSample[];
  saccades: SaccadeEvent[];
  blinks: BlinkEvent[];
  dots: DotRecord[];
  trackingMode: TrackingMode;
  eyeSelectionMode: EyeSelectionMode;
  camera?: CameraActualSettingsLite;
  /** When gaze mapping is available, the active variant used to map each row. */
  gaze?: GazeVariantModel;
}

/**
 * Extract aligned time-series samples from the signal and head ring buffers,
 * matching head pose to each signal timestamp.
 */
export function extractTimeseries(
  signalBuffer: RingBuffer,
  headBuffer: RingBuffer,
): TimeseriesSample[] {
  const ts = signalBuffer.timestampsOrdered();
  const leftX = signalBuffer.channelOrdered(SignalChannel.LeftX);
  const leftY = signalBuffer.channelOrdered(SignalChannel.LeftY);
  const rightX = signalBuffer.channelOrdered(SignalChannel.RightX);
  const rightY = signalBuffer.channelOrdered(SignalChannel.RightY);
  const binoX = signalBuffer.channelOrdered(SignalChannel.BinocularX);
  const binoY = signalBuffer.channelOrdered(SignalChannel.BinocularY);
  const leftRel = signalBuffer.channelOrdered(SignalChannel.LeftReliability);
  const rightRel = signalBuffer.channelOrdered(SignalChannel.RightReliability);

  const headTs = headBuffer.timestampsOrdered();
  const yaw = headBuffer.channelOrdered(HeadChannel.Yaw);
  const pitch = headBuffer.channelOrdered(HeadChannel.Pitch);
  const roll = headBuffer.channelOrdered(HeadChannel.Roll);
  const headByTs = new Map<number, { yaw: number; pitch: number; roll: number }>();
  for (let i = 0; i < headTs.length; i++) {
    headByTs.set(headTs[i] as number, {
      yaw: yaw[i] as number,
      pitch: pitch[i] as number,
      roll: roll[i] as number,
    });
  }

  const out: TimeseriesSample[] = [];
  for (let i = 0; i < ts.length; i++) {
    const t = ts[i] as number;
    const head = headByTs.get(t);
    out.push({
      timestampPerformanceNow: t,
      leftEyeXLocal: leftX[i] as number,
      leftEyeYLocal: leftY[i] as number,
      rightEyeXLocal: rightX[i] as number,
      rightEyeYLocal: rightY[i] as number,
      binocularXLocal: binoX[i] as number,
      binocularYLocal: binoY[i] as number,
      leftEyeReliability: leftRel[i] as number,
      rightEyeReliability: rightRel[i] as number,
      ...(head ? { headYaw: head.yaw, headPitch: head.pitch, headRoll: head.roll } : {}),
    });
  }
  return out;
}

/** Assemble all rows and render the single combined CSV. */
export function buildSessionCsv(input: SessionExportInput): string {
  return buildCombinedCsv(toCombinedRows(input));
}

export function toCombinedRows(input: SessionExportInput): CombinedRow[] {
  const rows: CombinedRow[] = [];
  const camera = input.camera;

  for (const s of input.timeseries) {
    rows.push({
      rowType: 'timeseries',
      timestampPerformanceNow: s.timestampPerformanceNow,
      trackingMode: input.trackingMode,
      eyeSelectionMode: input.eyeSelectionMode,
      leftEyeXLocal: s.leftEyeXLocal,
      leftEyeYLocal: s.leftEyeYLocal,
      rightEyeXLocal: s.rightEyeXLocal,
      rightEyeYLocal: s.rightEyeYLocal,
      binocularXLocal: s.binocularXLocal,
      binocularYLocal: s.binocularYLocal,
      leftEyeReliability: s.leftEyeReliability,
      rightEyeReliability: s.rightEyeReliability,
      ...(s.headYaw !== undefined ? { headYaw: s.headYaw } : {}),
      ...(s.headPitch !== undefined ? { headPitch: s.headPitch } : {}),
      ...(s.headRoll !== undefined ? { headRoll: s.headRoll } : {}),
      ...gazeFields(input.gaze, s),
      ...cameraFields(camera),
    });
  }

  for (const e of input.saccades) {
    rows.push({
      rowType: 'event',
      timestampPerformanceNow: e.onsetMs,
      trackingMode: input.trackingMode,
      eyeSelectionMode: e.eyeSelectionMode,
      eventType: 'saccade',
      eventOnset: e.onsetMs,
      eventOffset: e.offsetMs,
      eventDuration: e.durationMs,
      eventDirection: e.direction,
      eventRelativeAmplitude: e.relativeAmplitude,
      eventConfidence: e.confidence,
      eventHeadMotionLabel: e.headMotionLabel,
    });
  }

  for (const b of input.blinks) {
    rows.push({
      rowType: 'event',
      timestampPerformanceNow: b.onsetMs,
      trackingMode: input.trackingMode,
      eyeSelectionMode: input.eyeSelectionMode,
      eventType: 'blink',
      eventOnset: b.onsetMs,
      eventOffset: b.offsetMs,
      eventDuration: b.durationMs,
      eventConfidence: b.confidence,
    });
  }

  for (const d of input.dots) {
    rows.push({
      rowType: 'dot',
      timestampPerformanceNow: d.onsetMs,
      trackingMode: d.trackingMode,
      eyeSelectionMode: d.eyeSelectionMode,
      dotX: d.xScreen,
      dotY: d.yScreen,
      dotTimestamp: d.onsetMs,
    });
  }

  return rows;
}

function gazeFields(
  gaze: GazeVariantModel | undefined,
  sample: TimeseriesSample,
): Partial<CombinedRow> {
  if (!gaze || gaze.model.reliability <= 0) return {};
  const local =
    gaze.eye === 'left'
      ? { x: sample.leftEyeXLocal, y: sample.leftEyeYLocal }
      : gaze.eye === 'right'
        ? { x: sample.rightEyeXLocal, y: sample.rightEyeYLocal }
        : { x: sample.binocularXLocal, y: sample.binocularYLocal };
  const mapped = applyGazeMap(gaze.model, {
    xLocal: local.x,
    yLocal: local.y,
    yawDeg: sample.headYaw ?? 0,
    pitchDeg: sample.headPitch ?? 0,
  });
  return {
    gazeXMapped: mapped.x,
    gazeYMapped: mapped.y,
    gazeMappingId: gaze.id,
    gazeMappingReliability: gaze.model.reliability,
  };
}

function cameraFields(camera: CameraActualSettingsLite | undefined): Partial<CombinedRow> {
  if (!camera) return {};
  return {
    ...(camera.widthPx !== undefined ? { cameraActualWidthPx: camera.widthPx } : {}),
    ...(camera.heightPx !== undefined ? { cameraActualHeightPx: camera.heightPx } : {}),
    ...(camera.frameRateHz !== undefined ? { cameraActualFrameRateHz: camera.frameRateHz } : {}),
  };
}
