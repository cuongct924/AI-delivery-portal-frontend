import { createFrontendModule } from '@backstage/frontend-plugin-api';
import { ThemeBlueprint } from '@backstage/plugin-app-react';
import { UnifiedThemeProvider } from '@backstage/theme';
import { redTheme } from './redTheme';

const redThemeExtension = ThemeBlueprint.make({
  params: {
    theme: {
      id: 'ai-delivery-portal-light',
      title: 'AI Delivery Portal',
      variant: 'light',
      Provider: ({ children }) => (
        <UnifiedThemeProvider theme={redTheme}>{children}</UnifiedThemeProvider>
      ),
    },
  },
});

export const themeModule = createFrontendModule({
  pluginId: 'app',
  extensions: [redThemeExtension],
});
