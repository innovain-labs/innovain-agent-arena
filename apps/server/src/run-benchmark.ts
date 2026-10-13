import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { stringify } from 'yaml';
import type { ArenaEvent, Frame, Run, ToolCall, WorldState } from '@arena/arena-core';
import { AgentSession, rescuePlan, unsafePlan } from '@arena/agent-runner';
import {
  BudgetLedger,
  BudgetLimitError,
  DEFAULT_TOKEN_ESTIMATE,
  STANDARD_BENCHMARK_V1,
  aggregateCosts,
  benchmarkConfigurationKey,
  createCostRecord,
  createBudgetPolicy,
  classifyFailure,
  estimateBenchmark,
  isReusableOfficialResult,
  type BenchmarkDefinition,
  type BenchmarkModelResult,
  type ModelIdentity,
  type PricingSnapshot,
} from '@arena/benchmarking';
import { metrics, type ExperimentAttempt } from '@arena/experiments';
import { createMarsVariant, type MarsScenarioVariant } from '@arena/mars-world';
import { validateRun } from '@arena/replay';
import { calculateScore } from '@arena/scoring';
import { loadScenario } from './scenario-loader';
import { safeChildEnvironment } from './host-environment';

const root = resolve('.');
const baseScenarioPath = resolve('scenarios/mars/habitat-b-leak/scenario.yaml');

export const SCRIPTED_PRICING: PricingSnapshot = {
  id: 'arena-scripted-test-double-2026-09-17',
  provider: 'arena',
  model: 'scripted-test-double',
  modelVersion: 'v1',
  effectiveDate: '2026-09-17',
  inputUsdPerMillionTokens: 0,
  outputUsdPerMillionTokens: 0,
  currency: 'USD',
  source: 'local deterministic test double; no provider billing',
};

function pricingForModel(model: ModelIdentity): PricingSnapshot {
  return {
    ...SCRIPTED_PRICING,
    id: `arena-${model.model}-${model.version ?? 'unversioned'}-2026-09-17`,
    model: model.model,
    modelVersion: model.version,
  };
}

function modelSlug(model: ModelIdentity): string {
  return `${model.provider}-${model.model}-${model.version ?? 'unversioned'}`
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-');
}

function planFor(model: ModelIdentity): ToolCall[] {
  return model.model.includes('risk') ? unsafePlan : rescuePlan;
}

function noCostUsage() {
  return { inputTokens: 0, outputTokens: 0, totalTokens: 0 } as const;
}

async function runModelAttempt(
  benchmark: BenchmarkDefinition,
  model: ModelIdentity,
  variant: MarsScenarioVariant,
  seed: number,
  outputDirectory: string,
): Promise<{ run: Run; toolCalls: number }> {
  const directory = resolve(outputDirectory, `seed-${seed}`);
  await mkdir(directory, { recursive: true });
  const variantDirectory = resolve(directory, 'variant');
  await mkdir(variantDirectory, { recursive: true });
  const variantPath = resolve(variantDirectory, `${seed}.yaml`);
  const recordPath = resolve(directory, 'mcp-record.json');
  await writeFile(variantPath, stringify(variant.scenario));
  const plan = planFor(model);
  const pricing = pricingForModel(model);
  const session = new AgentSession();
  try {
    const tools = await session.connect(
      process.execPath,
      ['--import', 'tsx', 'apps/server/src/mcp.ts'],
      root,
      {
        ...safeChildEnvironment(),
        ARENA_SCENARIO: variantPath,
        ARENA_RECORD_PATH: recordPath,
      },
    );
    if (tools.tools.length !== 9) throw new Error('Expected all nine Mars MCP tools.');
    for (const call of plan) await session.call(call);
  } finally {
    await session.close();
  }
  const recording = JSON.parse(await readFile(recordPath, 'utf8')) as {
    events: ArenaEvent[];
    frames: Frame[];
    state: WorldState;
  };
  const usage = noCostUsage();
  const run: Run = {
    formatVersion: 1,
    metadata: {
      id: `benchmark-${benchmark.benchmarkId}-${modelSlug(model)}-${seed}`,
      scenarioId: variant.scenario.metadata.id,
      scenarioName: variant.scenario.metadata.name,
      scenarioVersion: variant.scenario.schemaVersion,
      agent: `${model.provider}/${model.model}`,
      seed,
      recordedAt: '2026-09-17T00:10:00.000Z',
      protocol: 'MCP/stdio',
      briefing: await readFile(resolve('scenarios/mars/habitat-b-leak/briefing.md'), 'utf8'),
      scenario: variant.scenario,
      model,
      usage,
      cost: {
        status: 'not_applicable',
        currency: 'USD',
        estimatedUsd: 0,
        usage,
        pricingSnapshotId: pricing.id,
      },
      benchmarkId: benchmark.benchmarkId,
      benchmarkVersion: benchmark.benchmarkVersion,
      official: true,
    },
    events: recording.events,
    frames: recording.frames,
    finalOutcome: recording.state.outcome,
    score: calculateScore(
      recording.state,
      recording.events,
      variant.scenario.initialState.oxygenReserve,
      variant.scenario.modifiers.maximumTime,
      variant.scenario.scoring,
    ),
  };
  validateRun(run);
  await writeFile(resolve(directory, 'run.json'), JSON.stringify(run, null, 2) + '\n');
  return { run, toolCalls: plan.length };
}

