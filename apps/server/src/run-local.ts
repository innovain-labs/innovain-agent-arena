import { mkdir, mkdtemp, readFile, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ArenaEvent, Frame, Run, WorldState } from '@arena/arena-core';
import {
  BudgetLimitError,
  createBudgetPolicy,
  createCostRecord,
  estimateCost,
  type PricingSnapshot,
} from '@arena/benchmarking';
import { AgentSession, scriptedPlanFor } from '@arena/agent-runner';
import { MarsSimulation } from '@arena/mars-world';
import { loadScenario } from './scenario-loader';
import { safeChildEnvironment } from './host-environment';
import { calculateScore } from '@arena/scoring';
import { validateRun } from '@arena/replay';

type ProviderName =
  'scripted' | 'openai' | 'ollama' | 'openai-compatible' | 'anthropic' | 'deepseek' | 'foundry';
type AuthMode = 'bearer' | 'api-key';
type ToolDefinition = { name: string; description?: string; inputSchema?: unknown };
type ProviderMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
};
type ProviderResponse = {
  model?: string;
  choices?: Array<{
    message?: { content?: string | null; tool_calls?: ProviderMessage['tool_calls'] };
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

export interface LocalRunOptions {
  provider: ProviderName;
  model: string;
  baseUrl?: string;
  apiKeyEnv: string;
  authMode: AuthMode;
  scenarioPath?: string;
  seed: number;
  outputPath: string;
  budgetUsd: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxToolCalls: number;
  requestTimeoutMs: number;
  inputPriceUsdPerMillion?: number;
  outputPriceUsdPerMillion?: number;
}

export function redactSecrets(value: string, secrets: string[] = []): string {
  let redacted = value;
  for (const secret of secrets.filter((item) => item.length > 0))
    redacted = redacted.split(secret).join('[REDACTED]');
  return redacted.replaceAll(
    /(api[_-]?key|authorization|bearer)\s*[:=]\s*[^\s,}]+/gi,
    '$1=[REDACTED]',
  );
}

function parseNumber(args: Map<string, string>, name: string, fallback: number): number {
  const value = args.get(name);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0)
    throw new Error(`--${name} must be a finite non-negative number.`);
  return parsed;
}

export function parseLocalRunArgs(argv: string[]): LocalRunOptions {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]!;
    if (token === '--') continue;
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const name = token.slice(2);
    if (
      ![
        'provider',
        'model',
        'base-url',
        'api-key-env',
        'auth-mode',
        'scenario',
        'seed',
        'output',
        'budget-usd',
        'max-input-tokens',
        'max-output-tokens',
        'max-tool-calls',
        'request-timeout-ms',
        'input-price-usd-per-million',
        'output-price-usd-per-million',
      ].includes(name)
    )
      throw new Error(`Unknown option --${name}. Run arena --help.`);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`--${name} requires a value.`);
    values.set(name, value);
    index += 1;
  }
  const provider = (values.get('provider') ?? 'scripted') as ProviderName;
  if (
    ![
      'scripted',
      'openai',
      'ollama',
      'openai-compatible',
      'anthropic',
      'deepseek',
      'foundry',
    ].includes(provider)
  )
    throw new Error(
      'Provider must be scripted, openai, ollama, openai-compatible, anthropic, deepseek, or foundry.',
    );
  const baseUrl = values.get('base-url') ?? process.env.OPENAI_COMPATIBLE_BASE_URL;
  if ((provider === 'openai-compatible' || provider === 'foundry') && !baseUrl)
    throw new Error(
      'The openai-compatible provider requires --base-url or OPENAI_COMPATIBLE_BASE_URL.',
    );
  if (baseUrl) validateProviderUrl(baseUrl);
  const authMode = (values.get('auth-mode') ??
    (provider === 'foundry' ? 'api-key' : 'bearer')) as AuthMode;
  if (!['bearer', 'api-key'].includes(authMode))
    throw new Error('Auth mode must be bearer or api-key.');
  const model =
    values.get('model') ?? (provider === 'scripted' ? 'scripted-rescue' : 'gpt-4o-mini');
  if (provider !== 'scripted' && !values.get('model'))
    throw new Error('--model is required: use a model or deployment available in your account.');
  const requestTimeoutMs = Math.trunc(parseNumber(values, 'request-timeout-ms', 30_000));
  if (requestTimeoutMs < 1) throw new Error('--request-timeout-ms must be positive.');
  return {
    provider,
    model,
    baseUrl,
    apiKeyEnv:
      values.get('api-key-env') ??
      process.env.OPENAI_COMPATIBLE_API_KEY_ENV ??
      (
        {
          openai: 'OPENAI_API_KEY',
          anthropic: 'ANTHROPIC_API_KEY',
          deepseek: 'DEEPSEEK_API_KEY',
          foundry: 'AZURE_OPENAI_API_KEY',
        } as Record<string, string>
      )[provider] ??
      'OPENAI_COMPATIBLE_API_KEY',
    authMode,
    scenarioPath: values.get('scenario'),
    seed: Math.trunc(parseNumber(values, 'seed', 183)),
    outputPath:
      values.get('output') ??
      resolve(
        'runs',
        `local-${provider}-${model.replaceAll(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`,
      ),
    budgetUsd: parseNumber(
      values,
      'budget-usd',
      provider === 'ollama' || provider === 'scripted' ? 0 : 1,
    ),
    maxInputTokens: Math.trunc(parseNumber(values, 'max-input-tokens', 20_000)),
    maxOutputTokens: Math.trunc(parseNumber(values, 'max-output-tokens', 2_000)),
    maxToolCalls: Math.trunc(parseNumber(values, 'max-tool-calls', 60)),
    requestTimeoutMs,
    inputPriceUsdPerMillion: values.has('input-price-usd-per-million')
      ? parseNumber(values, 'input-price-usd-per-million', 0)
      : undefined,
    outputPriceUsdPerMillion: values.has('output-price-usd-per-million')
      ? parseNumber(values, 'output-price-usd-per-million', 0)
      : undefined,
  };
}

