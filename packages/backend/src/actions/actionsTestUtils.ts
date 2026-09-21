/**
 * Shared test helpers for mlopsActions.test.ts and llmOpsActions.test.ts.
 */

/**
 * Builds a minimal mock of the Scaffolder `ActionContext` for a given
 * action's handler — there is no `@backstage/plugin-scaffolder-node-test-utils`
 * dependency in this repo, so the handful of members these actions actually
 * touch are stubbed by hand. `TAction` pins the mock to that action's exact
 * (inferred) input/output types.
 */
export function createMockContext<
  TAction extends { handler: (ctx: never) => Promise<void> },
>(
  input: Parameters<TAction['handler']>[0]['input'],
  workspacePath: string,
): {
  ctx: Parameters<TAction['handler']>[0];
  outputs: Record<string, unknown>;
} {
  const outputs: Record<string, unknown> = {};
  const mock = {
    logger: {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
      child: jest.fn(),
    },
    workspacePath,
    input,
    checkpoint: jest.fn(),
    output: jest.fn((name: string, value: unknown) => {
      outputs[name] = value;
    }),
    createTemporaryDirectory: jest.fn(),
    getInitiatorCredentials: jest.fn(),
    task: { id: 'test-task' },
  };
  // No official test-utils package for this Backstage version — a cast is
  // the standard way to hand a hand-rolled mock to a strongly-typed handler.
  return { ctx: mock as unknown as Parameters<TAction['handler']>[0], outputs };
}

export function mockFetchResponses(
  responses: readonly { readonly ok: boolean; readonly body: unknown }[],
): jest.Mock {
  const fetchMock = jest.fn();
  responses.forEach(({ ok, body }) => {
    fetchMock.mockImplementationOnce(async () => ({
      ok,
      status: ok ? 200 : 500,
      json: async () => body,
      text: async () => JSON.stringify(body),
    }));
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}
