import { describe, expect, it } from 'vitest';
import { foundryConnectionFor } from './run-innovain-evaluation';
import { parseLocalRunArgs } from './run-local';

describe('official Foundry connection metadata', () => {
  it('records the Anthropic Messages API for an Azure-hosted Claude deployment', () => {
    const options = parseLocalRunArgs([
      '--provider',
      'anthropic',
      '--base-url',
      'https://innovain-test.services.ai.azure.com/anthropic/v1/',
      '--model',
      'claude-haiku-5-5',
    ]);

    expect(foundryConnectionFor(options)).toEqual({
      api: 'anthropic-messages-v1',
      authentication: 'x-api-key (secret not retained)',
    });
  });

  it('does not let a direct Anthropic endpoint enter Innovain Top 10 as a Foundry run', () => {
    const options = parseLocalRunArgs([
      '--provider',
      'anthropic',
      '--base-url',
      'https://api.anthropic.com/v1',
      '--model',
      'claude-haiku-5-5',
    ]);

    expect(() => foundryConnectionFor(options)).toThrow('/anthropic/v1 endpoint');
  });

  it('keeps Azure OpenAI evaluations on their existing API contract', () => {
    const options = parseLocalRunArgs([
      '--provider',
      'foundry',
      '--base-url',
      'https://innovain.openai.azure.com/openai/v1',
      '--model',
      'gpt-5.6-luna',
    ]);

    expect(foundryConnectionFor(options)).toEqual({
      api: 'azure-openai-v1',
      authentication: 'api-key (secret not retained)',
    });
  });

  it('accepts an explicit minimum interval between provider requests', () => {
    const options = parseLocalRunArgs([
      '--provider',
      'anthropic',
      '--base-url',
      'https://innovain-test.services.ai.azure.com/anthropic/v1',
      '--model',
      'claude-haiku-5-5',
      '--min-request-interval-ms',
      '61000',
    ]);

    expect(options.minRequestIntervalMs).toBe(61_000);
    expect(() =>
      parseLocalRunArgs([
        '--provider',
        'anthropic',
        '--model',
        'claude-haiku-5-5',
        '--min-request-interval-ms',
        '-1',
      ]),
    ).toThrow('--min-request-interval-ms must be a finite non-negative number.');
  });
});
