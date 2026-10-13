import { describe, expect, it } from 'vitest';
import { nextProviderCall, parseLocalRunArgs, pricingFor, redactSecrets } from './run-local';
import { safeChildEnvironment } from './host-environment';

describe('local runner safety boundary', () => {
  it('excludes a provider credential even when its custom environment name has no secret keyword', () => {
    expect(
      safeChildEnvironment(['FIXTURE_AUTH'], {
        FIXTURE_AUTH: 'fixture-value',
        AZURE_API_KEY: 'another-fixture',
        PATH: 'fixture-path',
      }),
    ).toEqual({ PATH: 'fixture-path' });
  });
  it('parses a bounded scripted invocation', () => {
    const options = parseLocalRunArgs([
      '--',
      '--provider',
      'scripted',
      '--model',
      'scripted-rescue',
      '--budget-usd',
      '0',
      '--max-tool-calls',
      '6',
      '--output',
      'runs/test.json',
    ]);
    expect(options.provider).toBe('scripted');
    expect(options.maxToolCalls).toBe(6);
    expect(options.budgetUsd).toBe(0);
  });

  it('redacts credentials from provider errors', () => {
    const key = 'sk-test-secret-value';
    expect(redactSecrets(`authorization: Bearer ${key}`, [key])).toContain('[REDACTED]');
    expect(redactSecrets(`OPENAI_API_KEY=${key}`, [key])).not.toContain(key);
  });

  it('allows a paid provider run without a pricing snapshot', () => {
    const options = parseLocalRunArgs(['--provider', 'openai', '--model', 'gpt-test']);
    expect(options.provider).toBe('openai');
    expect(options.apiKeyEnv).toBe('OPENAI_API_KEY');
    expect(options.inputPriceUsdPerMillion).toBeUndefined();
    expect(pricingFor(options)).toBeUndefined();
  });

  it('requires both prices when cost calculation is enabled', () => {
    const options = parseLocalRunArgs([
      '--provider',
      'openai',
      '--model',
      'gpt-test',
      '--input-price-usd-per-million',
      '0.4',
    ]);
    expect(() => pricingFor(options)).toThrow('Provide both');
  });

  it('creates a pricing snapshot when both rates are supplied', () => {
    const options = parseLocalRunArgs([
      '--provider',
      'openai',
      '--model',
      'gpt-test',
      '--input-price-usd-per-million',
      '0.4',
      '--output-price-usd-per-million',
      '1.6',
    ]);
    expect(pricingFor(options)).toMatchObject({
      inputUsdPerMillionTokens: 0.4,
      outputUsdPerMillionTokens: 1.6,
    });
  });

  it('parses an OpenAI-compatible endpoint without storing a credential', () => {
    const options = parseLocalRunArgs([
      '--provider',
      'openai-compatible',
      '--base-url',
      'https://example.test/openai/v1/',
      '--model',
      'azure-deployment',
      '--api-key-env',
      'AZURE_OPENAI_API_KEY',
      '--auth-mode',
      'api-key',
    ]);
    expect(options.baseUrl).toBe('https://example.test/openai/v1/');
    expect(options.apiKeyEnv).toBe('AZURE_OPENAI_API_KEY');
    expect(options.authMode).toBe('api-key');
    expect(JSON.stringify(options)).not.toContain('secret');
  });

  it('requires a base URL for an OpenAI-compatible endpoint', () => {
    expect(() => parseLocalRunArgs(['--provider', 'openai-compatible'])).toThrow(
      '--base-url or OPENAI_COMPATIBLE_BASE_URL',
    );
  });

  it('blocks the next request before exceeding input usage', () => {
    const options = parseLocalRunArgs(['--max-input-tokens', '10']);
    expect(() =>
      nextProviderCall(
        options,
        { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        [{ role: 'user', content: 'Mission briefing' }],
        [],
      ),
    ).toThrow('input token limit');
  });

  it('caps each response by the remaining cumulative output allowance', () => {
    const options = parseLocalRunArgs(['--max-output-tokens', '100']);
    expect(
      nextProviderCall(options, { inputTokens: 0, outputTokens: 90, totalTokens: 90 }, [], [])
        .maxOutputTokens,
    ).toBe(10);
    expect(() =>
      nextProviderCall(options, { inputTokens: 0, outputTokens: 100, totalTokens: 100 }, [], []),
    ).toThrow('output token budget');
  });

  it('rejects a request whose input estimate alone consumes the priced budget', () => {
    const options = parseLocalRunArgs([
      '--provider',
      'openai',
      '--budget-usd',
      '0',
      '--input-price-usd-per-million',
      '100',
      '--output-price-usd-per-million',
      '100',
    ]);
    expect(() =>
      nextProviderCall(
        options,
        { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        [],
        [],
        pricingFor(options),
      ),
    ).toThrow('output token budget');
  });

  it('bounds provider requests with a positive timeout', () => {
    expect(parseLocalRunArgs(['--request-timeout-ms', '2500']).requestTimeoutMs).toBe(2500);
    expect(() => parseLocalRunArgs(['--request-timeout-ms', '0'])).toThrow('positive');
  });
  it('does not round a small paid request down to a zero-dollar budget', () => {
    const options = parseLocalRunArgs([
      '--provider',
      'openai',
      '--budget-usd',
      '0',
      '--input-price-usd-per-million',
      '1',
      '--output-price-usd-per-million',
      '1',
    ]);
    expect(() =>
      nextProviderCall(
        options,
        { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        [],
        [],
        pricingFor(options),
      ),
    ).toThrow('output token budget');
  });
});
