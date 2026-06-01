/**
 * Session timeseries extraction (PROPOSAL.md §13).
 *
 * Reads aligned eye-local and head-pose samples from the ring buffers and
 * returns them as plain objects. The CSV builders in `outputs.ts` consume this
 * structure to produce the primary and secondary output files.
 */
import { RingBuffer } from '../signals/ringBuffer';
import { HeadChannel, SignalChannel } from '../signals/signalPipeline';

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
