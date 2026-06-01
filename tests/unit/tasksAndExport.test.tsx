import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FollowTheDotsPanel } from '../../src/app/panels/FollowTheDotsPanel';
import { ExportPanel } from '../../src/app/panels/ExportPanel';
import { clearSessionRegistry } from '../../src/app/sessionRegistry';

describe('FollowTheDotsPanel lifecycle', () => {
  afterEach(() => clearSessionRegistry());

  it('starts the task, shows a dot, and stops', async () => {
    const user = userEvent.setup();
    render(<FollowTheDotsPanel />);

    await user.click(screen.getByRole('button', { name: /start follow-the-dots task/i }));
    expect(screen.getByText(/Dots shown: 1/)).toBeInTheDocument();
    expect(screen.getByTestId('follow-dot')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /stop/i }));
    expect(
      screen.getByRole('button', { name: /start follow-the-dots task/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Dots shown: 1/)).toBeInTheDocument();
  });
});

describe('ExportPanel control', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearSessionRegistry();
    (URL as unknown as { createObjectURL: () => string }).createObjectURL = () => 'blob:test';
    (URL as unknown as { revokeObjectURL: () => void }).revokeObjectURL = () => {};
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    clearSessionRegistry();
  });

  it('exports all three CSV files and reports ready status', async () => {
    const user = userEvent.setup();
    render(<ExportPanel />);
    await user.click(screen.getByRole('button', { name: /export all/i }));
    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalledTimes(3);
      expect(screen.getByText(/Status: ready/)).toBeInTheDocument();
    });
  });

  it('exports a single file when its dedicated button is used', async () => {
    const user = userEvent.setup();
    render(<ExportPanel />);
    await user.click(screen.getByRole('button', { name: /export events/i }));
    await waitFor(() => {
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Status: ready/)).toBeInTheDocument();
    });
  });
});
