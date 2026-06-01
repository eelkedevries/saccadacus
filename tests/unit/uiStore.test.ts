import { beforeEach, describe, expect, it } from 'vitest';
import { createAggregateThrottle, useUiStore } from '../../src/state/uiStore';
import type { AggregateSnapshot } from '../../src/state/uiStore';

const snapshot: AggregateSnapshot = {
  leftReliability: 0.8,
  rightReliability: 0.6,
  faceReliability: 0.9,
  activeSelection: 'iris',
  saccadeCount: 2,
  blinkCount: 1,
};

describe('useUiStore', () => {
  beforeEach(() => {
    useUiStore.setState({
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
    });
  });

  it('updates the tracking and eye-selection modes', () => {
    useUiStore.getState().setTrackingMode('pupil');
    useUiStore.getState().setEyeSelectionMode('left');
    expect(useUiStore.getState().trackingMode).toBe('pupil');
    expect(useUiStore.getState().eyeSelectionMode).toBe('left');
  });

  it('applies an aggregate snapshot', () => {
    useUiStore.getState().applyAggregate(snapshot);
    const s = useUiStore.getState();
    expect(s.leftReliability).toBe(0.8);
    expect(s.rightReliability).toBe(0.6);
    expect(s.saccadeCount).toBe(2);
    expect(s.blinkCount).toBe(1);
  });

  it('toggles gaze-mapping availability and export status', () => {
    useUiStore.getState().setGazeMappingAvailable(true);
    useUiStore.getState().setExportStatus('ready');
    expect(useUiStore.getState().gazeMappingAvailable).toBe(true);
    expect(useUiStore.getState().exportStatus).toBe('ready');
  });
});

describe('createAggregateThrottle', () => {
  it('fires at most once per interval', () => {
    let nowMs = 0;
    const calls: AggregateSnapshot[] = [];
    const throttle = createAggregateThrottle((s) => calls.push(s), 10, () => nowMs);

    throttle(snapshot); // t=0 -> fires
    nowMs = 50;
    throttle(snapshot); // 50 ms < 100 ms interval -> suppressed
    nowMs = 100;
    throttle(snapshot); // 100 ms -> fires
    nowMs = 150;
    throttle(snapshot); // suppressed
    nowMs = 205;
    throttle(snapshot); // fires

    expect(calls).toHaveLength(3);
  });
});
