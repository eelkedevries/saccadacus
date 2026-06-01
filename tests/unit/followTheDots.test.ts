import { describe, expect, it } from 'vitest';
import { FollowTheDotsController } from '../../src/tasks/followTheDots/followTheDotsController';

function makeController(): FollowTheDotsController {
  // Deterministic RNG cycling through fixed values.
  const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8];
  let i = 0;
  const rng = (): number => {
    const v = values[i % values.length] as number;
    i += 1;
    return v;
  };
  return new FollowTheDotsController({
    trackingMode: 'iris',
    eyeSelectionMode: 'binocular',
    rng,
    margin: 0,
  });
}

describe('FollowTheDotsController', () => {
  it('places the first dot on start', () => {
    const c = makeController();
    c.start(1000, 0.9);
    expect(c.isRunning()).toBe(true);
    const dot = c.current();
    expect(dot?.onsetMs).toBe(1000);
    expect(dot?.xScreen).toBeCloseTo(0.1);
    expect(dot?.yScreen).toBeCloseTo(0.2);
    expect(dot?.reliabilityAtOnset).toBe(0.9);
  });

  it('closes the previous dot and opens a new one on advance', () => {
    const c = makeController();
    c.start(1000, 0.9);
    c.advance(2000, 0.8);
    const dots = c.getDots();
    expect(dots).toHaveLength(2);
    expect(dots[0]!.offsetMs).toBe(2000);
    expect(dots[1]!.onsetMs).toBe(2000);
    expect(dots[1]!.offsetMs).toBeUndefined();
  });

  it('records dots and stops cleanly', () => {
    const c = makeController();
    c.start(0, 0.5);
    c.advance(1000, 0.5);
    c.advance(2000, 0.5);
    c.stop(3000);
    expect(c.isRunning()).toBe(false);
    const dots = c.getDots();
    expect(dots).toHaveLength(3);
    expect(dots.every((d) => d.offsetMs !== undefined)).toBe(true);
  });

  it('uses the same clock for dot events as the tracking data', () => {
    const c = makeController();
    c.start(500, 0.7);
    c.advance(1700, 0.7);
    c.stop(2900);
    const events = c.toDotEvents();
    expect(events[0]!.onsetMs).toBe(500);
    expect(events[0]!.offsetMs).toBe(1700);
    expect(events[1]!.onsetMs).toBe(1700);
    expect(events[1]!.offsetMs).toBe(2900);
  });

  it('keeps dot positions within the margin', () => {
    const c = new FollowTheDotsController({
      trackingMode: 'iris',
      eyeSelectionMode: 'binocular',
      rng: () => 0, // would place at the margin
      margin: 0.1,
    });
    c.start(0, 1);
    const dot = c.current()!;
    expect(dot.xScreen).toBeCloseTo(0.1);
    expect(dot.yScreen).toBeCloseTo(0.1);
  });
});
