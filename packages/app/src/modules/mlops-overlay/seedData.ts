/**
 * Static MLOps data OpenChoreo's own domain model has no concept of
 * (MLflow model registry versions/metrics, dataset validation, KServe
 * canary split). Numbers mirror `examples/entities.yaml` and
 * `scripts/mock-orchestration-server.js` so the whole portal tells one
 * consistent story instead of showing different numbers in different
 * places.
 */

export type ModelVersionRow = {
  version: string;
  accuracy: number;
  f1: number;
  gatePassed: boolean;
};

export type DatasetCheckRow = {
  name: string;
  passed: boolean;
  detail: string;
};

export const MODEL_NAME = 'fraud-detection';

export const MODEL_VERSIONS: readonly ModelVersionRow[] = [
  { version: '2', accuracy: 0.96, f1: 0.93, gatePassed: true },
  { version: '1', accuracy: 0.94, f1: 0.9, gatePassed: true },
];

export const DATASET_CHECKS: readonly DatasetCheckRow[] = [
  { name: 'Schema match', passed: true, detail: '18/18 cột khớp schema kỳ vọng' },
  { name: 'Null ratio', passed: true, detail: 'Dưới ngưỡng 2% trên toàn bộ cột bắt buộc' },
  { name: 'Class balance', passed: true, detail: 'Tỷ lệ fraud/non-fraud trong khoảng cho phép' },
  { name: 'Drift vs. baseline', passed: false, detail: 'PSI = 0.31 trên feature "transaction_amount" — cần review' },
];

export const CANARY_SPLIT = { stable: 80, canary: 20 } as const;