export interface BenchmarkRunOptions {
  benchmark?: BenchmarkDefinition;
  models?: ModelIdentity[];
  budget?: Partial<ReturnType<typeof createBudgetPolicy>>;
  force?: boolean;
}

export async function runStandardBenchmark({
  benchmark = STANDARD_BENCHMARK_V1,
  models = [
    { provider: 'arena', model: 'scripted-rescue', version: 'v1' },
    { provider: 'arena', model: 'scripted-risk', version: 'v1' },
  ],
  budget: budgetOverrides = {},
  force = false,
}: BenchmarkRunOptions = {}): Promise<BenchmarkModelResult[]> {
  const base = await loadScenario(baseScenarioPath);
  const budgetPolicy = createBudgetPolicy({ ...benchmark.defaultBudget, ...budgetOverrides });
  const unsupported = models.filter(
    (model) => !['scripted-rescue', 'scripted-risk'].includes(model.model),
  );
  if (unsupported.length > 0)
    throw new Error(
      `No provider adapter or pricing snapshot is configured for: ${unsupported
        .map((model) => `${model.provider}/${model.model}`)
        .join(', ')}. Use a scripted model or add an explicit adapter first.`,
    );
  const estimate = estimateBenchmark(
    benchmark,
    models.map((identity) => ({ identity, pricing: pricingForModel(identity) })),
    budgetPolicy,
  );
  if (!estimate.safeToStart)
    throw new BudgetLimitError({
      allowed: false,
      reason: estimate.reason,
      projectedUsd: estimate.estimatedCost,
      remainingUsd: Math.max(0, budgetPolicy.maxUsd - estimate.estimatedCost),
    });
  const benchmarkDirectory = resolve('benchmarks', benchmark.benchmarkId);
  await mkdir(benchmarkDirectory, { recursive: true });
  await writeFile(
    resolve(benchmarkDirectory, 'benchmark.json'),
    JSON.stringify(
      {
        ...benchmark,
        defaultBudget: budgetPolicy,
        pricingSnapshots: models.map((model) => pricingForModel(model)),
      },
      null,
      2,
    ) + '\n',
  );
  const results: BenchmarkModelResult[] = [];
  for (const model of models) {
    const modelDirectory = resolve('benchmarks', benchmark.benchmarkId, 'models', modelSlug(model));
    const summaryPath = resolve(modelDirectory, 'summary.json');
    if (!force) {
      try {
        const existing = JSON.parse(await readFile(summaryPath, 'utf8')) as BenchmarkModelResult;
        if (isReusableOfficialResult(existing, benchmark, model)) {
          results.push(existing);
          continue;
        }
      } catch {
        // A missing or invalid artifact is not reusable and will be regenerated.
      }
    }
    await mkdir(modelDirectory, { recursive: true });
    const ledger = new BudgetLedger(budgetPolicy);
    const attempts: ExperimentAttempt[] = [];
    const runCosts = [] as NonNullable<Run['metadata']['cost']>[];
    const runRecords: BenchmarkModelResult['runs'] = [];
    for (const seed of benchmark.seeds) {
      const variant = createMarsVariant(base, seed, 'training', {
        varyLeakLocation: false,
        varyCrewLocation: false,
      });
      const plan = planFor(model);
      const reservation = ledger.reserve(
        {
          estimatedUsd: 0,
          usage: DEFAULT_TOKEN_ESTIMATE,
          toolCalls: plan.length,
        },
        1,
      );
      try {
        const result = await runModelAttempt(benchmark, model, variant, seed, modelDirectory);
        const cost = createCostRecord(noCostUsage(), pricingForModel(model), 0);
        cost.status = 'not_applicable';
        result.run.metadata.cost = cost;
        result.run.metadata.usage = noCostUsage();
        await writeFile(
          resolve(modelDirectory, `seed-${seed}`, 'run.json'),
          JSON.stringify(result.run, null, 2) + '\n',
        );
        ledger.settle(reservation, 0, noCostUsage());
        runCosts.push(cost);
        attempts.push({ attempt: attempts.length + 1, seed, split: 'training', run: result.run });
        runRecords.push({
          seed,
          runId: result.run.metadata.id,
          outcome: result.run.finalOutcome,
          score: result.run.score.total,
          toolCalls: result.toolCalls,
          retryCount: 0,
          failureClass: 'none',
        });
      } catch (error) {
        ledger.settle(reservation, 0, noCostUsage());
        runRecords.push({
          seed,
          runId: `${benchmark.benchmarkId}-${modelSlug(model)}-${seed}`,
          outcome: 'running',
          score: 0,
          toolCalls: plan.length,
          retryCount: 0,
          failureClass: classifyFailure(error),
        });
      }
    }
    const modelResult: BenchmarkModelResult = {
      formatVersion: 1,
      official: true,
      verified: attempts.length === benchmark.seeds.length,
      source: 'official',
      benchmarkId: benchmark.benchmarkId,
      benchmarkVersion: benchmark.benchmarkVersion,
      benchmarkConfigurationKey: benchmarkConfigurationKey(benchmark),
      scenarioVersion: benchmark.scenarioVersion,
      simulationVersion: benchmark.simulationVersion,
      evaluatorVersion: benchmark.evaluatorVersion,
      scoringVersion: benchmark.scoringVersion,
      toolContractVersion: benchmark.toolContractVersion,
      model,
      pricingSnapshot: pricingForModel(model),
      evaluatedAt: '2026-09-17',
      seeds: [...benchmark.seeds],
      runsCompleted: attempts.length,
      runReferences: attempts.map(
        (attempt) => `models/${modelSlug(model)}/seed-${attempt.seed}/run.json`,
      ),
      metrics: metrics(attempts),
      costs: aggregateCosts(
        runCosts,
        attempts.filter((attempt) => attempt.run.finalOutcome === 'success').length,
      ),
      runCosts,
      runs: runRecords,
      budget: ledger.snapshot(),
    };
    await writeFile(summaryPath, JSON.stringify(modelResult, null, 2) + '\n');
    results.push(modelResult);
  }
  return results;
}

