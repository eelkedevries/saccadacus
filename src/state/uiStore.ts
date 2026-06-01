/**
 * UI state store (PROPOSAL.md §23).
 *
 * Zustand holds UI state ONLY: current modes, recent reliability scalars,
 * status flags, and event counts. Continuous signals must never be stored here
 * — they live in ring buffers (AGENTS.md hard rule). Aggregated state is pushed
 * on a throttled ~10 Hz schedule, independent of the per-frame loop.
 */
import { create } from 'zustand';
import type {
  EyeSelectionMode,
  Selection,
  TrackingMode,
} from '../tracking/TrackingBackend';

/** Small scalar snapshot pushed from the signal pipeline at ~10 Hz. */
export interface AggregateSnapshot {
  leftReliability: number;
  rightReliability: number;
  faceReliability: number;
  activeSelection: Selection;
  saccadeCount: number;
  blinkCount: number;
}

export type TrackingStatus = 'idle' | 'preparing' | 'tracking' | 'error';
export type ExportStatus = 'idle' | 'exporting' | 'ready' | 'failed';

export interface UiState {
  trackingMode: TrackingMode;
  eyeSelectionMode: EyeSelectionMode;
  trackingStatus: TrackingStatus;
  exportStatus: ExportStatus;
  gazeMappingAvailable: boolean;

  leftReliability: number;
  rightReliability: number;
  faceReliability: number;
  activeSelection: Selection;
  saccadeCount: number;
  blinkCount: number;

  /** Active tracking delegate, surfaced for the status panel (§25). */
  activeDelegate: string | null;
  /** Available gaze-mapping variants and their fit reliability. */
  gazeVariants: { id: string; reliability: number }[];
  activeGazeVariant: string | null;

  setTrackingMode: (mode: TrackingMode) => void;
  setEyeSelectionMode: (mode: EyeSelectionMode) => void;
  setTrackingStatus: (status: TrackingStatus) => void;
  setExportStatus: (status: ExportStatus) => void;
  setGazeMappingAvailable: (available: boolean) => void;
  setActiveDelegate: (delegate: string | null) => void;
  setGazeVariants: (variants: { id: string; reliability: number }[]) => void;
  setActiveGazeVariant: (id: string | null) => void;
  applyAggregate: (snapshot: AggregateSnapshot) => void;
}

export const useUiStore = create<UiState>((set) => ({
  trackingMode: 'auto',
  eyeSelectionMode: 'binocular',
  trackingStatus: 'idle',
  exportStatus: 'idle',
  gazeMappingAvailable: false,

  leftReliability: 0,
  rightReliability: 0,
  faceReliability: 0,
  activeSelection: 'iris',
  saccadeCount: 0,
  blinkCount: 0,

  activeDelegate: null,
  gazeVariants: [],
  activeGazeVariant: null,

  setTrackingMode: (trackingMode) => set({ trackingMode }),
  setEyeSelectionMode: (eyeSelectionMode) => set({ eyeSelectionMode }),
  setTrackingStatus: (trackingStatus) => set({ trackingStatus }),
  setExportStatus: (exportStatus) => set({ exportStatus }),
  setGazeMappingAvailable: (gazeMappingAvailable) => set({ gazeMappingAvailable }),
  setActiveDelegate: (activeDelegate) => set({ activeDelegate }),
  setGazeVariants: (gazeVariants) => set({ gazeVariants }),
  setActiveGazeVariant: (activeGazeVariant) => set({ activeGazeVariant }),
  applyAggregate: (snapshot) =>
    set({
      leftReliability: snapshot.leftReliability,
      rightReliability: snapshot.rightReliability,
      faceReliability: snapshot.faceReliability,
      activeSelection: snapshot.activeSelection,
      saccadeCount: snapshot.saccadeCount,
      blinkCount: snapshot.blinkCount,
    }),
}));

/**
 * Throttle an aggregate-snapshot consumer to roughly `hz` updates per second.
 * The per-frame loop calls `push` freely; the wrapped callback fires at most
 * once per interval, keeping React updates off the frame path (§23).
 */
export function createAggregateThrottle(
  apply: (snapshot: AggregateSnapshot) => void,
  hz = 10,
  now: () => number = () => performance.now(),
): (snapshot: AggregateSnapshot) => void {
  const intervalMs = 1000 / hz;
  let lastMs = Number.NEGATIVE_INFINITY;
  return (snapshot: AggregateSnapshot) => {
    const t = now();
    if (t - lastMs >= intervalMs) {
      lastMs = t;
      apply(snapshot);
    }
  };
}
