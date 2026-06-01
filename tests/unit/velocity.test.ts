import { describe, expect, it } from 'vitest';
import { eyeLocalSpeed, velocitySeries } from '../../src/signals/velocity';

describe('eyeLocalSpeed', () => {
  it('computes 2D speed in units per second', () => {
    // displacement (3,4) = 5 units over 1000 ms = 5 units/s
    expect(eyeLocalSpeed(0, 0, 0, 3, 4, 1000)).toBeCloseTo(5);
  });

  it('scales with the time interval', () => {
    // same displacement over 500 ms = 10 units/s
    expect(eyeLocalSpeed(0, 0, 0, 3, 4, 500)).toBeCloseTo(10);
  });

  it('returns 0 for non-positive time intervals', () => {
    expect(eyeLocalSpeed(0, 0, 100, 3, 4, 100)).toBe(0);
    expect(eyeLocalSpeed(0, 0, 100, 3, 4, 50)).toBe(0);
  });
});

describe('velocitySeries', () => {
  it('produces a zero first sample and backward differences thereafter', () => {
    const xs = [0, 1, 2];
    const ys = [0, 0, 0];
    const ts = [0, 1000, 2000];
    const v = velocitySeries(xs, ys, ts);
    expect(v[0]).toBe(0);
    expect(v[1]).toBeCloseTo(1);
    expect(v[2]).toBeCloseTo(1);
  });

  it('rejects mismatched input lengths', () => {
    expect(() => velocitySeries([0, 1], [0], [0, 1])).toThrow();
  });
});
