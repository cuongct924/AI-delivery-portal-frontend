import {
  CUSTOM_MODEL_PRESET,
  llmServingPresetKeys,
  llmServingPresetLabel,
  llmServingPresetUpdates,
  llmServingPresets,
  matchesLlmServingPreset,
} from './llmServingPresets';

describe('llm serving presets', () => {
  it('patches the model id, name and a fitting compute profile', () => {
    expect(llmServingPresetUpdates('llama-3.1-70b-instruct')).toEqual({
      huggingFaceModelId: 'meta-llama/Llama-3.1-70B-Instruct',
      modelName: 'llama-3.1-70b-instruct',
      gpuType: 'A100',
      gpuCount: 4,
      quantization: 'int4-awq',
      maxContextLength: 8192,
    });
  });

  it('is a no-op for the custom sentinel and unknown keys', () => {
    expect(llmServingPresetUpdates(CUSTOM_MODEL_PRESET)).toEqual({});
    expect(llmServingPresetUpdates('nope')).toEqual({});
    expect(llmServingPresetUpdates(undefined)).toEqual({});
  });

  it('lists custom first, then every preset', () => {
    expect(llmServingPresetKeys[0]).toBe(CUSTOM_MODEL_PRESET);
    expect(llmServingPresetKeys).toHaveLength(
      Object.keys(llmServingPresets).length + 1,
    );
  });

  it('labels custom and falls back to the raw key', () => {
    expect(llmServingPresetLabel(CUSTOM_MODEL_PRESET)).toMatch(/Custom/);
    expect(llmServingPresetLabel('nope')).toBe('nope');
  });

  it('detects when a hand-edited id no longer matches the preset', () => {
    expect(
      matchesLlmServingPreset(
        'llama-3.1-8b-instruct',
        'meta-llama/Llama-3.1-8B-Instruct',
      ),
    ).toBe(true);
    expect(
      matchesLlmServingPreset('llama-3.1-8b-instruct', 'my-org/my-model'),
    ).toBe(false);
    expect(matchesLlmServingPreset(CUSTOM_MODEL_PRESET, 'anything')).toBe(true);
  });

  it('keeps every preset inside the template enum constraints', () => {
    const gpuTypes = ['L4', 'L40S', 'A100', 'H100', 'H200', 'B200'];
    const quantizations = ['none', 'fp8', 'int8', 'int4-awq'];
    const presets = Object.values(llmServingPresets);
    for (const preset of presets) {
      expect(gpuTypes).toContain(preset.gpuType);
      expect(quantizations).toContain(preset.quantization);
    }
    // A100 has no full FP8 compute; B200 has no INT8.
    expect(
      presets
        .filter(p => p.gpuType === 'A100')
        .every(p => p.quantization !== 'fp8'),
    ).toBe(true);
    expect(
      presets
        .filter(p => p.gpuType === 'B200')
        .every(p => p.quantization !== 'int8'),
    ).toBe(true);
  });
});
