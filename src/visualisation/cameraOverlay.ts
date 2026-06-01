/**
 * Camera overlay rendering (PROPOSAL.md §9, §23).
 *
 * Canvas 2D on the main thread, redrawn when a `TrackingFrameResult` arrives.
 * `OffscreenCanvas` is never transferred to a worker for overlay rendering
 * (AGENTS.md hard rule).
 *
 * When the backend supplies `overlayLandmarks` (e.g. the production MediaPipe
 * adapter) the overlay draws the actual eye corners and iris markers on top of
 * the video. When landmarks are absent (the synthetic mock), it falls back to a
 * schematic representation of the eye-local signal so the synthetic demo is
 * still visible.
 */
import type {
  OverlayEye,
  OverlayLandmarks,
  TrackingFrameResult,
} from '../tracking/TrackingBackend';

export interface OverlayLayout {
  widthPx: number;
  heightPx: number;
}

const COLOURS = {
  frame: '#3a3a3a',
  eye: '#888888',
  marker: '#1e88e5',
  cornerLeft: '#fb8c00',
  cornerRight: '#43a047',
  axisYaw: '#e53935',
  axisPitch: '#43a047',
  axisRoll: '#fb8c00',
  text: '#cccccc',
  low: '#b00020',
};

export function clearOverlay(ctx: CanvasRenderingContext2D, layout: OverlayLayout): void {
  ctx.clearRect(0, 0, layout.widthPx, layout.heightPx);
}

/** Half-size of the central target box, as a fraction of the frame. */
const CENTRE_TOLERANCE = 0.18;

export function drawCameraOverlay(
  ctx: CanvasRenderingContext2D,
  result: TrackingFrameResult,
  layout: OverlayLayout,
): void {
  clearOverlay(ctx, layout);
  const landmarks = result.overlayLandmarks;
  if (landmarks) {
    drawCentringGuide(ctx, layout, landmarks.faceCentre);
    drawLandmarkOverlay(ctx, landmarks, layout);
    if (result.headPose && landmarks.faceCentre) {
      // Anchor the head-pose axes on the head so head tracking follows it.
      drawHeadAxes(
        ctx,
        landmarks.faceCentre.x * layout.widthPx,
        landmarks.faceCentre.y * layout.heightPx,
        layout.widthPx * 0.12,
        result.headPose,
      );
    }
  } else {
    drawSchematicOverlay(ctx, result, layout);
    if (result.headPose) {
      drawHeadAxes(
        ctx,
        layout.widthPx * 0.5,
        layout.heightPx * 0.85,
        layout.widthPx * 0.12,
        result.headPose,
      );
    }
  }
  drawReliability(ctx, layout, result.faceReliability);
}

function drawLandmarkOverlay(
  ctx: CanvasRenderingContext2D,
  landmarks: OverlayLandmarks,
  layout: OverlayLayout,
): void {
  if (landmarks.leftEye) drawEyeFromLandmarks(ctx, landmarks.leftEye, layout);
  if (landmarks.rightEye) drawEyeFromLandmarks(ctx, landmarks.rightEye, layout);
  if (landmarks.faceCentre) {
    drawFaceCentre(ctx, landmarks.faceCentre, layout);
  }
}

/** Central target box and crosshair to help the user keep head and eyes centred. */
function drawCentringGuide(
  ctx: CanvasRenderingContext2D,
  layout: OverlayLayout,
  faceCentre: { x: number; y: number } | undefined,
): void {
  const cx = layout.widthPx * 0.5;
  const cy = layout.heightPx * 0.5;
  const halfW = layout.widthPx * CENTRE_TOLERANCE;
  const halfH = layout.heightPx * CENTRE_TOLERANCE;
  const centred =
    faceCentre !== undefined &&
    Math.abs(faceCentre.x - 0.5) <= CENTRE_TOLERANCE &&
    Math.abs(faceCentre.y - 0.5) <= CENTRE_TOLERANCE;

  ctx.strokeStyle = centred ? COLOURS.cornerRight : COLOURS.text;
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 6]);
  ctx.strokeRect(cx - halfW, cy - halfH, halfW * 2, halfH * 2);
  ctx.setLineDash([]);
}

function drawFaceCentre(
  ctx: CanvasRenderingContext2D,
  centre: { x: number; y: number },
  layout: OverlayLayout,
): void {
  const px = centre.x * layout.widthPx;
  const py = centre.y * layout.heightPx;
  const centred = Math.abs(centre.x - 0.5) <= CENTRE_TOLERANCE && Math.abs(centre.y - 0.5) <= CENTRE_TOLERANCE;
  ctx.strokeStyle = centred ? COLOURS.cornerRight : COLOURS.low;
  ctx.lineWidth = 2;
  const r = 8;
  ctx.beginPath();
  ctx.moveTo(px - r, py);
  ctx.lineTo(px + r, py);
  ctx.moveTo(px, py - r);
  ctx.lineTo(px, py + r);
  ctx.stroke();
}

