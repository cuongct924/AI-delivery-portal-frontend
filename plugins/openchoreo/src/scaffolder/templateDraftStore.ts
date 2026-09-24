import { useEffect, useState } from 'react';

/**
 * A Golden Path template draft the Portal Assistant filled. Mirrors the
 * `template_draft` stream event; the drawer writes it, the Scaffolder form
 * (StepLayout) reads it and merges the values in live.
 */
export type TemplateDraft = {
  template: string;
  formData: Record<string, unknown>;
  /** Required fields the agent left out (branch-aware). */
  missing: string[];
  /** True when the draft passes the template's schema validation. */
  complete: boolean;
};

type Listener = (draft: TemplateDraft | null) => void;

// Module-level singleton: the drawer (portal-assistant plugin) and the
// Scaffolder form (packages/app) live in different React trees, so a shared
// context would need a common ancestor — a module store sidesteps that.
let current: TemplateDraft | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  listeners.forEach(listener => listener(current));
}

export function setTemplateDraft(draft: TemplateDraft): void {
  current = draft;
  emit();
}

export function clearTemplateDraft(): void {
  current = null;
  emit();
}

export function getTemplateDraft(): TemplateDraft | null {
  return current;
}

export function subscribeTemplateDraft(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Subscribe a component to the current draft (null when none). */
export function useTemplateDraft(): TemplateDraft | null {
  const [draft, setDraft] = useState<TemplateDraft | null>(current);
  useEffect(() => subscribeTemplateDraft(setDraft), []);
  return draft;
}
