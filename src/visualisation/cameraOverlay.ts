/**
 * Camera overlay rendering (PROPOSAL.md §9, §23).
 *
 * Canvas 2D on the main thread, redrawn when a `TrackingFrameResult` arrives.
 * `OffscreenCanvas` is never transferred to a worker for overlay rendering
 * (AGENTS.md hard rule). The overlay draws a schematic of each eye with the
 * iris/pupil marker positioned from the eye-local signal, head-pose axes from
 * yaw/pitch/roll, and reliability indicators.
 *
 * Real face-mesh landmarks are not available from `MockTrackingBackend`; the
 * production backend (Phase 8) supplies them and this module is extended then.
 */
import type { TrackingFrameResult } from '../tracking/TrackingBackend';

export interface OverlayLayout {
  widthPx: number;
  heightPx: number;
}

/** Plain, non-decorative colours; CSS spelling preserved. */
const COLOURS = {
  frame: '#3a3a3a',
  eye: '#888888',
  marker: '#1e88e5',
  axisYaw: '#e53935',
  axisPitch: '#43a047',
  axisRoll: '#fb8c00',
  text: '#cccccc',
  low: '#b00020',
};

export function clearOverlay(ctx: CanvasRenderingContext2D, layout: OverlayLayout): void {
  ctx.clearRect(0, 0, layout.widthPx, layout.heightPx);
}

export function drawCameraOverlay(
  ctx: CanvasRenderingContext2D,
  result: TrackingFrameResult,
  layout: OverlayLayout,
): void {
  clearOverlay(ctx, layout);

  const eyeBoxW = layout.widthPx * 0.22;
  const eyeBoxH = eyeBoxW * 0.5;
  const cy = layout.heightPx * 0.42;
  const leftCx = layout.widthPx * 0.36;
  const rightCx = layout.widthPx * 0.64;

  // Eye-local x is positive to the participant's right; the camera view is
  // mirrored, so the participant's right eye is drawn on the viewer's left.
  drawEye(ctx, rightCx, cy, eyeBoxW, eyeBoxH, result.leftEye);
  drawEye(ctx, leftCx, cy, eyeBoxW, eyeBoxH, result.rightEye);

  if (result.headPose) {
    drawHeadAxes(ctx, layout.widthPx * 0.5, layout.heightPx * 0.72, eyeBoxW * 0.6, result.headPose);
  }

  drawReliability(ctx, layout, result.faceReliability);
}

function drawEye(
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

  // Map eye-local units into the eye box; clamp so the marker stays visible.
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
  axis(ctx, cx, cy, Math.cos(roll) * length * 0.4, Math.sin(roll) * length * 0.4, COLOURS.axisRoll);
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
