/**
 * Single source of truth for the color rulebook: brand red shows up in at
 * most 1-2 spots per screen (logo, one primary CTA, the nav-selected
 * indicator) — never as a card/banner background, never on peer buttons
 * ("Choose" among many equal template cards), and never reused for error
 * states (a different, more orange-leaning red signals "broken", so it's
 * never mistaken for "the button to press").
 */

/** Brand red — logo, the sidebar's selected-item indicator, and (at most one) primary CTA per screen. Never a card/banner background or a secondary button. */
export const BRAND_RED = '#C8102E';

/** Surfaces and text — the vast majority of every screen. */
export const NEUTRAL = {
  background: '#FAFAFA',
  paper: '#FFFFFF',
  border: '#E0E0E0',
  textPrimary: '#1A1A1A',
  textSecondary: '#5F5F5F',
} as const;

/** Fixed meaning regardless of context — never reuse BRAND_RED for the error case. */
export const STATUS = {
  success: '#2E7D32',
  warning: '#F57C00',
  /** Deliberately more orange than BRAND_RED (#C8102E) so "broken" is never confused with "the button to press". */
  error: '#D32F2F',
} as const;

/** Entity/template category — a 4px strip or small badge, never a full card background. Add new categories here as tags grow. */
export const CATEGORY_COLORS: Record<string, string> = {
  mlops: '#64B5F6',
  llmops: '#9575CD',
  'llm-serving': '#1565C0',
  recsys: '#FFA726',
};

export const CATEGORY_FALLBACK_COLOR = '#9E9E9E';

/** Icons that aren't themselves a category symbol — neutral, never competing with content. */
export const ICON_NEUTRAL = '#6B6B6B';

/** First matching tag's category color, or the neutral fallback if no tag matches (order = precedence when a template carries more than one). */
export function categoryColorForTags(tags: readonly string[] | undefined): string {
  if (!tags) return CATEGORY_FALLBACK_COLOR;
  for (const tag of tags) {
    const color = CATEGORY_COLORS[tag];
    if (color) return color;
  }
  return CATEGORY_FALLBACK_COLOR;
}
