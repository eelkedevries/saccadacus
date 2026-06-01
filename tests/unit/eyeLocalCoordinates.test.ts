import { describe, expect, it } from 'vitest';
import { projectEyeLocal } from '../../src/signals/eyeLocalCoordinates';

const horizontalEye = {
  leftCorner: { x: -1, y: 0 },
  rightCorner: { x: 1, y: 0 },
};

describe('projectEyeLocal', () => {
  it('returns zero at the eye-corner midpoint', () => {
    const p = projectEyeLocal(horizontalEye, { x: 0, y: 0 });
    expect(p.xLocal).toBeCloseTo(0);
    expect(p.yLocal).toBeCloseTo(0);
  });

  it('maps rightward feature movement to positive xLocal (participant right)', () => {
    const p = projectEyeLocal(horizontalEye, { x: 0.5, y: 0 });
    expect(p.xLocal).toBeCloseTo(0.25); // 0.5 over an eye width of 2
    expect(p.yLocal).toBeCloseTo(0);
  });

  it('maps leftward feature movement to negative xLocal', () => {
    const p = projectEyeLocal(horizontalEye, { x: -0.5, y: 0 });
    expect(p.xLocal).toBeCloseTo(-0.25);
  });

  it('maps upward feature movement to positive yLocal', () => {
    const p = projectEyeLocal(horizontalEye, { x: 0, y: 0.5 });
    expect(p.yLocal).toBeCloseTo(0.25);
  });

  it('normalises by eye width', () => {
    const wide = { leftCorner: { x: -2, y: 0 }, rightCorner: { x: 2, y: 0 } };
    const p = projectEyeLocal(wide, { x: 1, y: 0 });
    expect(p.xLocal).toBeCloseTo(0.25); // 1 over an eye width of 4
  });

  it('honours a rotated (tilted) eye axis', () => {
    // Corners on a 45-degree axis; a feature along that axis is purely +x.
    const tilted = {
      leftCorner: { x: -1, y: -1 },
      rightCorner: { x: 1, y: 1 },
    };
    const along = projectEyeLocal(tilted, { x: 0.5, y: 0.5 });
    expect(along.yLocal).toBeCloseTo(0);
    expect(along.xLocal).toBeGreaterThan(0);
  });

  it('returns zero for a degenerate eye (coincident corners)', () => {
    const p = projectEyeLocal(
      { leftCorner: { x: 1, y: 1 }, rightCorner: { x: 1, y: 1 } },
      { x: 2, y: 2 },
    );
    expect(p.xLocal).toBe(0);
    expect(p.yLocal).toBe(0);
  });
});
