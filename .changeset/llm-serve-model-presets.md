---
'app': patch
---

Serve LLM (Self-hosted) now offers a curated model preset dropdown. Picking a verified model (Llama 3.1, Qwen2.5, Mistral, Mixtral, Gemma 2, Phi-3.5) auto-fills the HuggingFace id, model name and a compute profile that fits it (GPU type/count, quantization, context length), so a Dev no longer has to know a 70B needs 4x A100 with int4-awq. A `Custom` option keeps the free-solo HuggingFace picker for hand-typed models, and the dropdown flips back to `Custom` if the id is edited by hand.
