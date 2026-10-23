import { createServer, type Server } from 'node:http';
import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { afterEach, describe, expect, test } from 'vitest';
import { executeLocalRun, parseLocalRunArgs } from './run-local';
import { loadScenario } from './scenario-loader';
import { verifyCommunityRun } from './community';

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
  test('records a model that stops before a terminal outcome as a replayable loss', async () => {
    server = createServer((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          model: 'fixture-model',
          choices: [{ message: { content: 'The mission appears stable.' } }],
          usage: { prompt_tokens: 20, completion_tokens: 8, total_tokens: 28 },
        }),
      );
    });
    await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fixture failed.');
    process.env.ARENA_TEST_API_KEY = 'early-stop-fixture-key';
    const output = await outputPath();
    const scenarioPath = 'scenarios/mars/habitat-b-leak-v2/scenario.yaml';
    const run = await executeLocalRun(
      parseLocalRunArgs([
        '--provider',
        'openai-compatible',
        '--model',
        'fixture-model',
        '--base-url',
        `http://127.0.0.1:${address.port}/v1`,
        '--api-key-env',
        'ARENA_TEST_API_KEY',
        '--scenario',
        scenarioPath,
        '--output',
        output,
      ]),
    );
    expect(run.finalOutcome).toBe('failure');
    expect(run.metadata.model?.configuration?.stopReason).toBe(
      'MODEL_STOPPED_BEFORE_TERMINAL_OUTCOME',
    );
    const canonical = await loadScenario(scenarioPath);
    await expect(
      verifyCommunityRun(run, canonical, { allowAgentStopped: true }),
    ).resolves.toMatchObject({
      finalOutcome: 'failure',
    });
    await expect(verifyCommunityRun(run, canonical)).rejects.toThrow('official model-stopped');
    expect(await readFile(output, 'utf8')).not.toContain('early-stop-fixture-key');
  });

  test('uses Azure GPT-5.6 tool-calling parameters and keeps the deployment identity in the replay', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    server = createServer(async (request, response) => {
      let raw = '';
      for await (const chunk of request) raw += String(chunk);
      bodies.push(JSON.parse(raw) as Record<string, unknown>);
      expect(request.url).toBe('/openai/v1/chat/completions');
      expect(request.headers['api-key']).toBe('foundry-fixture-key');
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          model: 'gpt-5.6-luna',
          choices: [
            {
              message:
                bodies.length === 1
                  ? {
                      tool_calls: [
                        {
                          id: 'inspect-1',
                          type: 'function',
                          function: { name: 'inspect_life_support', arguments: '{}' },
                        },
                      ],
                    }
                  : { content: 'Inspection complete.' },
            },
          ],
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        }),
      );
    });
    await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fixture failed.');
    process.env.ARENA_TEST_API_KEY = 'foundry-fixture-key';
    const output = await outputPath();
    const run = await executeLocalRun(
      parseLocalRunArgs([
        '--provider',
        'foundry',
        '--model',
        'gpt-5.6-luna',
        '--base-url',
        `http://127.0.0.1:${address.port}/openai/v1`,
        '--api-key-env',
        'ARENA_TEST_API_KEY',
        '--output',
        output,
      ]),
    );
    expect(bodies[0]).toMatchObject({
      model: 'gpt-5.6-luna',
      reasoning_effort: 'none',
      max_completion_tokens: 2000,
    });
    expect(bodies[0]).not.toHaveProperty('max_tokens');
    expect(run.metadata.model?.configuration?.providerReportedModel).toBe('gpt-5.6-luna');
    expect(await readFile(output, 'utf8')).not.toContain('foundry-fixture-key');
  });

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

  test('translates native Claude tool use and grouped tool results without exporting credentials', async () => {
    const bodies: Array<Record<string, unknown>> = [];
    server = createServer(async (request, response) => {
      let raw = '';
      for await (const chunk of request) raw += String(chunk);
      bodies.push(JSON.parse(raw));
      expect(request.url).toBe('/v1/messages');
      expect(request.headers['x-api-key']).toBe('claude-fixture-secret');
      expect(request.headers['anthropic-version']).toBe('2023-06-01');
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          content:
            bodies.length === 1
              ? [
                  { type: 'tool_use', id: 'inspect-1', name: 'inspect_life_support', input: {} },
                  {
                    type: 'tool_use',
                    id: 'inspect-2',
                    name: 'inspect_habitat',
                    input: { habitat: 'B' },
                  },
                ]
              : [{ type: 'text', text: 'Finished inspection.' }],
          usage: { input_tokens: 20, output_tokens: 10 },
        }),
      );
    });
    await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fixture failed.');
    process.env.ARENA_TEST_API_KEY = 'claude-fixture-secret';
    const output = await outputPath();
    const run = await executeLocalRun(
      parseLocalRunArgs([
        '--provider',
        'anthropic',
        '--model',
        'test-claude',
        '--base-url',
        `http://127.0.0.1:${address.port}/v1`,
        '--api-key-env',
        'ARENA_TEST_API_KEY',
        '--output',
        output,
      ]),
    );
    expect(run.metadata.usage?.totalTokens).toBe(60);
    expect(run.events.filter((event) => event.type === 'tool_called')).toHaveLength(2);
    const messages = bodies[1]!.messages as Array<{
      role: string;
      content: Array<{ type: string }>;
    }>;
    expect(messages.at(-1)?.role).toBe('user');
    expect(messages.at(-1)?.content.map((block) => block.type)).toEqual([
      'tool_result',
      'tool_result',
    ]);
    expect(await readFile(output, 'utf8')).not.toContain('claude-fixture-secret');
  });

  test('blocks a provider from echoing the key into MCP and preserves a safe partial replay', async () => {
    server = createServer((_request, response) => {
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    id: 'bad',
                    type: 'function',
                    function: {
                      name: 'request_human_assistance',
                      arguments: JSON.stringify({ reason: 'local-fixture-key' }),
                    },
                  },
                ],
              },
            },
          ],
          usage: { prompt_tokens: 20, completion_tokens: 10 },
        }),
      );
    });
    await new Promise<void>((done) => server!.listen(0, '127.0.0.1', done));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('Fixture failed.');
    process.env.ARENA_TEST_API_KEY = 'local-fixture-key';
    const output = await outputPath();
    await expect(
      executeLocalRun(
        parseLocalRunArgs([
          '--provider',
          'openai-compatible',
          '--model',
          'fixture',
          '--base-url',
          `http://127.0.0.1:${address.port}/v1`,
          '--api-key-env',
          'ARENA_TEST_API_KEY',
          '--output',
          output,
        ]),
      ),
    ).rejects.toThrow('echoed a credential');
    const raw = await readFile(output, 'utf8');
    expect(raw).not.toContain('local-fixture-key');
    expect(
      JSON.parse(raw).events.some((event: { type: string }) => event.type === 'tool_called'),
    ).toBe(false);
  });
});

test('local scripted v2 uses twelve discovered MCP tools and stamps a separate contract', async () => {
  const output = await outputPath();
  const run = await executeLocalRun(
    parseLocalRunArgs([
      '--provider',
      'scripted',
      '--model',
      'scripted-rescue',
      '--scenario',
      'scenarios/mars/habitat-b-leak-v2/scenario.yaml',
      '--output',
      output,
    ]),
  );
  expect(run.finalOutcome).toBe('success');
  expect(run.metadata.toolContractVersion).toBe('mars-mcp-v2');
  expect(run.metadata.scenarioVersion).toBe(2);
  expect(run.metadata.official).toBe(false);
  expect(run.events.some((event) => event.type === 'leak_repaired')).toBe(true);
});