export function validateProviderUrl(value: string) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash)
    throw new Error('Provider URL must not contain credentials, query parameters, or fragments.');
  if (
    url.protocol !== 'https:' &&
    !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))
  )
    throw new Error('Remote providers require HTTPS; HTTP is allowed only on loopback.');
  return url;
}

export function pricingFor(options: LocalRunOptions): PricingSnapshot | undefined {
  const hasInputPrice = options.inputPriceUsdPerMillion !== undefined;
  const hasOutputPrice = options.outputPriceUsdPerMillion !== undefined;
  if (hasInputPrice !== hasOutputPrice) {
    throw new Error(
      'Provide both --input-price-usd-per-million and --output-price-usd-per-million, or omit both for an unpriced local run.',
    );
  }
  const providerHasNoApiBilling = options.provider === 'ollama' || options.provider === 'scripted';
  if (!providerHasNoApiBilling && !hasInputPrice) return undefined;
  const input = options.inputPriceUsdPerMillion ?? 0;
  const output = options.outputPriceUsdPerMillion ?? 0;
  return {
    id: `local-${options.provider}-${options.model}-pricing-v1`,
    provider: options.provider,
    model: options.model,
    effectiveDate: new Date().toISOString().slice(0, 10),
    inputUsdPerMillionTokens: input,
    outputUsdPerMillionTokens: output,
    currency: 'USD',
    source: providerHasNoApiBilling
      ? 'local execution; no provider billing'
      : 'user-supplied CLI pricing snapshot',
  };
}

function toolSchemas(tools: ToolDefinition[]) {
  return tools.map((tool) => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description ?? '',
      parameters: tool.inputSchema ?? { type: 'object', properties: {} },
    },
  }));
}

