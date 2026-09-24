import { trainingPresetUpdates } from './trainingPresets';

describe('training presets', () => {
  it('replaces stale fraud settings when selecting revenue forecasting', () => {
    expect(
      trainingPresetUpdates({
        useCase: 'revenue-forecast',
        modelName: 'fraud-detection-demo',
        targetColumn: 'is_fraud',
        idColumns: ['transaction_id'],
        algorithm: 'RandomForestClassifier',
      }),
    ).toEqual({
      modelName: 'revenue-forecast',
      targetColumn: 'revenue',
      idColumns: [],
      timeColumn: 'date',
      algorithm: 'LinearRegression',
    });
  });
  it('clears time ordering when switching to house prices', () => {
    expect(
      trainingPresetUpdates({
        useCase: 'house-price-prediction',
        timeColumn: 'date',
      }),
    ).toMatchObject({
      targetColumn: 'price',
      timeColumn: undefined,
      idColumns: [],
    });
  });
  it('preserves custom names and columns', () => {
    const updates = trainingPresetUpdates({
      useCase: 'house-price-prediction',
      modelName: 'my-model',
      targetColumn: 'my-label',
    });
    expect(updates).not.toHaveProperty('modelName');
    expect(updates).not.toHaveProperty('targetColumn');
  });
  it('does not invent presets for unsupported tasks', () => {
    expect(
      trainingPresetUpdates({ useCase: 'contract-entity-extraction' }),
    ).toEqual({});
  });
});
