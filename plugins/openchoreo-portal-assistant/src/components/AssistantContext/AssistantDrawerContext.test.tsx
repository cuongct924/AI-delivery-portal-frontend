import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  AssistantDrawerProvider,
  useAssistantDrawer,
} from './AssistantDrawerContext';

jest.mock('@backstage/core-plugin-api', () => ({
  createApiRef: (config: { id: string }) => ({ id: config.id }),
  createRouteRef: (config: { id: string }) => ({ id: config.id }),
  identityApiRef: { id: 'core.identity' },
  useApi: () => ({
    getBackstageIdentity: async () => ({ userEntityRef: 'user:default/ada' }),
    warmup: async () => {},
    streamChat: async () => {},
    getSession: async () => ({ messages: [], draft: null }),
    deleteSession: async () => {},
    getProfileInfo: () => ({
      then: (cb: (profile: unknown) => void) => {
        cb({ displayName: 'Ada Lovelace' });
        return { catch: () => undefined };
      },
    }),
  }),
}));

jest.mock('@openchoreo/backstage-plugin-react', () => ({
  useAssistantEnabled: () => true,
}));

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/' }),
  useNavigate: () => jest.fn(),
}));

jest.mock('@openchoreo/backstage-plugin', () => ({
  setTemplateDraft: jest.fn(),
  clearTemplateDraft: jest.fn(),
  getTemplateDraft: jest.fn(() => null),
}));

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children?: string }) => <div>{children}</div>,
}));
jest.mock('remark-gfm', () => ({ __esModule: true, default: () => () => {} }));
jest.mock('remend', () => ({ __esModule: true, default: (t: string) => t }));

const OpenButton = () => {
  const { openDrawer } = useAssistantDrawer();
  return <button onClick={() => openDrawer()}>open</button>;
};

const UnreadProbe = () => {
  const { hasUnread } = useAssistantDrawer();
  return <span data-testid="unread">{String(hasUnread)}</span>;
};

describe('AssistantDrawerProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('flags the assistant as unread until it is opened once', async () => {
    render(
      <AssistantDrawerProvider>
        <UnreadProbe />
        <OpenButton />
      </AssistantDrawerProvider>,
    );

    expect(screen.getByTestId('unread').textContent).toBe('true');

    await act(async () => {
      fireEvent.click(screen.getByText('open'));
    });

    expect(screen.getByTestId('unread').textContent).toBe('false');
    expect(localStorage.getItem('openchoreo.assistant.fabSeen')).toBe('1');
  });

  it('starts read when the assistant was opened in a prior session', () => {
    localStorage.setItem('openchoreo.assistant.fabSeen', '1');

    render(
      <AssistantDrawerProvider>
        <UnreadProbe />
      </AssistantDrawerProvider>,
    );

    expect(screen.getByTestId('unread').textContent).toBe('false');
  });

  it('reserves space for the panel so the page content shrinks', async () => {
    render(
      <AssistantDrawerProvider>
        <div data-testid="page">page</div>
        <OpenButton />
      </AssistantDrawerProvider>,
    );

    // The page content is wrapped so its right margin can track the panel.
    const wrapper = screen.getByTestId('page').parentElement as HTMLElement;
    expect(wrapper.style.marginRight).toBe('0px');

    await act(async () => {
      fireEvent.click(screen.getByText('open'));
    });

    // Open → the content gives up exactly the panel's width.
    expect(wrapper.style.marginRight).toBe('480px');
  });
});
