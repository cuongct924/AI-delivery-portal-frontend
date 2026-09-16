import { createPortalApp } from '@openchoreo/backstage-portal-app';
import { stepLayoutFieldModule } from './modules/scaffolder/stepLayoutFieldModule';
import { mlopsModelRegistryModule } from './modules/mlops-model-registry';

// AI Delivery Portal customizations, layered on top of the stock OpenChoreo
// portal via createPortalApp's own extension point — see
// packages/backend/src/index.ts for the matching scaffolder actions.
//
// NOT wired in yet (present under ./modules for safekeeping, ported from the
// old app-backstage, pending a real Root.tsx edit since portal-app owns its
// own sidebar/theme/auth natively — wiring these as-is would duplicate/
// conflict rather than extend): nav/ (Sidebar+logo — superseded by
// app.branding config, except the MCP Chat/LiteLLM Admin nav links, which
// still need a Root.tsx addition), theme/ (superseded by app.branding),
// home/ (portal-app has its own Home), auth/openchoreoAuthModule (portal-app
// already ships real openchoreo-auth sign-in).
export default createPortalApp({
  features: [stepLayoutFieldModule, mlopsModelRegistryModule],
}).createRoot();
