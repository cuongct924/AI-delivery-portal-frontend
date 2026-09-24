import { ConfigReader } from '@backstage/config';
import { createSecurityScanAction } from './securityActions';
import { createMockContext, mockFetchResponses } from './actionsTestUtils';

const BASE_URL = 'http://orchestration-api.test';
const config = new ConfigReader({ orchestrationApi: { baseUrl: BASE_URL } });

describe('orchestration:security-scan', () => {
  it('outputs the posture and passes when no blocking finding is raised', async () => {
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: {
          passed: true,
          score: 100,
          findings: [],
          controls: [
            {
              id: 'input-guardrails',
              pillar: 'prompt-security',
              label: 'Input guardrails',
              status: 'enforced',
            },
          ],
        },
      },
    ]);
    const action = createSecurityScanAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      {
        goldenPath: 'llm-serve-deploy',
        stage: 'run',
        artifact: 'llama-3-8b',
        params: { inputGuardrails: true },
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(outputs.passed).toBe(true);
    expect(outputs.score).toBe(100);
    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/security/scan`,
      expect.objectContaining({
        body: JSON.stringify({
          golden_path: 'llm-serve-deploy',
          stage: 'run',
          artifact: 'llama-3-8b',
          params: { inputGuardrails: true },
        }),
      }),
    );
  });

  it('throws with the blocking findings when the scan fails', async () => {
    mockFetchResponses([
      {
        ok: true,
        body: {
          passed: false,
          score: 40,
          findings: [
            {
              control: 'audit-logging',
              pillar: 'inference-audit',
              severity: 'blocking',
              message: 'Inference audit trail: record every inference.',
            },
          ],
          controls: [],
        },
      },
    ]);
    const action = createSecurityScanAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      {
        goldenPath: 'llm-serve-deploy',
        stage: 'run',
        artifact: 'llama-3-8b',
      },
      '/tmp/workspace',
    );

    await expect(action.handler(ctx)).rejects.toThrow(
      /Security scan blocked llm-serve-deploy: audit-logging/,
    );
    expect(outputs.passed).toBe(false);
    expect(outputs.score).toBe(40);
  });
});
