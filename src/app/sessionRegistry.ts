/**
 * Session registry: a non-reactive holder linking the live session's data
 * sources to the export and task panels.
 *
 * It holds references only (ring-buffer-backed pipeline, event tracker, dot
 * accessor); no continuous signals are copied into a reactive store. The live
 * session populates it on mount and clears it on unmount.
 */
import type { SignalPipeline } from '../signals/signalPipeline';
import type { LiveEventTracker } from '../events/liveEventTracker';
import type { DotRecord } from '../tasks/followTheDots/followTheDotsController';
import type { CameraActualSettingsLite } from '../export/sessionExport';
import type { TrackingFrameResult } from '../tracking/TrackingBackend';
import type { GazeMappingService } from '../tasks/gazeMapping/gazeMappingService';

export interface SessionRegistry {
  pipeline?: SignalPipeline;
  tracker?: LiveEventTracker;
  getDots?: () => DotRecord[];
  camera?: CameraActualSettingsLite;
  latestResult?: TrackingFrameResult;
  gazeMapping?: GazeMappingService;
}

export const sessionRegistry: SessionRegistry = {};

export function clearSessionRegistry(): void {
  delete sessionRegistry.pipeline;
  delete sessionRegistry.tracker;
  delete sessionRegistry.getDots;
  delete sessionRegistry.camera;
  delete sessionRegistry.latestResult;
  delete sessionRegistry.gazeMapping;
}
