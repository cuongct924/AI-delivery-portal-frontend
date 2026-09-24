---
'app': patch
---

Serve LLM (Self-hosted) no longer 403s when `releaseStrategy=instant` is picked without the `llm-ops-admin` role. The form decodes the signed-in user's Thunder token, warns when the role is missing, and falls back to `pr-gated` so the run succeeds; it confirms availability when the role is present. Fails open when auth is disabled or the token is undecodable.
