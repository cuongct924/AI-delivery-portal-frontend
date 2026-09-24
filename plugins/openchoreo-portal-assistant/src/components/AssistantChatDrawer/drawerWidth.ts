/**
 * Geometry + persistence helpers for the resizable assistant drawer.
 *
 * Kept in a standalone module (rather than inline in the drawer) because
 * the width is owned by {@link AssistantDrawerProvider} — it needs the
 * value to reserve space for the panel so the page content shrinks
 * instead of being covered.
 */

export const DEFAULT_DRAWER_WIDTH = 480;
export const MIN_DRAWER_WIDTH = 360;
export const MAX_DRAWER_WIDTH = 900;
export const DRAWER_WIDTH_STORAGE_KEY =
  'openchoreo.portalAssistant.drawerWidth';

export function maxDrawerWidth(): number {
  if (typeof window === 'undefined') return MAX_DRAWER_WIDTH;
  return Math.min(MAX_DRAWER_WIDTH, window.innerWidth - 48);
}

export function clampDrawerWidth(width: number): number {
  return Math.min(Math.max(width, MIN_DRAWER_WIDTH), maxDrawerWidth());
}

export function readStoredDrawerWidth(): number | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(DRAWER_WIDTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    // localStorage can throw in private-mode / sandboxed iframes.
    return null;
  }
}

export function persistDrawerWidth(width: number): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DRAWER_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // best-effort persistence.
  }
}
