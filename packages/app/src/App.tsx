import { createPortalApp } from '@openchoreo/backstage-portal-app';
import { stepLayoutFieldModule } from './modules/scaffolder/stepLayoutFieldModule';
import { mlopsModelRegistryModule } from './modules/mlops-model-registry';
import { homeModule } from './modules/home/homeModule';

// AI Delivery Portal customizations, layered on top of the stock OpenChoreo
// portal via createPortalApp's own extension point — see
// packages/backend/src/index.ts for the matching scaffolder actions.
//
// home/homeModule only contributes HomePageWidgetBlueprint entries into
// portal-app's own editable Home grid (CustomHomepageGrid) — it does not
// replace portal-app's Home page/layout, so it doesn't hit the
// duplicate/conflict concern below.
//
// Still NOT wired in (present under ./modules for safekeeping, ported from
// the old app-backstage, pending a real Root.tsx edit since portal-app owns
// its own sidebar/theme/auth natively — wiring these as-is would duplicate/
// conflict rather than extend): nav/ (Sidebar+logo — superseded by
// app.branding config, except the MCP Chat/LiteLLM Admin nav links, which
// still need a Root.tsx addition), theme/ (superseded by app.branding),
// auth/openchoreoAuthModule (portal-app already ships real openchoreo-auth
// sign-in).
export default createPortalApp({
  features: [stepLayoutFieldModule, mlopsModelRegistryModule, homeModule],
}).createRoot();
