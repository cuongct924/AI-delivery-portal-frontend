// Plugin shell + API factory (kept as a Backstage plugin so the
// PerchAgentClient is registered idiomatically via apiRef).
export { openchoreoPerchPlugin } from './plugin';

// API client + types
export {
  perchAgentApiRef,
  PerchAgentClient,
  type PerchAgentApi,
  type ChatCaseType,
  type ChatMessage,
  type ChatScope,
  type StreamEvent,
} from './api/PerchAgentApi';

// Drawer context (provider + consumer hook)
export {
  AssistantDrawerProvider,
  useAssistantDrawer,
  type OpenAssistantOptions,
  type PinnedContext,
} from './components/AssistantContext/AssistantDrawerContext';

// UI surfaces — plain React components, mounted by packages/app at fixed
// points in the entity page tree. Not wrapped in createComponentExtension
// because the lazy-loading overhead doesn't pay off at this size; if a
// future component grows large enough to warrant code-splitting, wrap
// that one specifically.
//
// Note: GlobalAssistantFab reinstates the global FAB upstream removed here
// (see its own docstring for why) — rendered inside AssistantDrawerProvider
// itself, not exported from this file.
export { FailedBuildSnackbar } from './components/FailedBuildSnackbar/FailedBuildSnackbar';
export { BuildPagePromptLauncher } from './components/BuildPagePromptLauncher/BuildPagePromptLauncher';
export { LogsPageDebugPrompt } from './components/LogsPageDebugPrompt/LogsPageDebugPrompt';
export {
  InvestigateLogButton,
  type LogRowForInvestigation,
} from './components/InvestigateLogButton/InvestigateLogButton';
export { InvestigateDependencyButton } from './components/InvestigateDependencyButton/InvestigateDependencyButton';
