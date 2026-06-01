import { describe, expect, it } from 'vitest';
import { MockLiveSession } from '../../src/app/mockLiveSession';

const config = { frameWidth: 640, frameHeight: 480, seed: 7 };

describe('MockLiveSession', () => {
  it('throws if stepped before start', async () => {
    const session = new MockLiveSession();
    await expect(session.step(0)).rejects.toThrow();
  });

  it('writes pipeline samples as it steps and echoes pageTimestampMs', async () => {
    const session = new MockLiveSession();
    await session.start(config);
    const first = await session.step(100);
    const second = await session.step(133);
    expect(first.result.pageTimestampMs).toBe(100);
    expect(second.result.pageTimestampMs).toBe(133);
    expect(session.pipeline.signalBuffer.length).toBe(2);
  });

  it('produces a scalar summary for valid frames', async () => {
    const session = new MockLiveSession();
    await session.start(config);
    const { summary } = await session.step(0);
    expect(summary).toBeDefined();
    expect(summary?.faceReliability).toBeGreaterThan(0);
  });

  it('resets the pipeline on start', async () => {
    const session = new MockLiveSession();
    await session.start(config);
    await session.step(0);
    await session.start(config);
    expect(session.pipeline.signalBuffer.length).toBe(0);
  });
});
