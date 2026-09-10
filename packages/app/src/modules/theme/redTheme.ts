import { createUnifiedTheme, palettes, genPageTheme, shapes } from '@backstage/theme';
import { BRAND_RED, NEUTRAL, STATUS } from './colors';

/**
 * Color rulebook (see colors.ts): brand red confined to the logo, the
 * sidebar's selected-item indicator, and at most one primary CTA per
 * screen — never a card/page background, never a secondary button, and
 * never reused for error states (palette.error is a distinct, more
 * orange-leaning red so "broken" is never confused with "the button to
 * press"). `primary`/`secondary` stay neutral so ordinary buttons/links
 * elsewhere don't default to red just because MUI's `color="primary"` is
 * used — the CTA that should be red opts in explicitly per-page instead.
 */
export const redTheme = createUnifiedTheme({
  palette: {
    ...palettes.light,
    background: {
      default: NEUTRAL.background,
      paper: NEUTRAL.paper,
    },
    border: NEUTRAL.border,
    text: {
      primary: NEUTRAL.textPrimary,
      secondary: NEUTRAL.textSecondary,
    },
    error: {
      main: STATUS.error,
    },
    success: {
      main: STATUS.success,
    },
    warning: {
      main: STATUS.warning,
    },
    navigation: {
      ...palettes.light.navigation,
      background: NEUTRAL.paper,
      color: NEUTRAL.textSecondary,
      // The one nav-level use of brand red the rulebook calls out by name.
      indicator: BRAND_RED,
      selectedColor: NEUTRAL.textPrimary,
      navItem: {
        // Neutral hover — hovering happens on every row, so it can't be a
        // brand-red/pink tint without breaking "red shows up in 1-2 spots
        // per screen, not spread across every list item".
        hoverBackground: NEUTRAL.background,
      },
      submenu: {
        background: NEUTRAL.paper,
      },
    },
  },
  // Page/card banner gradients, keyed by spec.type — the rulebook's "card
  // = neutral surface + a thin 4px category strip" applies here: no more
  // per-type color (that differentiation now belongs to the category strip
  // — see modules/theme/colors.ts's CATEGORY_COLORS — not the page banner).
  // Every key gets the same flat, barely-there neutral instead of the
  // stock rainbow (@backstage/theme's dist/base/pageTheme.esm.js) or the
  // earlier all-red version this replaces.
  pageTheme: Object.fromEntries(
    ['home', 'documentation', 'tool', 'service', 'website', 'library', 'other', 'app', 'apis', 'card'].map(
      key => [
        key,
        genPageTheme({
          colors: [NEUTRAL.background, NEUTRAL.background],
          shape: shapes.wave,
          options: { fontColor: NEUTRAL.textPrimary },
        }),
      ],
    ),
  ),
});