function drawEyeFromLandmarks(
  ctx: CanvasRenderingContext2D,
  eye: OverlayEye,
  layout: OverlayLayout,
): void {
  const ax = eye.cornerA.x * layout.widthPx;
  const ay = eye.cornerA.y * layout.heightPx;
  const bx = eye.cornerB.x * layout.widthPx;
  const by = eye.cornerB.y * layout.heightPx;
  const ix = eye.iris.x * layout.widthPx;
  const iy = eye.iris.y * layout.heightPx;

  const eyeWidth = Math.hypot(bx - ax, by - ay);

  // Horizontal eye axis (corner to corner).
  ctx.strokeStyle = COLOURS.eye;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();

  ctx.fillStyle = COLOURS.cornerLeft;
  ctx.beginPath();
  ctx.arc(ax, ay, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = COLOURS.cornerRight;
  ctx.beginPath();
  ctx.arc(bx, by, 3, 0, Math.PI * 2);
  ctx.fill();

  // Vertical eye axis: perpendicular to the corner axis, through the iris.
  // This is the vertical counterpart to the horizontal corner line and marks
  // the iris/pupil vertical position.
  if (eyeWidth > 0) {
    const vx = -(by - ay) / eyeWidth;
    const vy = (bx - ax) / eyeWidth;
    const half = eyeWidth * 0.5;
    ctx.strokeStyle = COLOURS.marker;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ix - vx * half, iy - vy * half);
    ctx.lineTo(ix + vx * half, iy + vy * half);
    ctx.stroke();
  }

  const irisRadius = Math.max(4, eyeWidth * 0.18);
  ctx.fillStyle = COLOURS.marker;
  ctx.beginPath();
  ctx.arc(ix, iy, irisRadius, 0, Math.PI * 2);
  ctx.fill();
}

/** Fallback schematic used for the synthetic mock (no landmark data). */
function drawSchematicOverlay(
  ctx: CanvasRenderingContext2D,
  result: TrackingFrameResult,
  layout: OverlayLayout,
): void {
  const eyeBoxW = layout.widthPx * 0.22;
  const eyeBoxH = eyeBoxW * 0.5;
  const cy = layout.heightPx * 0.42;
  const leftCx = layout.widthPx * 0.36;
  const rightCx = layout.widthPx * 0.64;
  drawSchematicEye(ctx, rightCx, cy, eyeBoxW, eyeBoxH, result.leftEye);
  drawSchematicEye(ctx, leftCx, cy, eyeBoxW, eyeBoxH, result.rightEye);
}

function drawSchematicEye(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  w: number,
  h: number,
  eye: TrackingFrameResult['leftEye'],
): void {
  ctx.strokeStyle = COLOURS.eye;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
  ctx.stroke();
  if (!eye) return;
  const centre = eye.irisCentre ?? eye.pupilCentre;
  if (!centre) return;
  const mx = cx + clamp(centre.xLocal, -0.5, 0.5) * w;
  const my = cy - clamp(centre.yLocal, -0.5, 0.5) * h;
  const closed = eye.blinkState === 'closed';
  ctx.fillStyle = closed ? COLOURS.low : COLOURS.marker;
  ctx.beginPath();
  ctx.arc(mx, my, Math.max(3, h * 0.18), 0, Math.PI * 2);
  ctx.fill();
}

function drawHeadAxes(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  length: number,
  head: NonNullable<TrackingFrameResult['headPose']>,
): void {
  const yaw = (head.yawDeg * Math.PI) / 180;
  const pitch = (head.pitchDeg * Math.PI) / 180;
  const roll = (head.rollDeg * Math.PI) / 180;
  axis(ctx, cx, cy, Math.sin(yaw) * length, 0, COLOURS.axisYaw);
  axis(ctx, cx, cy, 0, -Math.sin(pitch) * length, COLOURS.axisPitch);
  axis(
    ctx,
    cx,
    cy,
    Math.cos(roll) * length * 0.4,
    Math.sin(roll) * length * 0.4,
    COLOURS.axisRoll,
  );
}

function axis(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  colour: string,
): void {
  ctx.strokeStyle = colour;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + dx, cy + dy);
  ctx.stroke();
}

function drawReliability(
  ctx: CanvasRenderingContext2D,
  layout: OverlayLayout,
  faceReliability: number,
): void {
  const barW = layout.widthPx * 0.3;
  const barH = 8;
  const x = layout.widthPx * 0.05;
  const y = layout.heightPx * 0.05;
  ctx.fillStyle = COLOURS.frame;
  ctx.fillRect(x, y, barW, barH);
  ctx.fillStyle = faceReliability < 0.5 ? COLOURS.low : COLOURS.marker;
  ctx.fillRect(x, y, barW * clamp(faceReliability, 0, 1), barH);
}

function clamp(value: number, lo: number, hi: number): number {
  return value < lo ? lo : value > hi ? hi : value;
}
