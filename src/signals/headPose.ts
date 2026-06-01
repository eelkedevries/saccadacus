/**
 * Head-pose matrix decomposition (PROPOSAL.md §6).
 *
 * A rotation matrix is decomposed into yaw (about the vertical Y axis), pitch
 * (about the lateral X axis), and roll (about the forward Z axis), in degrees.
 * The composition convention is intrinsic R = Ry(yaw) * Rx(pitch) * Rz(roll),
 * matching how `buildRotation` assembles a matrix, so the two round-trip.
 *
 * gl-matrix is used to normalise a 4x4 input to its 3x3 rotation block.
 */
import { mat3 } from 'gl-matrix';
import type { HeadPoseResult } from '../tracking/TrackingBackend';

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export interface HeadPoseMatrixInput {
  /** Column-major rotation matrix: length 9 (mat3) or 16 (mat4). */
  matrix: ReadonlyArray<number>;
  translation?: { x: number; y: number; z: number };
  reliability: number;
}

/** Read a column-major 3x3 element at (row, col). */
function at(m: ArrayLike<number>, row: number, col: number): number {
  return m[col * 3 + row] as number;
}

/**
 * Decompose a rotation matrix into yaw/pitch/roll degrees and carry translation
 * and reliability through unchanged.
 */
export function decomposeHeadPose(input: HeadPoseMatrixInput): HeadPoseResult {
  const r = mat3.create();
  if (input.matrix.length === 16) {
    mat3.fromMat4(r, [...input.matrix]);
  } else if (input.matrix.length === 9) {
    for (let i = 0; i < 9; i++) {
      r[i] = input.matrix[i] as number;
    }
  } else {
    throw new Error(`Head-pose matrix must have 9 or 16 elements, received ${input.matrix.length}`);
  }

  // For R = Ry*Rx*Rz: m12 = -sin(pitch), m10 = cos(pitch)sin(roll),
  // m11 = cos(pitch)cos(roll), m02 = sin(yaw)cos(pitch), m22 = cos(yaw)cos(pitch).
  const m12 = at(r, 1, 2);
  const m10 = at(r, 1, 0);
  const m11 = at(r, 1, 1);
  const m02 = at(r, 0, 2);
  const m22 = at(r, 2, 2);

  const pitch = Math.asin(clampUnit(-m12));
  const roll = Math.atan2(m10, m11);
  const yaw = Math.atan2(m02, m22);

  return {
    yawDeg: yaw * RAD_TO_DEG,
    pitchDeg: pitch * RAD_TO_DEG,
    rollDeg: roll * RAD_TO_DEG,
    ...(input.translation
      ? {
          translationX: input.translation.x,
          translationY: input.translation.y,
          translationZ: input.translation.z,
        }
      : {}),
    reliability: input.reliability,
  };
}

/**
 * Build a column-major 3x3 rotation matrix from yaw/pitch/roll degrees using
 * the same R = Ry*Rx*Rz convention. Useful for tests and synthetic data.
 */
export function buildRotation(yawDeg: number, pitchDeg: number, rollDeg: number): number[] {
  const y = yawDeg * DEG_TO_RAD;
  const p = pitchDeg * DEG_TO_RAD;
  const r = rollDeg * DEG_TO_RAD;
  const cy = Math.cos(y);
  const sy = Math.sin(y);
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  const cr = Math.cos(r);
  const sr = Math.sin(r);

  // Row-major entries of R = Ry*Rx*Rz.
  const rows = [
    [cy * cr + sy * sp * sr, -cy * sr + sy * sp * cr, sy * cp],
    [cp * sr, cp * cr, -sp],
    [-sy * cr + cy * sp * sr, sy * sr + cy * sp * cr, cy * cp],
  ];

  // Emit column-major.
  const out: number[] = new Array<number>(9);
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      out[col * 3 + row] = rows[row]![col]!;
    }
  }
  return out;
}

function clampUnit(value: number): number {
  return value < -1 ? -1 : value > 1 ? 1 : value;
}
