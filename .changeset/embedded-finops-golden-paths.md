---
'app': patch
'@openchoreo/backstage-portal-app': patch
'@openchoreo/backstage-plugin-openchoreo-observability': patch
'backend': patch
---

Embedded FinOps for the MLOps/LLMOps golden paths. The create wizard now shows a live pre-flight cost estimate (estimated cost, budget status, gate reasons, alternatives) in the form and again on the Review step, and the task result renders a cost recap card. The `cost-gate` steps run in `enforce` mode and surface cheaper alternatives. Cost Insights gains a `Golden path` dimension, and the monthly budget is now keyed per scope. Also enables Immer's MapSet plugin so the scaffolder task event stream no longer throws.
