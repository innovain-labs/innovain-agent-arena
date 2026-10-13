import { STANDARD_BENCHMARK_V1, estimateBenchmark, type ModelIdentity } from '@arena/benchmarking';
import { SCRIPTED_PRICING } from './run-benchmark';

function getOption(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}

const models = (getOption('--models', 'scripted-rescue,scripted-risk') || 'scripted-rescue')
  .split(',')
  .map((model): ModelIdentity => ({ provider: 'arena', model: model.trim(), version: 'v1' }));
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
  getOption('--max-concurrent-runs', String(STANDARD_BENCHMARK_V1.defaultBudget.maxConcurrentRuns)),
);
const maxRetries = Number(
  getOption('--max-retries', String(STANDARD_BENCHMARK_V1.defaultBudget.maxRetries)),
);
const estimate = estimateBenchmark(
  STANDARD_BENCHMARK_V1,
  models.map((identity) => ({ identity, pricing: SCRIPTED_PRICING })),
  {
    ...STANDARD_BENCHMARK_V1.defaultBudget,
    maxUsd: budgetUsd,
    maxRuns,
    maxInputTokens,
    maxOutputTokens,
    maxAttempts,
    maxToolCallsPerRun,
    maxConcurrentRuns,
    maxRetries,
  },
);
console.log(`Benchmark: ${estimate.benchmarkId} (${estimate.benchmarkVersion})`);
console.log(`Models: ${estimate.models}`);
console.log(`Planned runs: ${estimate.plannedRuns}`);
console.log(`Estimated input tokens: ${estimate.estimatedInputTokens}`);
console.log(`Estimated output tokens: ${estimate.estimatedOutputTokens}`);
console.log(`Estimated API cost: $${estimate.estimatedCost.toFixed(2)}`);
console.log(`Configured budget: $${estimate.configuredBudget.toFixed(2)}`);
console.log(`Safe to start: ${estimate.safeToStart ? 'YES' : 'NO'}`);
if (estimate.reason) console.log(`Budget note: ${estimate.reason}`);
console.log('NO API CALLS EXECUTED');
