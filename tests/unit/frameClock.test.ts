import { describe, expect, it, vi } from 'vitest';
import { FrameClock } from '../../src/camera/frameClock';
import type { FrameClockDeps, FrameTick } from '../../src/camera/frameClock';

interface FakeDeps extends FrameClockDeps {
  /** Manually drive the next scheduled tick. */
  fireScheduler: () => void;
  /** Manually fire the registered rVFC callback, if any. */
  fireRvfc: (mediaTimeMs: number) => void;
}

function makeFakeDeps(rvfcAvailable: boolean): FakeDeps {
  let pendingScheduler: (() => void) | null = null;
  let pendingRvfc: ((mediaTimeMs: number) => void) | null = null;
  let nowMs = 0;
  const deps: FakeDeps = {
    now: () => {
      nowMs += 16;
      return nowMs;
    },
    schedule: (cb) => {
      pendingScheduler = cb;
      return 1;
    },
    cancel: () => {
      pendingScheduler = null;
    },
    rvfcAvailable,
    registerRvfc: rvfcAvailable
      ? (onMeta) => {
          pendingRvfc = onMeta;
        }
      : null,
    fireScheduler: () => {
      const cb = pendingScheduler;
      pendingScheduler = null;
      cb?.();
    },
    fireRvfc: (mediaTimeMs) => {
      const cb = pendingRvfc;
      pendingRvfc = null;
      cb?.(mediaTimeMs);
    },
  };
  return deps;
}

describe('FrameClock', () => {
  it('reports the scheduler as the pacing source, never rVFC', () => {
    const deps = makeFakeDeps(true);
    const clock = new FrameClock(deps, () => {});
    clock.start();
    expect(clock.pacingSource()).toBe('scheduler');
    expect(clock.rvfcEnabled()).toBe(true);
    clock.stop();
  });

  it('rVFC callbacks alone never produce ticks', () => {
    const deps = makeFakeDeps(true);
    const ticks: FrameTick[] = [];
    const clock = new FrameClock(deps, (t) => ticks.push(t));
    clock.start();
    // Fire rVFC five times without any scheduler tick.
    for (let i = 0; i < 5; i++) {
      deps.fireRvfc(i * 100);
    }
    expect(ticks).toHaveLength(0);
    clock.stop();
  });

  it('pacing comes from the scheduler', () => {
    const deps = makeFakeDeps(false);
    const ticks: FrameTick[] = [];
    const clock = new FrameClock(deps, (t) => ticks.push(t));
    clock.start();
    deps.fireScheduler();
    deps.fireScheduler();
    deps.fireScheduler();
    expect(ticks).toHaveLength(3);
    expect(ticks.every((t) => typeof t.pageTimestampMs === 'number')).toBe(true);
    clock.stop();
  });

  it('omits videoMediaTimeMs when rVFC is unavailable', () => {
    const deps = makeFakeDeps(false);
    const ticks: FrameTick[] = [];
    const clock = new FrameClock(deps, (t) => ticks.push(t));
    clock.start();
    deps.fireScheduler();
    expect(ticks[0]?.videoMediaTimeMs).toBeUndefined();
    expect(clock.rvfcEnabled()).toBe(false);
    clock.stop();
  });

  it('forwards mediaTime captured between scheduler ticks into the next tick', () => {
    const deps = makeFakeDeps(true);
    const ticks: FrameTick[] = [];
    const clock = new FrameClock(deps, (t) => ticks.push(t));
    clock.start();
    // First tick: no metadata yet.
    deps.fireScheduler();
    // rVFC reports mediaTime=42 ms before the next scheduled tick.
    deps.fireRvfc(42);
    deps.fireScheduler();
    // Subsequent tick: no fresh metadata → undefined again.
    deps.fireScheduler();
    expect(ticks[0]?.videoMediaTimeMs).toBeUndefined();
    expect(ticks[1]?.videoMediaTimeMs).toBe(42);
    expect(ticks[2]?.videoMediaTimeMs).toBeUndefined();
    clock.stop();
  });

  it('stop() cancels the pending scheduler tick and stops emitting', () => {
    const deps = makeFakeDeps(false);
    const cancelSpy = vi.spyOn(deps, 'cancel');
    const ticks: FrameTick[] = [];
    const clock = new FrameClock(deps, (t) => ticks.push(t));
    clock.start();
    deps.fireScheduler();
    clock.stop();
    expect(cancelSpy).toHaveBeenCalled();
    // After stop, even if a stray scheduler callback fires, no tick is emitted.
    deps.fireScheduler();
    expect(ticks).toHaveLength(1);
  });
});