async function callChatProvider(
  options: LocalRunOptions,
  messages: ProviderMessage[],
  tools: ToolDefinition[],
  apiKey?: string,
  maxOutputTokens = options.maxOutputTokens,
): Promise<ProviderResponse> {
  const baseUrl =
    options.baseUrl ??
    (options.provider === 'ollama'
      ? 'http://127.0.0.1:11434/v1'
      : options.provider === 'anthropic'
        ? 'https://api.anthropic.com/v1'
        : options.provider === 'deepseek'
          ? 'https://api.deepseek.com/v1'
          : 'https://api.openai.com/v1');
  if (!baseUrl) throw new Error('An OpenAI-compatible base URL is required.');
  validateProviderUrl(baseUrl);
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const isGpt56 = /^gpt-5\.6(?:-|$)/i.test(options.model);
  const url = normalizedBaseUrl.endsWith('/chat/completions')
    ? normalizedBaseUrl
    : `${normalizedBaseUrl}/${options.provider === 'anthropic' ? 'messages' : 'chat/completions'}`;
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (apiKey) {
    if (options.provider === 'anthropic') headers['x-api-key'] = apiKey;
    else if (options.authMode === 'api-key') headers['api-key'] = apiKey;
    else headers.authorization = `Bearer ${apiKey}`;
  }
  if (options.provider === 'anthropic') headers['anthropic-version'] = '2023-06-01';
  const anthropicMessages: Array<{ role: string; content: unknown[] }> = [];
  for (const message of messages.filter((item) => item.role !== 'system')) {
    const role = message.role === 'assistant' ? 'assistant' : 'user';
    const content: unknown[] =
      message.role === 'tool'
        ? [
            {
              type: 'tool_result',
              tool_use_id: message.tool_call_id,
              content: message.content ?? '',
            },
          ]
        : [
            ...(message.content ? [{ type: 'text', text: message.content }] : []),
            ...(message.tool_calls ?? []).map((call) => ({
              type: 'tool_use',
              id: call.id,
              name: call.function.name,
              input: JSON.parse(call.function.arguments),
            })),
          ];
    const last = anthropicMessages.at(-1);
    if (last?.role === role) last.content.push(...content);
    else anthropicMessages.push({ role, content });
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    redirect: 'error',
    body: JSON.stringify(
      options.provider === 'anthropic'
        ? {
            model: options.model,
            system: messages
              .filter((message) => message.role === 'system')
              .map((message) => message.content)
              .join('\n'),
            messages: anthropicMessages,
            tools: tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              input_schema: tool.inputSchema,
            })),
            max_tokens: maxOutputTokens,
          }
        : {
            model: options.model,
            messages,
            tools: toolSchemas(tools),
            ...(options.provider === 'deepseek' ? { thinking: { type: 'disabled' } } : {}),
            ...(isGpt56 ? { reasoning_effort: 'none' } : {}),
            ...(options.provider === 'openai' || (options.provider === 'foundry' && isGpt56)
              ? { max_completion_tokens: maxOutputTokens }
              : { max_tokens: maxOutputTokens }),
          },
    ),
    signal: AbortSignal.timeout(options.requestTimeoutMs),
  });
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = response.body?.getReader();
  if (reader)
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 2_000_000) {
          await reader.cancel();
          throw new Error('Provider response exceeds 2 MB.');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!response.ok)
    throw new Error(
      `Provider request failed (${response.status}): ${redactSecrets(raw, apiKey ? [apiKey] : [])}`,
    );
  if (options.provider === 'anthropic') {
    const result = JSON.parse(raw) as {
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }>;
      usage: {
        input_tokens: number;
        output_tokens: number;
        cache_creation_input_tokens?: number;
        cache_read_input_tokens?: number;
      };
    };
    return {
      choices: [
        {
          message: {
            content: result.content
              .filter((block) => block.type === 'text')
              .map((block) => block.text)
              .join('\n'),
            tool_calls: result.content
              .filter((block) => block.type === 'tool_use')
              .map((block) => ({
                id: block.id!,
                type: 'function',
                function: { name: block.name!, arguments: JSON.stringify(block.input) },
              })),
          },
        },
      ],
      usage: {
        prompt_tokens:
          result.usage.input_tokens +
          (result.usage.cache_creation_input_tokens ?? 0) +
          (result.usage.cache_read_input_tokens ?? 0),
        completion_tokens: result.usage.output_tokens,
      },
    };
  }
  return JSON.parse(raw) as ProviderResponse;
}

function usageFromResponse(response: ProviderResponse) {
  const inputTokens = response.usage?.prompt_tokens;
  const outputTokens = response.usage?.completion_tokens;
  if (
    inputTokens === undefined ||
    outputTokens === undefined ||
    !Number.isInteger(inputTokens) ||
    !Number.isInteger(outputTokens) ||
    inputTokens < 0 ||
    outputTokens < 0
  )
    throw new Error('Provider must report finite non-negative input and output token usage.');
  return {
    inputTokens,
    outputTokens,
    totalTokens: response.usage?.total_tokens ?? inputTokens + outputTokens,
  };
}

/** Conservative UTF-8 upper estimate; provider-specific accounting can still differ. */
function unroundedCost(
  usage: { inputTokens: number; outputTokens: number; totalTokens?: number },
  pricing: PricingSnapshot,
) {
  return (
    (usage.inputTokens * pricing.inputUsdPerMillionTokens +
      usage.outputTokens * pricing.outputUsdPerMillionTokens) /
    1_000_000
  );
}

