import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Box, makeStyles } from '@material-ui/core';
import { identityApiRef, useApi } from '@backstage/core-plugin-api';
import { useAssistantEnabled } from '@openchoreo/backstage-plugin-react';
import { AssistantChatDrawer } from '../AssistantChatDrawer/AssistantChatDrawer';
import { GlobalAssistantFab } from '../GlobalAssistantFab/GlobalAssistantFab';
import {
  clampDrawerWidth,
  persistDrawerWidth,
  readStoredDrawerWidth,
  DEFAULT_DRAWER_WIDTH,
} from '../AssistantChatDrawer/drawerWidth';
import { perchAgentApiRef, type ChatScope } from '../../api/PerchAgentApi';

// Persisted "the user has opened the assistant at least once" flag — drives
// the FAB's new-assistant dot + pulse so a first-time user notices the entry
// point, without re-pulsing on every reload.
const FAB_SEEN_KEY = 'openchoreo.assistant.fabSeen';

function readFabSeen(): boolean {
  try {
    return localStorage.getItem(FAB_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function persistFabSeen(): void {
  try {
    localStorage.setItem(FAB_SEEN_KEY, '1');
  } catch {
    // localStorage can be unavailable (private mode) — the dot just reappears.
  }
}

const useStyles = makeStyles(() => ({
  // Wraps the whole app so the page content shrinks to make room for the
  // persistent assistant panel instead of being covered by it. The
  // transition is disabled mid-drag so the panel tracks the pointer
  // without lag.
  appContent: {
    transition: 'margin-right 0.2s ease',
  },
  appContentResizing: {
    transition: 'none',
  },
}));

/**
 * Pinned context attached to a chat session so the agent (and the user)
 * know what concrete resource the conversation is about. v1 only carries
 * a workflow_run; future variants (log_error, alert, ...) will be added
 * here as discriminated cases.
 */
export type PinnedContext = {
  kind: 'workflow_run';
  namespace: string;
  component: string;
  runName: string;
  runDisplay?: string;
  /** OpenChoreo project the component belongs to. */
  project?: string;
  /** Status of the pinned run, e.g. "Failed". */
  runStatus?: string;
  /** Name of the Workflow / ClusterWorkflow CRD bound to the component. */
  workflowName?: string;
  /** Kind: "Workflow" (namespace-scoped) or "ClusterWorkflow". */
  workflowKind?: string;
  /**
   * Git URL extracted from the component's workflow schema. Plumbed
   * through so the build_failure "Copy as prompt" button can include
   * a repo hint for external coding bots (CodeRabbit, Cursor, etc.).
   * Optional — components without a workflow repository field omit it.
   */
  repoUrl?: string;
  /**
   * In-repo build path (the component's workflow ``repository.appPath``)
   * extracted alongside ``repoUrl``. Plumbed through so the build_failure
   * "Copy as prompt" button can tell an external coding bot which
   * sub-directory of the repo the failing build ran in. Optional —
   * components built from the repo root omit it.
   */
  componentPath?: string;
  /**
   * Optional case discriminator forwarded into ChatScope.caseType so the
   * agent layers in case-specific guidance. Launchers built for a single
   * scenario (e.g. failed builds) set this; the generic FAB leaves it
   * undefined.
   */
  caseType?: 'build_failure' | 'runtime_debug';
};

export type OpenAssistantOptions = {
  /**
   * Pre-seeded user turn. When set, the drawer auto-runs the streamChat
   * pipeline once on open as if the user had typed this message.
   */
  initialMessage?: string;
  /**
   * Resource the conversation is anchored to. Rendered as a chip above
   * the composer and forwarded to the backend via ChatScope.
   */
  pin?: PinnedContext;
  /**
   * Optional explicit ChatScope overrides merged in after the URL- and
   * pin-derived scope. Use this for cases that don't fit the
   * workflow-run pin model but still need to inject scope fields like
   * caseType, namespace, project, or component.
   */
  scopeOverrides?: Partial<ChatScope>;
  /**
   * Stable identifier for "the same chat". Re-opening the drawer with
   * the SAME conversationKey preserves the existing timeline and skips
   * re-seeding the initialMessage — so the user picks up exactly where
   * they left off. A DIFFERENT (or undefined-vs-defined) key wipes the
   * timeline and seeds the new initialMessage.
   *
   * Convention per launcher:
   * - build_failure:        `build_failure:<component>:<runName>`
   * - build_overview:       `build_overview:<namespace>:<component>`
   * - runtime_debug (logs): `runtime_debug:log:<ns>:<proj>:<comp>:<env>[:t:<ts>|:tr:<traceId>]`
   * - runtime_debug (trace):`runtime_debug:trace:<ns>:<proj>:<env>:<traceId>`
   * - generic FAB:          undefined (or a single sticky key)
   *
   * Launchers that want a fresh chat every time should leave this unset
   * and rely on the openSeq-based wipe.
   */
  conversationKey?: string;
  /**
   * When true, the drawer wipes the timeline and re-seeds the initial
   * message even if ``conversationKey`` matches the last-seeded key.
   * Used by the "Start new" choice on launchers that detected a prior
   * conversation for the same key.
   */
  resetConversation?: boolean;
  /**
   * Override the empty-state suggestion chips the drawer renders.
   * When set, this list replaces the per-caseType defaults — lets a
   * launcher that knows the user's concrete object (a specific failing
   * trace, a particular workflow run) propose chips referencing it by
   * name (e.g. "Why did span <name> error?") instead of the generic
   * caseType-level wording.
   *
   * Each string is sent verbatim as a user turn when the chip is
   * clicked, mirroring the existing one-tap-to-send behaviour.
   */
  suggestions?: string[];
};

type AssistantDrawerState = {
  isOpen: boolean;
  options: OpenAssistantOptions;
  /**
   * Bumped on every openDrawer() call so the drawer can detect a fresh
   * "open with seed" event even if isOpen was already true.
   */
  openSeq: number;
};

type AssistantDrawerContextValue = {
  state: AssistantDrawerState;
  openDrawer: (opts?: OpenAssistantOptions) => void;
  closeDrawer: () => void;
  /**
   * True until the user opens the assistant for the first time (persisted
   * across reloads). The FAB renders a dot + pulse while set, so a
   * first-time user notices the entry point.
   */
  hasUnread: boolean;
  /**
   * True while a contextual launcher (failed build, build overview) is
   * mounted. The global FAB hides then, so the two bottom-right entry
   * points never overlap — the contextual one is the more relevant.
   */
  hasContextualLauncher: boolean;
  /**
   * Register a contextual launcher; returns the unregister callback for the
   * caller's effect cleanup. Counter-based so two launchers on one page
   * don't unregister each other.
   */
  registerContextualLauncher: () => () => void;
  /**
   * Whether a prior conversation for ``key`` exists in this session — i.e.
   * the drawer was last seeded with this exact ``conversationKey``. Used
   * by launchers to offer "Continue previous" vs "Start new" instead of a
   * single Investigate button. False on first ever open and after the
   * drawer was wiped (a different key was opened in between).
   */
  hasConversation: (key: string) => boolean;
};

const AssistantDrawerContext =
  createContext<AssistantDrawerContextValue | null>(null);

export const AssistantDrawerProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const classes = useStyles();
  const [state, setState] = useState<AssistantDrawerState>({
    isOpen: false,
    options: {},
    openSeq: 0,
  });
  const [hasUnread, setHasUnread] = useState(() => !readFabSeen());
  const [contextualLaunchers, setContextualLaunchers] = useState(0);
  const registerContextualLauncher = useCallback(() => {
    setContextualLaunchers(n => n + 1);
    return () => setContextualLaunchers(n => n - 1);
  }, []);

  // Panel width lives here (not in the drawer) so the page content can
  // reserve matching space and shrink instead of being covered. Seeded
  // from localStorage and clamped to the viewport.
  const [drawerWidth, setDrawerWidth] = useState(() =>
    clampDrawerWidth(readStoredDrawerWidth() ?? DEFAULT_DRAWER_WIDTH),
  );
  const [isResizing, setIsResizing] = useState(false);

  // Drag-to-resize. The panel is anchored right, so dragging its left
  // edge leftwards grows it: newWidth = startWidth + (startX - x).
  const startResize = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = drawerWidth;
      setIsResizing(true);

      const onMove = (ev: MouseEvent) => {
        setDrawerWidth(clampDrawerWidth(startWidth + (startX - ev.clientX)));
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        setIsResizing(false);
        setDrawerWidth(prev => {
          persistDrawerWidth(prev);
          return prev;
        });
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [drawerWidth],
  );

  // Keyboard resize for the handle — arrow keys nudge the width so the
  // panel is usable without a pointer.
  const handleResizeKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const step = e.shiftKey ? 48 : 16;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setDrawerWidth(prev => clampDrawerWidth(prev + step));
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        setDrawerWidth(prev => clampDrawerWidth(prev - step));
      }
    },
    [],
  );

  // Pre-warm the per-user MCP tools cache on the agent the first time the
  // provider mounts after sign-in (and only when the assistant feature is on).
  // The agent returns 202 immediately and fetches in the background, so the
  // user's first chat skips the 6-9s tool-listing roundtrip. Best-effort: a
  // failed warmup just means the first chat pays the cache miss as before.
  const enabled = useAssistantEnabled();
  const identityApi = useApi(identityApiRef);
  const assistantApi = useApi(perchAgentApiRef);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const { userEntityRef } = await identityApi.getBackstageIdentity();
        if (cancelled || !userEntityRef) return;
        await assistantApi.warmup();
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled, identityApi, assistantApi]);

  // Single-key tracking matches the drawer's single-conversation model:
  // only one chat lives in memory at a time, wiped on key switch. This
  // ref tracks "what is currently in the drawer", set when the drawer
  // actually seeds (which happens for fresh keys, or for same-key opens
  // with resetConversation=true).
  const lastSeededKey = useRef<string | undefined>(undefined);

  const openDrawer = useCallback((opts: OpenAssistantOptions = {}) => {
    // If the open is a "Start new" (resetConversation) for the current
    // key, clear the tracker so subsequent hasConversation() calls return
    // false until the drawer seeds the new chat (which updates it again).
    if (
      opts.resetConversation &&
      opts.conversationKey &&
      lastSeededKey.current === opts.conversationKey
    ) {
      lastSeededKey.current = undefined;
    } else if (opts.conversationKey) {
      // Track keys the drawer is about to seed. The drawer's effect below
      // is the source of truth for "did we actually seed?" but the timing
      // is fine: the only consumer (launcher hasConversation lookup) runs
      // on render, well after openDrawer settles.
      lastSeededKey.current = opts.conversationKey;
    } else {
      lastSeededKey.current = undefined;
    }
    setState(prev => ({
      isOpen: true,
      options: opts,
      openSeq: prev.openSeq + 1,
    }));
    setHasUnread(false);
    persistFabSeen();
  }, []);

  const closeDrawer = useCallback(() => {
    setState(prev => ({ ...prev, isOpen: false }));
  }, []);

  const hasConversation = useCallback(
    (key: string) => lastSeededKey.current === key,
    [],
  );

  const value = useMemo(
    () => ({
      state,
      openDrawer,
      closeDrawer,
      hasConversation,
      hasUnread,
      hasContextualLauncher: contextualLaunchers > 0,
      registerContextualLauncher,
    }),
    [
      state,
      openDrawer,
      closeDrawer,
      hasConversation,
      hasUnread,
      contextualLaunchers,
      registerContextualLauncher,
    ],
  );

  return (
    <AssistantDrawerContext.Provider value={value}>
      {/* Reserve space for the panel so the page content shrinks rather
          than being covered. The margin tracks the panel width and is
          frozen (no transition) while the user drags. */}
      <Box
        className={`${classes.appContent}${
          isResizing ? ` ${classes.appContentResizing}` : ''
        }`}
        style={{ marginRight: state.isOpen ? drawerWidth : 0 }}
      >
        {children}
      </Box>
      <GlobalAssistantFab />
      <AssistantChatDrawer
        open={state.isOpen}
        onClose={closeDrawer}
        initialMessage={state.options.initialMessage}
        pin={state.options.pin}
        scopeOverrides={state.options.scopeOverrides}
        conversationKey={state.options.conversationKey}
        resetConversation={state.options.resetConversation}
        suggestions={state.options.suggestions}
        openSeq={state.openSeq}
        width={drawerWidth}
        isResizing={isResizing}
        onResizeStart={startResize}
        onResizeKeyDown={handleResizeKeyDown}
      />
    </AssistantDrawerContext.Provider>
  );
};

/**
 * Read-write hook for any consumer that needs to open/close the drawer
 * or read its current options. Throws if used outside the provider so
 * mounting mistakes fail loudly instead of silently no-oping.
 */
export const useAssistantDrawer = (): AssistantDrawerContextValue => {
  const ctx = useContext(AssistantDrawerContext);
  if (ctx === null) {
    throw new Error(
      'useAssistantDrawer must be used inside <AssistantDrawerProvider>',
    );
  }
  return ctx;
};
