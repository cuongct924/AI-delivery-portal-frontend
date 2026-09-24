---
'@openchoreo/backstage-plugin-openchoreo-portal-assistant': minor
---

Make the Portal Assistant drawer easier to discover and use. The panel is now
persistent: opening it shrinks the page content to make room instead of
covering it with a dark scrim, and it can be resized by dragging its left edge
(or focusing the handle and using the arrow keys), with the width clamped to
the viewport and persisted across reloads. The empty state also greets the user
by name and renders the starter prompts as large, full-width suggestion pills
(mirroring the Gemini side panel) instead of small centred chips, so the
suggested questions are impossible to miss.