export function nextProviderCall(
  options: LocalRunOptions,
  usage: { inputTokens: number; outputTokens: number; totalTokens: number },
  messages: ProviderMessage[],
  tools: ToolDefinition[],
  pricing?: PricingSnapshot,
) {
  const inputTokens =
    Buffer.byteLength(JSON.stringify({ messages, tools: toolSchemas(tools) }), 'utf8') +
    256 +
    messages.length * 64;
  const remainingOutput = options.maxOutputTokens - usage.outputTokens;
  let requestedOutput = remainingOutput;
  if (pricing) {
    const available =
      options.budgetUsd -
      unroundedCost(
        {
          inputTokens: usage.inputTokens + inputTokens,
          outputTokens: usage.outputTokens,
          totalTokens: usage.totalTokens + inputTokens,
        },
        pricing,
      );
    if (pricing.outputUsdPerMillionTokens > 0)
      requestedOutput = Math.min(
        requestedOutput,
        Math.floor((Math.max(0, available) * 1_000_000) / pricing.outputUsdPerMillionTokens),
      );
  }
  const estimate = {
    inputTokens: usage.inputTokens + inputTokens,
    outputTokens: usage.outputTokens + Math.max(0, requestedOutput),
    totalTokens: usage.totalTokens + inputTokens + Math.max(0, requestedOutput),
  };
  const projectedUsd = pricing ? unroundedCost(estimate, pricing) : 0;
  if (
    estimate.inputTokens > options.maxInputTokens ||
    requestedOutput < 1 ||
    (pricing && projectedUsd > options.budgetUsd)
  ) {
    throw new BudgetLimitError({
      allowed: false,
      reason:
        estimate.inputTokens > options.maxInputTokens
          ? 'next request would exceed the input token limit'
          : requestedOutput < 1
            ? 'no output token budget remains'
            : 'next request would exceed the USD budget',
      projectedUsd,
      remainingUsd: Math.max(0, options.budgetUsd - projectedUsd),
    });
  }
  return { maxOutputTokens: requestedOutput };
}

