import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TrackingModeSwitch } from '../../src/app/panels/TrackingModeSwitch';
import { EyeSelectionSwitch } from '../../src/app/panels/EyeSelectionSwitch';
import { useUiStore } from '../../src/state/uiStore';

describe('mode and eye-selection switches', () => {
  beforeEach(() => {
    useUiStore.setState({ trackingMode: 'auto', eyeSelectionMode: 'binocular' });
  });

  it('updates the tracking mode in the store when clicked', async () => {
    const user = userEvent.setup();
    render(<TrackingModeSwitch />);
    await user.click(screen.getByRole('radio', { name: 'Iris centre' }));
    expect(useUiStore.getState().trackingMode).toBe('iris');
    expect(screen.getByRole('radio', { name: 'Iris centre' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('updates the eye-selection mode in the store when clicked', async () => {
    const user = userEvent.setup();
    render(<EyeSelectionSwitch />);
    await user.click(screen.getByRole('radio', { name: 'Left eye' }));
    expect(useUiStore.getState().eyeSelectionMode).toBe('left');
  });

  it('reflects the current store value as the checked radio', () => {
    useUiStore.setState({ trackingMode: 'pupil' });
    render(<TrackingModeSwitch />);
    expect(screen.getByRole('radio', { name: 'Pupil centre' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
});
