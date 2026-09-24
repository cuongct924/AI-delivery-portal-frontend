---
'@openchoreo/backstage-plugin-openchoreo-portal-assistant': patch
---

Make the Portal Assistant entry point unmistakable. The global FAB is now a labelled, extended "Ask AI" pill with a robot-head icon (instead of an unlabelled chat bubble), and it carries a red dot, a soft pulse and a persistent "Click to open chat" CTA bubble until the user dismisses it (X, persisted across reloads). The same robot glyph replaces the chat bubble on the contextual launchers, inline "Investigate" buttons and the drawer header, and the "Prompt for AI Agents" banner reuses it. The global FAB now hides while a contextual launcher (failed build / build overview) owns the bottom-right slot, so the two entry points no longer overlap.