async function runLocal(options: LocalRunOptions): Promise<Run> {
  const scenarioPath = resolve(
    options.scenarioPath ?? 'scenarios/mars/habitat-b-leak-v2/scenario.yaml',
  );
  const scenario = await loadScenario(scenarioPath);
  const briefing = await readFile(resolve(dirname(scenarioPath), 'briefing.md'), 'utf8');
  const outputPath = resolve(options.outputPath);
  const workDirectory = await mkdtemp(resolve(tmpdir(), 'innovain-arena-'));
  const recordPath = resolve(workDirectory, 'mcp-record.json');
  const pricing = pricingFor(options);
  const policy = createBudgetPolicy({
    maxUsd: options.budgetUsd,
    maxRuns: 1,
    maxAttempts: 1,
    maxInputTokens: options.maxInputTokens,
    maxOutputTokens: options.maxOutputTokens,
    maxToolCallsPerRun: options.maxToolCalls,
    maxConcurrentRuns: 1,
    maxRetries: 0,
  });
  let stopReason: string | undefined;
  let fatalError: unknown;
  const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let toolCalls = 0;
  let providerReportedModel: string | undefined;
  let agentStoppedEarly = false;
  const session = new AgentSession();
  try {
    const listed = await session.connect(
      process.execPath,
      fileURLToPath(import.meta.url).endsWith('.mjs')
        ? [fileURLToPath(new URL('./mcp.mjs', import.meta.url))]
        : ['--import', 'tsx', 'apps/server/src/mcp.ts'],
      resolve('.'),
      {
        ...safeChildEnvironment([options.apiKeyEnv]),
        ARENA_SCENARIO: scenarioPath,
        ARENA_RECORD_PATH: recordPath,
      },
    );
    if (listed.tools.length !== (scenario.rulesVersion === 2 ? 12 : 9))
      throw new Error('Unexpected Mars MCP tool contract.');
    const tools = listed.tools as ToolDefinition[];
    if (options.provider === 'scripted') {
      const plan = scriptedPlanFor(
        scenario.metadata.id,
        options.model.includes('risk') || options.model.includes('unsafe'),
      );
      for (const call of plan) {
        if (toolCalls >= options.maxToolCalls)
          throw new BudgetLimitError({
            allowed: false,
            reason: `tool-call limit ${options.maxToolCalls} reached`,
            projectedUsd: 0,
            remainingUsd: options.budgetUsd,
          });
        await session.call(call);
        toolCalls += 1;
      }
    } else {
      const requiresApiKey = options.provider !== 'ollama';
      const apiKey = requiresApiKey ? process.env[options.apiKeyEnv] : undefined;
      if (requiresApiKey && !apiKey)
        throw new Error(
          `${options.apiKeyEnv} is required for the ${options.provider} provider and is read only from the local process environment.`,
        );
      const messages: ProviderMessage[] = [
        {
          role: 'system',
          content:
            'You are an evaluated Mars colony operations agent. Use only the available MCP tools and the public mission briefing. Protect the crew. Do not claim actions you did not execute. Human assistance records escalation but does not pause the incident.',
        },
        { role: 'user', content: briefing },
      ];
      let missionFinished = false;
      for (;;) {
        if (toolCalls >= policy.maxToolCallsPerRun)
          throw new BudgetLimitError({
            allowed: false,
            reason: 'tool-call limit reached before the next provider request',
            projectedUsd: pricing ? estimateCost(usage, pricing) : 0,
            remainingUsd: 0,
          });
        const limits = nextProviderCall(options, usage, messages, tools, pricing);
        const response = await callChatProvider(
          options,
          messages,
          tools,
          apiKey,
          limits.maxOutputTokens,
        );
        if (response.model) providerReportedModel = response.model;
        const currentUsage = usageFromResponse(response);
        usage.inputTokens += currentUsage.inputTokens;
        usage.outputTokens += currentUsage.outputTokens;
        usage.totalTokens += currentUsage.totalTokens;
        const projectedCost = pricing ? unroundedCost(usage, pricing) : undefined;
        if (
          usage.inputTokens > options.maxInputTokens ||
          usage.outputTokens > options.maxOutputTokens
        )
          throw new BudgetLimitError({
            allowed: false,
            reason: 'token limit reached during provider execution',
            projectedUsd: projectedCost ?? 0,
            remainingUsd:
              projectedCost === undefined ? 0 : Math.max(0, options.budgetUsd - projectedCost),
          });
        if (projectedCost !== undefined && projectedCost > options.budgetUsd)
          throw new BudgetLimitError({
            allowed: false,
            reason: `projected cost $${projectedCost.toFixed(2)} exceeds $${options.budgetUsd.toFixed(2)}`,
            projectedUsd: projectedCost,
            remainingUsd: 0,
          });
        const message = response.choices?.[0]?.message;
        if (!message) throw new Error('Provider returned no assistant message.');
        if (!message.tool_calls?.length) {
          if (!missionFinished) agentStoppedEarly = true;
          break;
        }
        messages.push({
          role: 'assistant',
          content: message.content ?? null,
          tool_calls: message.tool_calls,
        });
        for (const call of message.tool_calls) {
          if (apiKey && JSON.stringify(call).includes(apiKey))
            throw new Error('Provider echoed a credential; refusing to send it to MCP.');
          if (toolCalls >= options.maxToolCalls)
            throw new BudgetLimitError({
              allowed: false,
              reason: `tool-call limit ${options.maxToolCalls} reached`,
              projectedUsd: projectedCost ?? 0,
              remainingUsd:
                projectedCost === undefined ? 0 : Math.max(0, options.budgetUsd - projectedCost),
            });
          let args: Record<string, unknown>;
          try {
            args = JSON.parse(call.function.arguments) as Record<string, unknown>;
          } catch {
            throw new Error(`Provider returned invalid arguments for ${call.function.name}.`);
          }
          const result = await session.call({ name: call.function.name, arguments: args });
          toolCalls += 1;
          messages.push({
            role: 'tool',
            tool_call_id: call.id,
            name: call.function.name,
            content: JSON.stringify(result),
          });
          if (result.observation?.outcome && result.observation.outcome !== 'running') {
            missionFinished = true;
            break;
          }
        }
        if (missionFinished) break;
      }
    }
  } catch (error) {
    if (error instanceof BudgetLimitError) stopReason = error.message;
    else {
      stopReason = `PROVIDER OR MCP ERROR: ${redactSecrets(error instanceof Error ? error.message : String(error), [process.env[options.apiKeyEnv] ?? ''])}`;
      fatalError = error;
    }
  } finally {
    await session.close();
  }
  let recording = JSON.parse(await readFile(recordPath, 'utf8')) as {
    events: ArenaEvent[];
    frames: Frame[];
    state: WorldState;
  };
  if (agentStoppedEarly) {
    const replay = new MarsSimulation(scenario);
    for (const event of recording.events.filter((item) => item.type === 'tool_called'))
      replay.execute({
        name: String(event.data.name),
        arguments: event.data.arguments as Record<string, unknown>,
      });
    replay.markAgentStopped();
    recording = {
      events: replay.journal.events,
      frames: replay.journal.frames,
      state: replay.state,
    };
    stopReason = 'MODEL_STOPPED_BEFORE_TERMINAL_OUTCOME';
  }
  await unlink(recordPath);
  await rmdir(workDirectory);
  const actualUsd = pricing ? estimateCost(usage, pricing) : undefined;
  const cost =
    options.provider === 'scripted'
      ? {
          status: 'not_applicable' as const,
          currency: 'USD' as const,
          estimatedUsd: 0,
          actualUsd: 0,
          usage,
          ...(pricing ? { pricingSnapshotId: pricing.id } : {}),
        }
      : pricing && actualUsd !== undefined
        ? createCostRecord(usage, pricing)
        : undefined;
  const run: Run = {
    formatVersion: 1,
    metadata: {
      id: `local-${options.provider}-${options.model}-${options.seed}`,
      scenarioId: scenario.metadata.id,
      scenarioName: scenario.metadata.name,
      scenarioVersion: scenario.rulesVersion ?? 1,
      toolContractVersion: scenario.rulesVersion === 2 ? 'mars-mcp-v2' : 'mars-mcp-v1',
      agent: `${options.provider}/${options.model}`,
      seed: options.seed,
      recordedAt: new Date().toISOString(),
      protocol: 'MCP/stdio',
      briefing,
      scenario,
      model: {
        provider: options.provider,
        model: options.model,
        version: 'local-v1',
        configuration: {
          runner: 'local-v1',
          ...(providerReportedModel ? { providerReportedModel } : {}),
          ...(stopReason ? { stopReason } : {}),
          ...(options.provider === 'openai-compatible' ? { authMode: options.authMode } : {}),
        },
      },
      usage,
      ...(cost ? { cost } : {}),
      official: false,
    },
    events: recording.events,
    frames: recording.frames,
    finalOutcome: recording.state.outcome,
    score: calculateScore(
      recording.state,
      recording.events,
      scenario.initialState.oxygenReserve,
      scenario.modifiers.maximumTime,
      scenario.scoring,
    ),
  };
  validateRun(run);
  const secret = process.env[options.apiKeyEnv];
  if (secret && JSON.stringify(run).includes(secret))
    throw new Error('Credential detected in recording; refusing export.');
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(run, null, 2) + '\n');
  if (fatalError)
    throw new Error(
      redactSecrets(fatalError instanceof Error ? fatalError.message : String(fatalError), [
        process.env[options.apiKeyEnv] ?? '',
      ]),
    );
  return run;
}

export async function executeLocalRun(options: LocalRunOptions): Promise<Run> {
  return runLocal(options);
}

if (process.argv[1]?.endsWith('run-local.ts')) {
  try {
    const options = parseLocalRunArgs(process.argv.slice(2));
    const run = await executeLocalRun(options);
    if (run.metadata.model?.configuration?.stopReason) {
      console.log(String(run.metadata.model.configuration.stopReason));
      process.exitCode = 2;
    }
    console.log(
      `Local run written to ${resolve(options.outputPath)} (${run.finalOutcome}, score ${run.score.total}).`,
    );
    if (!run.metadata.cost && run.metadata.usage)
      console.log(
        `Token usage recorded (${run.metadata.usage.totalTokens} total); model cost was not calculated because no pricing snapshot was supplied.`,
      );
    console.log(
      'Credentials stayed in the local process and were not written to the run artifact.',
    );
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : String(error), [
      ...Object.entries(process.env)
        .filter(([name]) => /(key|token|secret|password|credential)/i.test(name))
        .map(([, value]) => value ?? ''),
    ]);
    console.error(message);
    process.exitCode = error instanceof BudgetLimitError ? 2 : 1;
  }
}
