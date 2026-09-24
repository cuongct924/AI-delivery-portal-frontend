import '@testing-library/jest-dom';
import { enableMapSet } from 'immer';

// Same reason as src/index.tsx — the scaffolder's useImmerReducer draft can
// carry Map/Set values.
enableMapSet();

// React 18's act() support is opt-in via this global. Without it, any state
// update that lands outside a testing-library act() scope — e.g. a fetch
// resolving after render — logs a "not configured to support act(...)"
// warning instead of being attributed to the test.
(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
