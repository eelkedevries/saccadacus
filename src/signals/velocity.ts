/**
 * Eye-local velocity computation (PROPOSAL.md §9, §22).
 *
 * Velocity is the time derivative of the eye-local position signal, expressed
 * in eye-width units per second. All functions are pure and take their inputs
 * explicitly so they stay trivially testable.
 */

/**
 * Instantaneous 2D speed between two samples, in units per second.
 * Returns 0 when the timestamps coincide.
 */
export function eyeLocalSpeed(
  prevX: number,
  prevY: number,
  prevTsMs: number,
  x: number,
  y: number,
  tsMs: number,
): number {
  const dtMs = tsMs - prevTsMs;
  if (dtMs <= 0) {
    return 0;
  }
  const dx = x - prevX;
  const dy = y - prevY;
  return (Math.hypot(dx, dy) / dtMs) * 1000;
}

/**
 * Per-sample speed series from a 2D position series. Uses backward differences;
 * the first sample's speed is 0. `xs`, `ys`, and `tsMs` must be equal length.
 */
export function velocitySeries(
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  tsMs: ArrayLike<number>,
): number[] {
  const n = xs.length;
  if (ys.length !== n || tsMs.length !== n) {
    throw new Error('velocitySeries requires xs, ys and tsMs of equal length');
  }
  const out = new Array<number>(n);
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      out[i] = 0;
      continue;
    }
    out[i] = eyeLocalSpeed(
      xs[i - 1] as number,
      ys[i - 1] as number,
      tsMs[i - 1] as number,
      xs[i] as number,
      ys[i] as number,
      tsMs[i] as number,
    );
  }
  return out;
}
