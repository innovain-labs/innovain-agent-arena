import { describe, expect, test } from 'vitest';
import type { ExperimentMetrics } from '@arena/experiments';
import {
  BudgetLimitError,
  BudgetLedger,
  DEFAULT_BUDGET_POLICY,
  STANDARD_BENCHMARK_V1,
  aggregateCosts,
  buildLeaderboard,
  classifyFailure,
  createCostRecord,
  estimateBenchmark,
  estimateCost,
  isReusableOfficialResult,
  overallScore,
  retryAllowed,
} from './index';

const pricing = {
  id: 'test-pricing',
  provider: 'test',
  model: 'model',
  effectiveDate: '2026-09-17',
  inputUsdPerMillionTokens: 1,
  outputUsdPerMillionTokens: 2,
  cachedInputUsdPerMillionTokens: 0.5,
  currency: 'USD' as const,
  source: 'test',
};
const usage = {
  inputTokens: 1_000_000,
  outputTokens: 500_000,
  cachedInputTokens: 100_000,
  totalTokens: 1_500_000,
};
const metrics: ExperimentMetrics = {
  attempts: 10,
  missionSuccessRate: 0.8,
  crewSurvivalRate: 0.9,
  averageSafetyScore: 12,
  dangerousActions: 1,
  unnecessaryToolCalls: 2,
  averageTimeToStabilization: 10,
  averageOxygenUsed: 20,
  attemptsToSuccess: 1,
  scoreTrajectory: [],
};

describe('cost governance', () => {
  test('calculates token pricing and aggregates cost per success', () => {
    expect(estimateCost(usage, pricing)).toBe(1.95);
    const record = createCostRecord(usage, pricing, 1.25);
    expect(aggregateCosts([record], 1).costPerSuccessfulMission).toBe(1.25);
  });

  test('hard stops before a reservation exceeds the configured budget', () => {
    const ledger = new BudgetLedger({ ...DEFAULT_BUDGET_POLICY, maxUsd: 0.05 });
    const estimate = {
      estimatedUsd: 0.04,
      usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      toolCalls: 3,
    };
    const reservation = ledger.reserve(estimate);
    ledger.settle(reservation, 0.04);
    expect(() => ledger.reserve({ ...estimate, estimatedUsd: 0.02 })).toThrow(BudgetLimitError);
    expect(ledger.snapshot().spentUsd).toBe(0.04);
  });

  test('enforces finite run, attempt, token, and tool-call caps', () => {
    expect(Number.isFinite(DEFAULT_BUDGET_POLICY.maxUsd)).toBe(true);
    expect(DEFAULT_BUDGET_POLICY.maxRuns).toBeGreaterThan(0);
    expect(DEFAULT_BUDGET_POLICY.maxAttempts).toBeGreaterThan(0);
    const estimate = {
      estimatedUsd: 0,
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      toolCalls: 1,
    };
    const runLedger = new BudgetLedger({ ...DEFAULT_BUDGET_POLICY, maxRuns: 1 });
    runLedger.reserve(estimate);
    expect(() => runLedger.reserve(estimate)).toThrow(BudgetLimitError);
    const attemptLedger = new BudgetLedger({ ...DEFAULT_BUDGET_POLICY, maxAttempts: 1 });
    attemptLedger.reserve(estimate);
    expect(() => attemptLedger.reserve(estimate)).toThrow(BudgetLimitError);
    const concurrencyLedger = new BudgetLedger({ ...DEFAULT_BUDGET_POLICY, maxConcurrentRuns: 1 });
    concurrencyLedger.reserve(estimate);
    expect(() => concurrencyLedger.reserve(estimate)).toThrow(BudgetLimitError);
    expect(() =>
      new BudgetLedger({ ...DEFAULT_BUDGET_POLICY, maxInputTokens: 10 }).reserve({
        ...estimate,
        usage: { inputTokens: 11, outputTokens: 1, totalTokens: 12 },
      }),
    ).toThrow(BudgetLimitError);
    expect(() =>
      new BudgetLedger({ ...DEFAULT_BUDGET_POLICY, maxOutputTokens: 10 }).reserve({
        ...estimate,
        usage: { inputTokens: 1, outputTokens: 11, totalTokens: 12 },
      }),
    ).toThrow(BudgetLimitError);
    expect(() =>
      new BudgetLedger({ ...DEFAULT_BUDGET_POLICY, maxToolCallsPerRun: 1 }).reserve({
        ...estimate,
        toolCalls: 2,
      }),
    ).toThrow(BudgetLimitError);
  });

  test('classifies provider failures separately and bounds retries', () => {
    expect(classifyFailure(new Error('provider timeout'))).toBe('infrastructure_failure');
    expect(classifyFailure(new Error('invalid tool plan'))).toBe('model_failure');
    expect(retryAllowed(0, DEFAULT_BUDGET_POLICY)).toBe(true);
    expect(retryAllowed(DEFAULT_BUDGET_POLICY.maxRetries, DEFAULT_BUDGET_POLICY)).toBe(false);
  });
});

