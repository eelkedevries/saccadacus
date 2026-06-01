import { describe, expect, it } from 'vitest';
import {
  HeadChannel,
  SignalChannel,
  SignalPipeline,
} from '../../src/signals/signalPipeline';
import type { TrackingFrameResult } from '../../src/tracking/TrackingBackend';

function frame(
  tsMs: number,
  leftX: number,
  rightX: number,
  overrides: Partial<TrackingFrameResult> = {},
): TrackingFrameResult {
  return {
    pageTimestampMs: tsMs,
    faceReliability: 0.9,
    leftEye: {
      irisCentre: { xLocal: leftX, yLocal: 0, reliability: 0.8 },
      selected: 'iris',
      selectedReliability: 0.8,
      blinkState: 'open',
    },
    rightEye: {
      irisCentre: { xLocal: rightX, yLocal: 0, reliability: 0.6 },
      selected: 'iris',
      selectedReliability: 0.6,
      blinkState: 'open',
    },
    headPose: { yawDeg: 1, pitchDeg: 2, rollDeg: 3, reliability: 0.9 },
    ...overrides,
  };
}

describe('SignalPipeline', () => {
  it('writes aligned eye-local samples into the ring buffer', () => {
    const p = new SignalPipeline(16);
    p.ingest(frame(0, 0.1, 0.2));
    p.ingest(frame(1000, 0.3, 0.4));

    expect(p.signalBuffer.length).toBe(2);
    expect(Array.from(p.signalBuffer.channelOrdered(SignalChannel.LeftX))).toEqual([
      expect.closeTo(0.1, 5),
      expect.closeTo(0.3, 5),
    ]);
    expect(Array.from(p.signalBuffer.channelOrdered(SignalChannel.RightX))).toEqual([
      expect.closeTo(0.2, 5),
      expect.closeTo(0.4, 5),
    ]);
    expect(Array.from(p.signalBuffer.timestampsOrdered())).toEqual([0, 1000]);
  });

  it('computes zero speed on the first sample and a finite speed thereafter', () => {
    const p = new SignalPipeline(16);
    p.ingest(frame(0, 0, 0));
    p.ingest(frame(1000, 1, 0)); // left moves 1 unit in 1 s
    const speeds = Array.from(p.signalBuffer.channelOrdered(SignalChannel.LeftSpeed));
    expect(speeds[0]).toBe(0);
    expect(speeds[1]).toBeCloseTo(1, 5);
  });

  it('writes a reliability-weighted binocular channel', () => {
    const p = new SignalPipeline(16);
    p.ingest(frame(0, 0, 1)); // left rel 0.8, right rel 0.6
    const binoX = p.signalBuffer.channelOrdered(SignalChannel.BinocularX)[0] ?? 0;
    // weighted: (0*0.8 + 1*0.6)/1.4 ≈ 0.4286
    expect(binoX).toBeCloseTo(0.6 / 1.4, 4);
  });

  it('records head pose into the head buffer', () => {
    const p = new SignalPipeline(16);
    p.ingest(frame(0, 0, 0));
    expect(p.headBuffer.length).toBe(1);
    expect(p.headBuffer.channelOrdered(HeadChannel.Yaw)[0]).toBeCloseTo(1);
    expect(p.headBuffer.channelOrdered(HeadChannel.Pitch)[0]).toBeCloseTo(2);
    expect(p.headBuffer.channelOrdered(HeadChannel.Roll)[0]).toBeCloseTo(3);
  });

  it('returns undefined for a dropped frame but still records head pose', () => {
    const p = new SignalPipeline(16);
    const dropped: TrackingFrameResult = {
      pageTimestampMs: 5,
      faceReliability: 0.05,
      headPose: { yawDeg: 4, pitchDeg: 0, rollDeg: 0, reliability: 0.5 },
    };
    const summary = p.ingest(dropped);
    expect(summary).toBeUndefined();
    expect(p.headBuffer.length).toBe(1);
  });

  it('returns a scalar summary for a valid frame', () => {
    const p = new SignalPipeline(16);
    const summary = p.ingest(frame(0, 0, 0));
    expect(summary).toEqual({
      tsMs: 0,
      leftReliability: 0.8,
      rightReliability: 0.6,
      faceReliability: 0.9,
    });
  });

  it('reset clears the buffers and the velocity history', () => {
    const p = new SignalPipeline(16);
    p.ingest(frame(0, 0, 0));
    p.ingest(frame(1000, 1, 1));
    p.reset();
    expect(p.signalBuffer.length).toBe(0);
    expect(p.headBuffer.length).toBe(0);
    p.ingest(frame(0, 0, 0));
    expect(p.signalBuffer.channelOrdered(SignalChannel.LeftSpeed)[0]).toBe(0);
  });
});
