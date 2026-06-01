import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MappedSignalSwitch } from '../../src/app/panels/MappedSignalSwitch';
import { useUiStore } from '../../src/state/uiStore';

describe('MappedSignalSwitch', () => {
  beforeEach(() => {
    useUiStore.setState({
      gazeMappingAvailable: false,
      gazeVariants: [],
      activeGazeVariant: null,
    });
  });

  it('renders nothing until gaze mapping is available', () => {
    const { container } = render(<MappedSignalSwitch />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists available variants with reliability and switches the active one', async () => {
    const user = userEvent.setup();
    useUiStore.setState({
      gazeMappingAvailable: true,
      gazeVariants: [
        { id: 'iris_binocular', reliability: 0.92 },
        { id: 'iris_left', reliability: 0.71 },
      ],
      activeGazeVariant: 'iris_binocular',
    });
    render(<MappedSignalSwitch />);

    expect(screen.getByText(/iris_binocular \(92%\)/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /iris_binocular/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );

    await user.click(screen.getByRole('radio', { name: /iris_left/ }));
    expect(useUiStore.getState().activeGazeVariant).toBe('iris_left');
  });
});
