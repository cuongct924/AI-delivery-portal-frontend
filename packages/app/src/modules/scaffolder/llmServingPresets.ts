/**
 * Curated, verified model presets for llm-serve-deploy. Picking one fills the
 * HuggingFace id + a sensible model name AND a compute profile that actually
 * fits the model, so a Dev doesn't have to know that a 70B needs 4x A100 with
 * int4-awq. `custom` leaves every field as-is for a hand-typed model.
 *
 * The compute values are deliberately conservative and stay inside the
 * template's own enum/allOf constraints (e.g. A100 has no fp8, B200 has no
 * int8) — the live gpuRecommendationPanel still re-checks against the backend
 * estimator, this is only the starting point.
 */
export interface LlmServingPreset {
  /** Human label shown in the dropdown. */
  label: string;
  huggingFaceModelId: string;
  modelName: string;
  gpuType: string;
  gpuCount: number;
  quantization: string;
  maxContextLength: number;
}

/** Sentinel preset key: keep whatever the Dev has typed. */
export const CUSTOM_MODEL_PRESET = 'custom';

export const llmServingPresets: Readonly<Record<string, LlmServingPreset>> = {
  'llama-3.1-8b-instruct': {
    label: 'Llama 3.1 8B Instruct (Meta) — L4 x1',
    huggingFaceModelId: 'meta-llama/Llama-3.1-8B-Instruct',
    modelName: 'llama-3.1-8b-instruct',
    gpuType: 'L4',
    gpuCount: 1,
    quantization: 'none',
    maxContextLength: 8192,
  },
  'llama-3.1-70b-instruct': {
    label: 'Llama 3.1 70B Instruct (Meta) — A100 x4, int4-awq',
    huggingFaceModelId: 'meta-llama/Llama-3.1-70B-Instruct',
    modelName: 'llama-3.1-70b-instruct',
    gpuType: 'A100',
    gpuCount: 4,
    quantization: 'int4-awq',
    maxContextLength: 8192,
  },
  'qwen2.5-7b-instruct': {
    label: 'Qwen2.5 7B Instruct (Alibaba) — L4 x1',
    huggingFaceModelId: 'Qwen/Qwen2.5-7B-Instruct',
    modelName: 'qwen2.5-7b-instruct',
    gpuType: 'L4',
    gpuCount: 1,
    quantization: 'none',
    maxContextLength: 8192,
  },
  'qwen2.5-32b-instruct': {
    label: 'Qwen2.5 32B Instruct (Alibaba) — A100 x2, int8',
    huggingFaceModelId: 'Qwen/Qwen2.5-32B-Instruct',
    modelName: 'qwen2.5-32b-instruct',
    gpuType: 'A100',
    gpuCount: 2,
    quantization: 'int8',
    maxContextLength: 8192,
  },
  'mistral-7b-instruct': {
    label: 'Mistral 7B Instruct (Mistral AI) — L4 x1',
    huggingFaceModelId: 'mistralai/Mistral-7B-Instruct-v0.3',
    modelName: 'mistral-7b-instruct-v0.3',
    gpuType: 'L4',
    gpuCount: 1,
    quantization: 'none',
    maxContextLength: 8192,
  },
  'mixtral-8x7b-instruct': {
    label: 'Mixtral 8x7B Instruct (Mistral AI) — A100 x4, int8',
    huggingFaceModelId: 'mistralai/Mixtral-8x7B-Instruct-v0.1',
    modelName: 'mixtral-8x7b-instruct-v0.1',
    gpuType: 'A100',
    gpuCount: 4,
    quantization: 'int8',
    maxContextLength: 8192,
  },
  'gemma-2-9b-it': {
    label: 'Gemma 2 9B IT (Google) — L4 x1',
    huggingFaceModelId: 'google/gemma-2-9b-it',
    modelName: 'gemma-2-9b-it',
    gpuType: 'L4',
    gpuCount: 1,
    quantization: 'none',
    maxContextLength: 8192,
  },
  'phi-3.5-mini-instruct': {
    label: 'Phi-3.5 Mini Instruct (Microsoft) — L4 x1',
    huggingFaceModelId: 'microsoft/Phi-3.5-mini-instruct',
    modelName: 'phi-3.5-mini-instruct',
    gpuType: 'L4',
    gpuCount: 1,
    quantization: 'none',
    maxContextLength: 4096,
  },
};

/** Preset keys in dropdown order, with the `custom` sentinel first. */
export const llmServingPresetKeys: string[] = [
  CUSTOM_MODEL_PRESET,
  ...Object.keys(llmServingPresets),
];

/** Friendly dropdown label for a preset key (falls back to the raw key). */
export function llmServingPresetLabel(key: string): string {
  if (key === CUSTOM_MODEL_PRESET)
    return 'Custom model (type a HuggingFace id)';
  return llmServingPresets[key]?.label ?? key;
}

/**
 * The formData patch a preset selection applies. `custom` (or an unknown key)
 * returns an empty patch so the Dev's own values are left untouched.
 */
export function llmServingPresetUpdates(
  presetKey: unknown,
): Record<string, unknown> {
  if (typeof presetKey !== 'string') return {};
  const preset = llmServingPresets[presetKey];
  if (!preset) return {};
  return {
    huggingFaceModelId: preset.huggingFaceModelId,
    modelName: preset.modelName,
    gpuType: preset.gpuType,
    gpuCount: preset.gpuCount,
    quantization: preset.quantization,
    maxContextLength: preset.maxContextLength,
  };
}

/**
 * True when `huggingFaceModelId` still matches the selected preset — used to
 * flip the dropdown back to `custom` once a Dev hand-edits the id, so the
 * dropdown never claims a preset the form no longer holds.
 */
export function matchesLlmServingPreset(
  presetKey: unknown,
  huggingFaceModelId: unknown,
): boolean {
  if (typeof presetKey !== 'string' || presetKey === CUSTOM_MODEL_PRESET) {
    return true;
  }
  const preset = llmServingPresets[presetKey];
  if (!preset) return true;
  return preset.huggingFaceModelId === huggingFaceModelId;
}
