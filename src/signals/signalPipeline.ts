/**
 * Signal pipeline: converts `TrackingFrameResult`s into the aligned continuous
 * signals and writes them into ring buffers (PROPOSAL.md §13, §21, §22).
 *
 * This runs in the signal worker. It owns the ring buffers; continuous signals
 * live here and never in a reactive store. The rendering layer and the exporter
 * read these buffers directly.
 */
import type { TrackingFrameResult } from '../tracking/TrackingBackend';
import { RingBuffer } from './ringBuffer';
import { eyeLocalSpeed } from './velocity';
import { combineBinocular } from './reliability';

/** Channel order of the eye-local signal ring buffer. */
export enum SignalChannel {
  LeftX = 0,
  LeftY = 1,
  RightX = 2,
  RightY = 3,
  BinocularX = 4,
  BinocularY = 5,
  LeftSpeed = 6,
  RightSpeed = 7,
  LeftReliability = 8,
  RightReliability = 9,
}

export const SIGNAL_CHANNEL_COUNT = 10;

/** Channel order of the head-pose ring buffer. */
export enum HeadChannel {
  Yaw = 0,
  Pitch = 1,
  Roll = 2,
}

export const HEAD_CHANNEL_COUNT = 3;

interface EyePrevious {
  x: number;
  y: number;
  tsMs: number;
  valid: boolean;
}

export interface SignalPipelineSummary {
  tsMs: number;
  leftReliability: number;
  rightReliability: number;
  faceReliability: number;
}

export class SignalPipeline {
  readonly signalBuffer: RingBuffer;
  readonly headBuffer: RingBuffer;

  private prevLeft: EyePrevious = { x: 0, y: 0, tsMs: 0, valid: false };
  private prevRight: EyePrevious = { x: 0, y: 0, tsMs: 0, valid: false };

  constructor(capacity = 3600) {
    this.signalBuffer = new RingBuffer(capacity, SIGNAL_CHANNEL_COUNT);
    this.headBuffer = new RingBuffer(capacity, HEAD_CHANNEL_COUNT);
  }

  /**
   * Ingest one frame result. Writes one aligned sample to each ring buffer
   * (keyed on `pageTimestampMs`) and returns a small scalar summary suitable
   * for the throttled UI store. Returns `undefined` for dropped frames with no
   * eye data, after still recording a head-pose sample if present.
   */
  ingest(result: TrackingFrameResult): SignalPipelineSummary | undefined {
    const tsMs = result.pageTimestampMs;

    const left = result.leftEye?.irisCentre ?? result.leftEye?.pupilCentre;
    const right = result.rightEye?.irisCentre ?? result.rightEye?.pupilCentre;
    const leftReliability = result.leftEye?.selectedReliability ?? 0;
    const rightReliability = result.rightEye?.selectedReliability ?? 0;

    const leftX = left?.xLocal ?? 0;
    const leftY = left?.yLocal ?? 0;
    const rightX = right?.xLocal ?? 0;
    const rightY = right?.yLocal ?? 0;

    const leftSpeed = this.prevLeft.valid
      ? eyeLocalSpeed(this.prevLeft.x, this.prevLeft.y, this.prevLeft.tsMs, leftX, leftY, tsMs)
      : 0;
    const rightSpeed = this.prevRight.valid
      ? eyeLocalSpeed(this.prevRight.x, this.prevRight.y, this.prevRight.tsMs, rightX, rightY, tsMs)
      : 0;

    const binocularX = combineBinocular(leftX, leftReliability, rightX, rightReliability);
    const binocularY = combineBinocular(leftY, leftReliability, rightY, rightReliability);

    const sample = new Float32Array(SIGNAL_CHANNEL_COUNT);
    sample[SignalChannel.LeftX] = leftX;
    sample[SignalChannel.LeftY] = leftY;
    sample[SignalChannel.RightX] = rightX;
    sample[SignalChannel.RightY] = rightY;
    sample[SignalChannel.BinocularX] = binocularX;
    sample[SignalChannel.BinocularY] = binocularY;
    sample[SignalChannel.LeftSpeed] = leftSpeed;
    sample[SignalChannel.RightSpeed] = rightSpeed;
    sample[SignalChannel.LeftReliability] = leftReliability;
    sample[SignalChannel.RightReliability] = rightReliability;
    this.signalBuffer.push(tsMs, sample);

    if (result.headPose) {
      const head = new Float32Array(HEAD_CHANNEL_COUNT);
      head[HeadChannel.Yaw] = result.headPose.yawDeg;
      head[HeadChannel.Pitch] = result.headPose.pitchDeg;
      head[HeadChannel.Roll] = result.headPose.rollDeg;
      this.headBuffer.push(tsMs, head);
    }

    this.prevLeft = { x: leftX, y: leftY, tsMs, valid: left !== undefined };
    this.prevRight = { x: rightX, y: rightY, tsMs, valid: right !== undefined };

    if (left === undefined && right === undefined) {
      return undefined;
    }
    return { tsMs, leftReliability, rightReliability, faceReliability: result.faceReliability };
  }

  reset(): void {
    this.signalBuffer.clear();
    this.headBuffer.clear();
    this.prevLeft = { x: 0, y: 0, tsMs: 0, valid: false };
    this.prevRight = { x: 0, y: 0, tsMs: 0, valid: false };
  }
}
