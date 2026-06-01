import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelpPanel } from '../../src/app/panels/HelpPanel';

describe('HelpPanel', () => {
  it('is collapsed by default and expands on click', async () => {
    const user = userEvent.setup();
    render(<HelpPanel />);
    expect(screen.queryByText(/saccadacus tracks eye and head movement/)).toBeNull();
    await user.click(screen.getByRole('button', { name: /show help/i }));
    expect(screen.getByText(/saccadacus tracks eye and head movement/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hide help/i })).toBeInTheDocument();
  });
});
