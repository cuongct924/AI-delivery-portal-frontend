import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GlobalAssistantFab } from './GlobalAssistantFab';

const holder = {
  enabled: true,
  isOpen: false,
  hasUnread: true,
  hasContextualLauncher: false,
  openDrawer: jest.fn(),
};

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useAssistantEnabled: () => holder.enabled,
}));

jest.mock('../AssistantContext/AssistantDrawerContext', () => ({
  useAssistantDrawer: () => ({
    state: { isOpen: holder.isOpen },
    openDrawer: (...args: unknown[]) => holder.openDrawer(...args),
    hasUnread: holder.hasUnread,
    hasContextualLauncher: holder.hasContextualLauncher,
  }),
}));

beforeEach(() => {
  localStorage.clear();
  holder.enabled = true;
  holder.isOpen = false;
  holder.hasUnread = true;
  holder.hasContextualLauncher = false;
  holder.openDrawer = jest.fn();
});

describe('GlobalAssistantFab', () => {
  it('renders a labelled "Ask AI" entry point', async () => {
    render(<GlobalAssistantFab />);
    expect(await screen.findByText('Ask AI')).toBeInTheDocument();
  });

  it('shows the first-run CTA bubble and opens the drawer on click', async () => {
    render(<GlobalAssistantFab />);
    const cta = await screen.findByText('Click to open chat →');
    fireEvent.click(cta);
    expect(holder.openDrawer).toHaveBeenCalled();
  });

  it('keeps the CTA bubble even after the assistant was opened before', async () => {
    holder.hasUnread = false;
    render(<GlobalAssistantFab />);
    expect(await screen.findByText('Click to open chat →')).toBeInTheDocument();
  });

  it('hides the bubble once dismissed but keeps the FAB', async () => {
    render(<GlobalAssistantFab />);
    fireEvent.click(await screen.findByLabelText('Dismiss assistant hint'));
    await waitFor(() =>
      expect(
        screen.queryByText('Click to open chat →'),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Ask AI')).toBeInTheDocument();
    expect(localStorage.getItem('openchoreo.assistant.bubbleDismissed')).toBe(
      '1',
    );
  });

  it('hides entirely while a contextual launcher owns the slot', () => {
    holder.hasContextualLauncher = true;
    render(<GlobalAssistantFab />);
    expect(screen.queryByText('Ask AI')).not.toBeInTheDocument();
  });

  it('hides while the drawer is open', () => {
    holder.isOpen = true;
    render(<GlobalAssistantFab />);
    expect(screen.queryByText('Ask AI')).not.toBeInTheDocument();
  });
});
