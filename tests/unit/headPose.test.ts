import { describe, expect, it } from 'vitest';
import { mat4 } from 'gl-matrix';
import { buildRotation, decomposeHeadPose } from '../../src/signals/headPose';

describe('decomposeHeadPose', () => {
  it('round-trips yaw/pitch/roll through a 3x3 matrix', () => {
    const cases = [
      [0, 0, 0],
      [10, 5, -7],
      [-20, 12, 30],
      [45, -15, 0],
    ];
    for (const [yaw, pitch, roll] of cases) {
      const matrix = buildRotation(yaw!, pitch!, roll!);
      const pose = decomposeHeadPose({ matrix, reliability: 1 });
      expect(pose.yawDeg).toBeCloseTo(yaw!, 4);
      expect(pose.pitchDeg).toBeCloseTo(pitch!, 4);
      expect(pose.rollDeg).toBeCloseTo(roll!, 4);
    }
  });

  it('decomposes a gl-matrix 4x4 built as Ry*Rx*Rz', () => {
    const yaw = 18;
    const pitch = -9;
    const roll = 22;
    const m = mat4.create();
    mat4.rotateY(m, m, (yaw * Math.PI) / 180);
    mat4.rotateX(m, m, (pitch * Math.PI) / 180);
    mat4.rotateZ(m, m, (roll * Math.PI) / 180);
    const pose = decomposeHeadPose({ matrix: Array.from(m), reliability: 0.8 });
    expect(pose.yawDeg).toBeCloseTo(yaw, 3);
    expect(pose.pitchDeg).toBeCloseTo(pitch, 3);
    expect(pose.rollDeg).toBeCloseTo(roll, 3);
  });

  it('carries translation and reliability through', () => {
    const pose = decomposeHeadPose({
      matrix: buildRotation(0, 0, 0),
      translation: { x: 1, y: 2, z: 3 },
      reliability: 0.42,
    });
    expect(pose.translationX).toBe(1);
    expect(pose.translationY).toBe(2);
    expect(pose.translationZ).toBe(3);
    expect(pose.reliability).toBe(0.42);
  });

  it('rejects a matrix with the wrong length', () => {
    expect(() => decomposeHeadPose({ matrix: [1, 2, 3], reliability: 1 })).toThrow();
  });
});
