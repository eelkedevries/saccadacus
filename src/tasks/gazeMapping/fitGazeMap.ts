/**
 * Gaze-mapping model fitting (PROPOSAL.md §12).
 *
 * Fits a linear model relating an eye-local signal and head pose to screen
 * position, using ordinary least squares (normal equations). The feature
 * vector is `[1, xLocal, yLocal, yawDeg, pitchDeg]`; separate coefficient
 * vectors map to screen x and screen y. Fit quality is reported as a
 * reliability scalar derived from R². All functions are pure.
 */

export interface GazeFeatures {
  xLocal: number;
  yLocal: number;
  yawDeg: number;
  pitchDeg: number;
}

export interface GazeSample {
  features: GazeFeatures;
  targetX: number;
  targetY: number;
}

export interface GazeMapModel {
  /** Coefficients for screen x and y over [1, xLocal, yLocal, yawDeg, pitchDeg]. */
  betaX: number[];
  betaY: number[];
  /** Combined fit quality in [0, 1] (mean R² of x and y). */
  reliability: number;
  rmse: number;
  sampleCount: number;
}

const FEATURE_LENGTH = 5;
// Small Tikhonov (ridge) term so the fit stays well-posed when a feature has
// no variance in the dot data (e.g. the head was held still, leaving yaw/pitch
// constant). Negligible for well-conditioned data.
const RIDGE = 1e-8;

export function featureVector(f: GazeFeatures): number[] {
  return [1, f.xLocal, f.yLocal, f.yawDeg, f.pitchDeg];
}

/** Fit a gaze map from samples. Returns a low-reliability model when underdetermined. */
export function fitGazeMap(samples: GazeSample[]): GazeMapModel {
  const n = samples.length;
  if (n < FEATURE_LENGTH) {
    return { betaX: zeros(FEATURE_LENGTH), betaY: zeros(FEATURE_LENGTH), reliability: 0, rmse: NaN, sampleCount: n };
  }

  const X = samples.map((s) => featureVector(s.features));
  const yx = samples.map((s) => s.targetX);
  const yy = samples.map((s) => s.targetY);

  const betaX = solveLeastSquares(X, yx);
  const betaY = solveLeastSquares(X, yy);
  if (!betaX || !betaY) {
    return { betaX: zeros(FEATURE_LENGTH), betaY: zeros(FEATURE_LENGTH), reliability: 0, rmse: NaN, sampleCount: n };
  }

  const r2x = rSquared(X, yx, betaX);
  const r2y = rSquared(X, yy, betaY);
  const rmse = Math.sqrt((sumSquaredResiduals(X, yx, betaX) + sumSquaredResiduals(X, yy, betaY)) / (2 * n));
  const reliability = clamp01((r2x + r2y) / 2);

  return { betaX, betaY, reliability, rmse, sampleCount: n };
}

/** Apply a fitted model to features, producing a screen position. */
export function applyGazeMap(model: GazeMapModel, features: GazeFeatures): { x: number; y: number } {
  const v = featureVector(features);
  return { x: dot(model.betaX, v), y: dot(model.betaY, v) };
}

// --- linear algebra (pure) ---

function solveLeastSquares(X: number[][], y: number[]): number[] | null {
  const p = (X[0] as number[]).length;
  const xtx: number[][] = Array.from({ length: p }, () => zeros(p));
  const xty = zeros(p);
  for (let r = 0; r < X.length; r++) {
    const row = X[r] as number[];
    const yr = y[r] as number;
    for (let i = 0; i < p; i++) {
      const ri = row[i] as number;
      xty[i] = (xty[i] as number) + ri * yr;
      const xtxRow = xtx[i] as number[];
      for (let j = 0; j < p; j++) {
        xtxRow[j] = (xtxRow[j] as number) + ri * (row[j] as number);
      }
    }
  }
  for (let i = 0; i < p; i++) {
    const xtxRow = xtx[i] as number[];
    xtxRow[i] = (xtxRow[i] as number) + RIDGE;
  }
  return solveLinearSystem(xtx, xty);
}

/** Gauss-Jordan elimination with partial pivoting. Returns null if singular. */
function solveLinearSystem(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i] as number]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs((m[r] as number[])[col] as number) > Math.abs((m[pivot] as number[])[col] as number)) {
        pivot = r;
      }
    }
    const pivotVal = (m[pivot] as number[])[col] as number;
    if (Math.abs(pivotVal) < 1e-12) return null;
    [m[col], m[pivot]] = [m[pivot] as number[], m[col] as number[]];
    const pivotRow = m[col] as number[];
    for (let j = col; j <= n; j++) {
      pivotRow[j] = (pivotRow[j] as number) / pivotVal;
    }
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = (m[r] as number[])[col] as number;
      const row = m[r] as number[];
      for (let j = col; j <= n; j++) {
        row[j] = (row[j] as number) - factor * (pivotRow[j] as number);
      }
    }
  }
  return m.map((row) => row[n] as number);
}

function rSquared(X: number[][], y: number[], beta: number[]): number {
  const meanY = y.reduce((a, b) => a + b, 0) / y.length;
  let ssTot = 0;
  for (const yi of y) ssTot += (yi - meanY) ** 2;
  if (ssTot < 1e-12) return 0;
  return 1 - sumSquaredResiduals(X, y, beta) / ssTot;
}

function sumSquaredResiduals(X: number[][], y: number[], beta: number[]): number {
  let ss = 0;
  for (let r = 0; r < X.length; r++) {
    const pred = dot(beta, X[r] as number[]);
    ss += ((y[r] as number) - pred) ** 2;
  }
  return ss;
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] as number) * (b[i] as number);
  return s;
}

function zeros(n: number): number[] {
  return new Array<number>(n).fill(0);
}

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}
