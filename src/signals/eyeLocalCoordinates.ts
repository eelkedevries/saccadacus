/**
 * Eye-local coordinate projection (PROPOSAL.md §3, §5).
 *
 * For each eye the two eye corners define a local frame:
 *   u = unit vector from the participant-left corner to the participant-right
 *       corner (so positive `xLocal` points to the participant's right, §5),
 *   v = u rotated 90 degrees so that positive `yLocal` points up.
 * The corner midpoint is the origin and the corner distance is the
 * normalisation factor, giving coordinates in eye-width units.
 *
 * Inputs are assumed to be in a y-up coordinate frame already expressed from
 * the participant's perspective. A backend adapter that receives image-space
 * landmarks (y-down, mirrored) is responsible for converting to this frame
 * before calling, so this function stays pure and sign-stable.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface EyeCorners {
  /** Corner toward the participant's left. */
  leftCorner: Point2D;
  /** Corner toward the participant's right. */
  rightCorner: Point2D;
}

export interface EyeLocalPoint {
  xLocal: number;
  yLocal: number;
}

/**
 * Project a feature point (iris or pupil centre) into the eye-local frame.
 * Returns `xLocal`/`yLocal` in eye-width units. When the two corners coincide
 * (degenerate eye) both coordinates are 0.
 */
export function projectEyeLocal(corners: EyeCorners, feature: Point2D): EyeLocalPoint {
  const ux = corners.rightCorner.x - corners.leftCorner.x;
  const uy = corners.rightCorner.y - corners.leftCorner.y;
  const eyeWidth = Math.hypot(ux, uy);
  if (eyeWidth === 0) {
    return { xLocal: 0, yLocal: 0 };
  }

  // Unit corner-to-corner axis (participant's right) and its upward normal.
  const uxn = ux / eyeWidth;
  const uyn = uy / eyeWidth;
  const vxn = -uyn;
  const vyn = uxn;

  const originX = (corners.leftCorner.x + corners.rightCorner.x) / 2;
  const originY = (corners.leftCorner.y + corners.rightCorner.y) / 2;
  const dx = feature.x - originX;
  const dy = feature.y - originY;

  return {
    xLocal: (dx * uxn + dy * uyn) / eyeWidth,
    yLocal: (dx * vxn + dy * vyn) / eyeWidth,
  };
}
