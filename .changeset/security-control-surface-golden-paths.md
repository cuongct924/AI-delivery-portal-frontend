---
'app': patch
'@openchoreo/backstage-portal-app': patch
'backend': patch
---

Security control surface for the MLOps/LLMOps golden paths. Every golden path now carries a Security step that scans the run against four control surfaces — Model Registry Governance, Data Isolation, Prompt Security, Inference Audit — and blocks it on a policy violation (e.g. confidential data without PII masking, a non-dev promote without an approval gate, LLM serving without guardrails/tenant isolation/audit trail). The create wizard shows a live security-posture panel (score, blocking/warning findings, missing controls) next to the existing cost panel, and the task result reports the posture. Adds the `orchestration:security-scan` action, which calls orchestration-api's new `POST /security/scan` and records one audit event per scan.
