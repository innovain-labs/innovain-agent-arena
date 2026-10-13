import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { executeLocalRun, parseLocalRunArgs } from './run-local';

let server: Server | undefined;
afterEach(async () => {
  delete process.env.ARENA_TEST_API_KEY;
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((done) => server!.close(() => done()));
    server = undefined;
  }
});

async function outputPath() {
  await mkdir('work', { recursive: true });
  const directory = await mkdtemp(resolve('work/local-run-test-'));
  return resolve(directory, 'run.json');
}

describe('local runner against real MCP and a local provider fixture', () => {
  test('loads the selected briefing, authenticates locally, and imports an unpriced real MCP run', async () => {
    const requests: Array<{
      max_tokens: number;
      messages: Array<{ content?: string }>;
      tools: unknown[];
    }> = [];
    let authenticated = false;
    server = createServer(async (request, response) => {
      let body = '';
      for await (const chunk of request) body += String(chunk);
      requests.push(JSON.parse(body));
      authenticated = request.headers['api-key'] === 'local-fixture-key';
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          choices: [
            {
              message:
                requests.length === 1
                  ? {
                      tool_calls: [
                        {
                          id: 'call-1',
                          type: 'function',
                          function: { name: 'inspect_life_support', arguments: '{}' },
                        },
                      ],
                    }
                  : { content: 'Recorded telemetry inspected.' },
            },
          ],
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        }),
      );
    });
    await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Local provider fixture could not start.');
    process.env.ARENA_TEST_API_KEY = 'local-fixture-key';
    const output = await outputPath();
    const run = await executeLocalRun(
      parseLocalRunArgs([
        '--provider',
        'openai-compatible',
        '--model',
        'local-test',
        '--base-url',
        `http://127.0.0.1:${address.port}/v1`,
        '--api-key-env',
        'ARENA_TEST_API_KEY',
        '--auth-mode',
        'api-key',
        '--scenario',
        'scenarios/mars/power-blackout/scenario.yaml',
        '--max-output-tokens',
        '100',
        '--output',
        output,
      ]),
    );
    expect(authenticated).toBe(true);
    expect(requests[0]!.messages[1]!.content).toContain('Life Support Blackout');
    expect(requests[0]!.messages[0]!.content).not.toContain('stabilize Habitat B');
    expect(requests[1]!.max_tokens).toBe(90);
    expect(
      run.events.some(
        (event) => event.type === 'tool_called' && event.data.name === 'inspect_life_support',
      ),
    ).toBe(true);
    expect(run.metadata.cost).toBeUndefined();
    expect(run.metadata.usage?.totalTokens).toBe(60);
    expect(await readFile(output, 'utf8')).not.toContain('local-fixture-key');
  });

  test('writes a replay when a budget stop occurs before any provider call', async () => {
    const output = await outputPath();
    process.env.ARENA_TEST_API_KEY = 'local-fixture-key';
    const run = await executeLocalRun(
      parseLocalRunArgs([
        '--provider',
        'openai-compatible',
        '--model',
        'local-test',
        '--base-url',
        'http://127.0.0.1:1/v1',
        '--api-key-env',
        'ARENA_TEST_API_KEY',
        '--max-input-tokens',
        '1',
        '--output',
        output,
      ]),
    );
    expect(run.metadata.model?.configuration?.stopReason).toContain('BUDGET LIMIT REACHED');
    expect(run.metadata.usage?.totalTokens).toBe(0);
    expect(run.events.some((event) => event.type === 'tool_called')).toBe(false);
    expect(JSON.parse(await readFile(output, 'utf8')).metadata.official).toBe(false);
  });

  test('stops a stalled provider request at the configured timeout', async () => {
    server = createServer(() => {});
    await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
    const address = server.address();
    if (!address || typeof address === 'string')
      throw new Error('Local provider fixture could not start.');
    process.env.ARENA_TEST_API_KEY = 'local-fixture-key';
    await expect(
      executeLocalRun(
        parseLocalRunArgs([
          '--provider',
          'openai-compatible',
          '--model',
          'local-test',
          '--base-url',
          `http://127.0.0.1:${address.port}/v1`,
          '--api-key-env',
          'ARENA_TEST_API_KEY',
          '--request-timeout-ms',
          '50',
          '--output',
          await outputPath(),
        ]),
      ),
    ).rejects.toThrow(/timeout|aborted/i);
  });
});