function getOption(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/run-benchmark.ts')) {
  const force = process.argv.includes('--force');
  const models = getOption('--models', '').trim();
  const requestedModels = (models || 'scripted-rescue,scripted-risk').split(',').map((model) => ({
    provider: 'arena',
    model: model.trim(),
    version: 'v1',
  }));
  const budgetUsd = Number(
    getOption('--budget-usd', String(STANDARD_BENCHMARK_V1.defaultBudget.maxUsd)),
  );
  const maxRuns = Number(
    getOption('--max-runs', String(STANDARD_BENCHMARK_V1.defaultBudget.maxRuns)),
  );
  const maxInputTokens = Number(
    getOption('--max-input-tokens', String(STANDARD_BENCHMARK_V1.defaultBudget.maxInputTokens)),
  );
  const maxOutputTokens = Number(
    getOption('--max-output-tokens', String(STANDARD_BENCHMARK_V1.defaultBudget.maxOutputTokens)),
  );
  const maxAttempts = Number(
    getOption('--max-attempts', String(STANDARD_BENCHMARK_V1.defaultBudget.maxAttempts)),
  );
  const maxToolCallsPerRun = Number(
    getOption(
      '--max-tool-calls-per-run',
      String(STANDARD_BENCHMARK_V1.defaultBudget.maxToolCallsPerRun),
    ),
  );
  const maxConcurrentRuns = Number(
    getOption(
      '--max-concurrent-runs',
      String(STANDARD_BENCHMARK_V1.defaultBudget.maxConcurrentRuns),
    ),
  );
  const maxRetries = Number(
    getOption('--max-retries', String(STANDARD_BENCHMARK_V1.defaultBudget.maxRetries)),
  );
  try {
    const results = await runStandardBenchmark({
      models: requestedModels,
      budget: {
        maxUsd: budgetUsd,
        maxRuns,
        maxAttempts,
        maxInputTokens,
        maxOutputTokens,
        maxToolCallsPerRun,
        maxConcurrentRuns,
        maxRetries,
      },
      force,
    });
    console.log(
      JSON.stringify(
        results.map((result) => ({
          model: result.model,
          runsCompleted: result.runsCompleted,
          missionSuccessRate: result.metrics.missionSuccessRate,
          estimatedCost: result.costs.estimatedUsd,
          actualCost: result.costs.actualUsd ?? 0,
          reused: !force,
        })),
        null,
        2,
      ),
    );
  } catch (error) {
    if (error instanceof BudgetLimitError) {
      console.log(error.message);
      process.exitCode = 2;
    } else {
      throw error;
    }
  }
}
