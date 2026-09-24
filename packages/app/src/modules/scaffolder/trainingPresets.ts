/** Suggested inputs for the bundled datasets supported by platform training. */
export const trainingPresets: Readonly<
  Record<string, Readonly<Record<string, unknown>>>
> = {
  'telco-fraud-detection': {
    modelName: 'telco-fraud-detection',
    algorithm: 'RandomForestClassifier',
    targetColumn: 'is_fraud',
    idColumns: ['transaction_id'],
    timeColumn: undefined,
  },
  'network-anomaly-detection': {
    modelName: 'network-anomaly-detection',
    algorithm: 'IsolationForest',
    targetColumn: 'is_anomaly',
    idColumns: ['reading_id'],
    timeColumn: undefined,
  },
  'customer-segmentation': {
    modelName: 'customer-segmentation',
    algorithm: 'KMeans',
    targetColumn: undefined,
    idColumns: ['customer_id'],
    timeColumn: undefined,
  },
  'house-price-prediction': {
    modelName: 'house-price-prediction',
    algorithm: 'RandomForestRegressor',
    targetColumn: 'price',
    idColumns: [],
    timeColumn: undefined,
  },
  'revenue-forecast': {
    modelName: 'revenue-forecast',
    algorithm: 'LinearRegression',
    targetColumn: 'revenue',
    idColumns: [],
    timeColumn: 'date',
  },
};

/** Replace missing or previous preset values while preserving custom inputs. */
export function trainingPresetUpdates(
  data: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const preset =
    typeof data.useCase === 'string'
      ? trainingPresets[data.useCase]
      : undefined;
  if (!preset) return {};
  const updates: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(preset)) {
    const current = data[name];
    const isPresetValue = Object.values(trainingPresets).some(
      candidate => JSON.stringify(candidate[name]) === JSON.stringify(current),
    );
    const isLegacyDefault =
      name === 'modelName' && current === 'fraud-detection-demo';
    if (
      (current === undefined || isPresetValue || isLegacyDefault) &&
      JSON.stringify(current) !== JSON.stringify(value)
    ) {
      updates[name] = value;
    }
  }
  return updates;
}
