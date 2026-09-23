import { ConfigReader } from '@backstage/config';
import { createNotebookAction } from './notebookActions';
import { createMockContext, mockFetchResponses } from './actionsTestUtils';

const BASE_URL = 'http://orchestration-api.test';
const config = new ConfigReader({ orchestrationApi: { baseUrl: BASE_URL } });

describe('orchestration:create-notebook', () => {
  it('posts the resource profile and outputs the notebook id and url', async () => {
    const fetchMock = mockFetchResponses([
      {
        ok: true,
        body: {
          notebook_id: 'nb-1234',
          url: 'http://jupyter.test/user/nb-1234',
          active: true,
        },
      },
    ]);
    const action = createNotebookAction({ config });
    const { ctx, outputs } = createMockContext<typeof action>(
      {
        environment: 'pytorch-cuda',
        cpuCores: 4,
        ramGb: 16,
        gpuType: 't4',
        gpuCount: 1,
        storageGb: 50,
        idleTimeoutMinutes: 30,
      },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/notebooks`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          environment: 'pytorch-cuda',
          cpu_cores: 4,
          ram_gb: 16,
          gpu_type: 't4',
          gpu_count: 1,
          storage_gb: 50,
          idle_timeout_minutes: 30,
        }),
      }),
    );
    expect(outputs.notebookId).toBe('nb-1234');
    expect(outputs.notebookUrl).toBe('http://jupyter.test/user/nb-1234');
  });

  it("sends the Scaffolder task's id as the Idempotency-Key header", async () => {
    const fetchMock = mockFetchResponses([
      { ok: true, body: { notebook_id: 'nb-1', url: null, active: true } },
    ]);
    const action = createNotebookAction({ config });
    const { ctx } = createMockContext<typeof action>(
      { environment: 'sklearn-cpu' },
      '/tmp/workspace',
    );

    await action.handler(ctx);

    expect(fetchMock).toHaveBeenCalledWith(
      `${BASE_URL}/notebooks`,
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': 'test-task' }),
      }),
    );
  });
});