describe('standard benchmark contracts', () => {
  test('estimates the full suite without executing calls', () => {
    const estimate = estimateBenchmark(STANDARD_BENCHMARK_V1, [
      { identity: { provider: 'test', model: 'model' }, pricing },
    ]);
    expect(estimate.plannedRuns).toBe(10);
    expect(estimate.safeToStart).toBe(true);
  });

  test('ranks only verified official results and reuses exact identities/configuration', () => {
    const result = {
      formatVersion: 1 as const,
      official: true,
      verified: true,
      source: 'official' as const,
      benchmarkId: STANDARD_BENCHMARK_V1.benchmarkId,
      benchmarkVersion: STANDARD_BENCHMARK_V1.benchmarkVersion,
      benchmarkConfigurationKey: JSON.stringify({
        benchmarkId: STANDARD_BENCHMARK_V1.benchmarkId,
        benchmarkVersion: STANDARD_BENCHMARK_V1.benchmarkVersion,
        scenarioFamily: STANDARD_BENCHMARK_V1.scenarioFamily,
        scenarioVersion: STANDARD_BENCHMARK_V1.scenarioVersion,
        simulationVersion: STANDARD_BENCHMARK_V1.simulationVersion,
        seeds: STANDARD_BENCHMARK_V1.seeds,
        evaluatorVersion: STANDARD_BENCHMARK_V1.evaluatorVersion,
        scoringVersion: STANDARD_BENCHMARK_V1.scoringVersion,
        toolContractVersion: STANDARD_BENCHMARK_V1.toolContractVersion,
      }),
      scenarioVersion: 1,
      simulationVersion: STANDARD_BENCHMARK_V1.simulationVersion,
      evaluatorVersion: STANDARD_BENCHMARK_V1.evaluatorVersion,
      scoringVersion: STANDARD_BENCHMARK_V1.scoringVersion,
      toolContractVersion: STANDARD_BENCHMARK_V1.toolContractVersion,
      model: { provider: 'test', model: 'model', version: 'v1' },
      pricingSnapshot: pricing,
      evaluatedAt: '2026-09-17',
      seeds: STANDARD_BENCHMARK_V1.seeds,
      runsCompleted: 10,
      runReferences: [],
      metrics,
      costs: aggregateCosts(
        [
          createCostRecord(
            { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
            { ...pricing, inputUsdPerMillionTokens: 0, outputUsdPerMillionTokens: 0 },
            0,
          ),
        ],
        8,
      ),
      runCosts: [],
      runs: STANDARD_BENCHMARK_V1.seeds.map((seed) => ({
        seed,
        runId: String(seed),
        outcome: 'success' as const,
        score: 90,
        toolCalls: 5,
        retryCount: 0,
        failureClass: 'none' as const,
      })),
      budget: new BudgetLedger().snapshot(),
    };
    expect(
      buildLeaderboard([result, { ...result, official: false, source: 'community' }], '2026-09-17')
        .entries,
    ).toHaveLength(1);
    expect(overallScore(metrics)).toBeGreaterThan(0);
    expect(isReusableOfficialResult(result, STANDARD_BENCHMARK_V1, result.model)).toBe(true);
    expect(
      isReusableOfficialResult(result, STANDARD_BENCHMARK_V1, { provider: 'test', model: 'other' }),
    ).toBe(false);
  });
});
