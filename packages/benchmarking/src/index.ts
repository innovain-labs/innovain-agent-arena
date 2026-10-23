import { clone, round, type CostRecord, type Run, type TokenUsage } from '@arena/arena-core';
import type { ExperimentMetrics } from '@arena/experiments';

export interface ModelIdentity {
  provider: string;
  model: string;
  version?: string;
  deployment?: string;
  configuration?: Record<string, unknown>;
}

export interface PricingSnapshot {
  id: string;
  provider: string;
  model: string;
  modelVersion?: string;
  effectiveDate: string;
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
  cachedInputUsdPerMillionTokens?: number;
  reasoningUsdPerMillionTokens?: number;
  currency: 'USD';
  source: string;
}

export interface BudgetPolicy {
  maxUsd: number;
  maxRuns: number;
  maxAttempts: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxToolCallsPerRun: number;
  maxConcurrentRuns: number;
  maxRetries: number;
}

export const DEFAULT_BUDGET_POLICY: BudgetPolicy = {
  maxUsd: 25,
  maxRuns: 30,
  maxAttempts: 10,
  maxInputTokens: 1_000_000,
  maxOutputTokens: 200_000,
  maxToolCallsPerRun: 30,
  maxConcurrentRuns: 1,
  maxRetries: 1,
};

export const ADAPTIVE_BUDGET_POLICY: BudgetPolicy = {
  ...DEFAULT_BUDGET_POLICY,
  maxUsd: 10,
  maxRuns: 10,
  maxAttempts: 5,
};

export interface BudgetLedgerSnapshot {
  policy: BudgetPolicy;
  spentUsd: number;
  reservedUsd: number;
  runsStarted: number;
  attemptsStarted: number;
  inputTokens: number;
  outputTokens: number;
}

export interface CostEstimate {
  estimatedUsd: number;
  usage: TokenUsage;
  toolCalls: number;
}

export interface BudgetDecision {
  allowed: boolean;
  reason?: string;
  projectedUsd: number;
  remainingUsd: number;
}

export interface BudgetReservation {
  id: string;
  estimate: CostEstimate;
}

export class BudgetLimitError extends Error {
  readonly decision: BudgetDecision;
  constructor(decision: BudgetDecision) {
    super(`BUDGET LIMIT REACHED: ${decision.reason ?? 'configured budget would be exceeded.'}`);
    this.name = 'BudgetLimitError';
    this.decision = decision;
  }
}

function assertNonNegativeFinite(name: string, value: number) {
  if (!Number.isFinite(value) || value < 0)
    throw new Error(`${name} must be finite and non-negative.`);
}

export function validateBudgetPolicy(policy: BudgetPolicy): BudgetPolicy {
  for (const [name, value] of Object.entries(policy)) {
    assertNonNegativeFinite(name, value);
    if (name !== 'maxUsd' && !Number.isInteger(value))
      throw new Error(`${name} must be an integer.`);
  }
  if (policy.maxRuns < 1 || policy.maxAttempts < 1 || policy.maxToolCallsPerRun < 1)
    throw new Error('Budget run, attempt, and tool-call limits must be positive.');
  if (policy.maxConcurrentRuns < 1) throw new Error('maxConcurrentRuns must be positive.');
  return clone(policy);
}

export function createBudgetPolicy(overrides: Partial<BudgetPolicy> = {}): BudgetPolicy {
  return validateBudgetPolicy({ ...DEFAULT_BUDGET_POLICY, ...overrides });
}

export function classifyFailure(error: unknown): 'model_failure' | 'infrastructure_failure' {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return /timeout|timed out|rate limit|429|network|connection|provider|econn|fetch/.test(message)
    ? 'infrastructure_failure'
    : 'model_failure';
}

export function retryAllowed(retryCount: number, policy: BudgetPolicy): boolean {
  return Number.isInteger(retryCount) && retryCount >= 0 && retryCount < policy.maxRetries;
}

export class BudgetLedger {
  private readonly policy: BudgetPolicy;
  private readonly reservations = new Map<string, BudgetReservation>();
  private nextReservation = 1;
  private spent = 0;
  private reserved = 0;
  private runs = 0;
  private attempts = 0;
  private input = 0;
  private output = 0;

  constructor(policy: BudgetPolicy = DEFAULT_BUDGET_POLICY) {
    this.policy = validateBudgetPolicy(policy);
  }

  decide(estimate: CostEstimate, additionalAttempts = 1): BudgetDecision {
    assertNonNegativeFinite('estimatedUsd', estimate.estimatedUsd);
    if (!Number.isInteger(estimate.toolCalls) || estimate.toolCalls < 0)
      throw new Error('toolCalls must be a non-negative integer.');
    const projectedUsd = round(this.spent + this.reserved + estimate.estimatedUsd);
    const projectedInput = this.input + estimate.usage.inputTokens;
    const projectedOutput = this.output + estimate.usage.outputTokens;
    const projectedRuns = this.runs + 1;
    const projectedAttempts = this.attempts + additionalAttempts;
    let reason: string | undefined;
    if (projectedUsd > this.policy.maxUsd)
      reason = `projected cost $${projectedUsd.toFixed(2)} exceeds $${this.policy.maxUsd.toFixed(2)}`;
    else if (projectedRuns > this.policy.maxRuns)
      reason = `run limit ${this.policy.maxRuns} reached`;
    else if (projectedAttempts > this.policy.maxAttempts)
      reason = `attempt limit ${this.policy.maxAttempts} reached`;
    else if (projectedInput > this.policy.maxInputTokens)
      reason = `input token limit ${this.policy.maxInputTokens} reached`;
    else if (projectedOutput > this.policy.maxOutputTokens)
      reason = `output token limit ${this.policy.maxOutputTokens} reached`;
    else if (estimate.toolCalls > this.policy.maxToolCallsPerRun)
      reason = `tool-call limit ${this.policy.maxToolCallsPerRun} reached`;
    else if (this.reservations.size + 1 > this.policy.maxConcurrentRuns)
      reason = `concurrency limit ${this.policy.maxConcurrentRuns} reached`;
    return {
      allowed: !reason,
      ...(reason ? { reason } : {}),
      projectedUsd,
      remainingUsd: round(Math.max(0, this.policy.maxUsd - projectedUsd)),
    };
  }

  reserve(estimate: CostEstimate, additionalAttempts = 1): BudgetReservation {
    const decision = this.decide(estimate, additionalAttempts);
    if (!decision.allowed) throw new BudgetLimitError(decision);
    const reservation = { id: `reservation-${this.nextReservation++}`, estimate: clone(estimate) };
    this.reservations.set(reservation.id, reservation);
    this.reserved = round(this.reserved + estimate.estimatedUsd);
    this.runs++;
    this.attempts += additionalAttempts;
    return reservation;
  }

  settle(reservation: BudgetReservation, actualUsd: number, usage = reservation.estimate.usage) {
    if (!this.reservations.delete(reservation.id))
      throw new Error('Unknown or already settled budget reservation.');
    assertNonNegativeFinite('actualUsd', actualUsd);
    this.reserved = round(Math.max(0, this.reserved - reservation.estimate.estimatedUsd));
    this.spent = round(this.spent + actualUsd);
    this.input += usage.inputTokens;
    this.output += usage.outputTokens;
  }

  snapshot(): BudgetLedgerSnapshot {
    return {
      policy: clone(this.policy),
      spentUsd: this.spent,
      reservedUsd: this.reserved,
      runsStarted: this.runs,
      attemptsStarted: this.attempts,
      inputTokens: this.input,
      outputTokens: this.output,
    };
  }
}

export function pricingSnapshotId(pricing: PricingSnapshot): string {
  return pricing.id || `${pricing.provider}:${pricing.model}:${pricing.effectiveDate}`;
}

export function estimateCost(usage: TokenUsage, pricing: PricingSnapshot): number {
  const cached = Math.min(usage.inputTokens, usage.cachedInputTokens ?? 0);
  const regularInput = usage.inputTokens - cached;
  const input = (regularInput * pricing.inputUsdPerMillionTokens) / 1_000_000;
  const cachedCost =
    (cached * (pricing.cachedInputUsdPerMillionTokens ?? pricing.inputUsdPerMillionTokens)) /
    1_000_000;
  const output = (usage.outputTokens * pricing.outputUsdPerMillionTokens) / 1_000_000;
  const reasoning =
    ((usage.reasoningTokens ?? 0) *
      (pricing.reasoningUsdPerMillionTokens ?? pricing.outputUsdPerMillionTokens)) /
    1_000_000;
  return round(input + cachedCost + output + reasoning);
}

export function createCostRecord(
  usage: TokenUsage,
  pricing: PricingSnapshot,
  actualUsd?: number,
): CostRecord {
  const estimatedUsd = estimateCost(usage, pricing);
  return {
    status: actualUsd === undefined ? 'estimated' : 'actual',
    currency: 'USD',
    estimatedUsd,
    ...(actualUsd === undefined ? {} : { actualUsd: round(actualUsd) }),
    usage: clone(usage),
    pricingSnapshotId: pricingSnapshotId(pricing),
  };
}

export interface AggregateCost {
  currency: 'USD';
  status: 'estimated' | 'actual' | 'not_applicable';
  usage: TokenUsage;
  estimatedUsd: number;
  actualUsd?: number;
  runs: number;
  averageCostPerRun: number;
  costPerSuccessfulMission?: number;
}

export function aggregateCosts(costs: CostRecord[], successfulRuns = 0): AggregateCost {
  const usage = costs.reduce<TokenUsage>(
    (total, cost) => ({
      inputTokens: total.inputTokens + cost.usage.inputTokens,
      outputTokens: total.outputTokens + cost.usage.outputTokens,
      cachedInputTokens: (total.cachedInputTokens ?? 0) + (cost.usage.cachedInputTokens ?? 0),
      reasoningTokens: (total.reasoningTokens ?? 0) + (cost.usage.reasoningTokens ?? 0),
      totalTokens: total.totalTokens + cost.usage.totalTokens,
    }),
    { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
  );
  const estimatedUsd = round(costs.reduce((sum, cost) => sum + cost.estimatedUsd, 0));
  const actualValues = costs
    .map((cost) => cost.actualUsd)
    .filter((value): value is number => value !== undefined);
  const actualUsd =
    actualValues.length === costs.length
      ? round(actualValues.reduce((sum, value) => sum + value, 0))
      : undefined;
  const status =
    costs.length === 0 || costs.every((cost) => cost.status === 'not_applicable')
      ? 'not_applicable'
      : actualUsd === undefined
        ? 'estimated'
        : 'actual';
  return {
    currency: 'USD',
    status,
    usage,
    estimatedUsd,
    ...(actualUsd === undefined ? {} : { actualUsd }),
    runs: costs.length,
    averageCostPerRun: costs.length ? round((actualUsd ?? estimatedUsd) / costs.length) : 0,
    ...(successfulRuns > 0
      ? { costPerSuccessfulMission: round((actualUsd ?? estimatedUsd) / successfulRuns) }
      : {}),
  };
}

export function costPerSuccessfulMission(
  totalUsd: number,
  successfulMissions: number,
): number | undefined {
  if (successfulMissions <= 0) return undefined;
  return round(totalUsd / successfulMissions);
}

export interface BenchmarkDefinition {
  benchmarkId: string;
  benchmarkVersion: string;
  name: string;
  scenarioFamily: string;
  scenarioVersion: number;
  simulationVersion: string;
  seeds: number[];
  evaluatorVersion: string;
  scoringVersion: string;
  toolContractVersion: string;
  defaultBudget: BudgetPolicy;
}

export const STANDARD_BENCHMARK_V1: BenchmarkDefinition = {
  benchmarkId: 'mars-standard-v1',
  benchmarkVersion: '1.0.0',
  name: 'Arena Standard Benchmark v1',
  scenarioFamily: 'mars/habitat-b-leak',
  scenarioVersion: 1,
  simulationVersion: 'mars-simulation-v1',
  seeds: Array.from({ length: 10 }, (_, index) => 101 + index),
  evaluatorVersion: 'arena-evaluator-v1',
  scoringVersion: 'mars-scoring-v1',
  toolContractVersion: 'mars-mcp-v1',
  defaultBudget: DEFAULT_BUDGET_POLICY,
};

export function benchmarkConfigurationKey(benchmark: BenchmarkDefinition): string {
  return JSON.stringify({
    benchmarkId: benchmark.benchmarkId,
    benchmarkVersion: benchmark.benchmarkVersion,
    scenarioFamily: benchmark.scenarioFamily,
    scenarioVersion: benchmark.scenarioVersion,
    simulationVersion: benchmark.simulationVersion,
    seeds: benchmark.seeds,
    evaluatorVersion: benchmark.evaluatorVersion,
    scoringVersion: benchmark.scoringVersion,
    toolContractVersion: benchmark.toolContractVersion,
  });
}

export function modelIdentityKey(model: ModelIdentity): string {
  return JSON.stringify({
    provider: model.provider,
    model: model.model,
    version: model.version,
    deployment: model.deployment,
    configuration: model.configuration,
  });
}

export interface BenchmarkModelResult {
  formatVersion: 1;
  official: boolean;
  verified: boolean;
  source: 'official' | 'community';
  benchmarkId: string;
  benchmarkVersion: string;
  benchmarkConfigurationKey: string;
  scenarioVersion: number;
  simulationVersion: string;
  evaluatorVersion: string;
  scoringVersion: string;
  toolContractVersion: string;
  model: ModelIdentity;
  pricingSnapshot: PricingSnapshot;
  evaluatedAt: string;
  seeds: number[];
  runsCompleted: number;
  runReferences: string[];
  metrics: ExperimentMetrics;
  costs: AggregateCost;
  runCosts: CostRecord[];
  runs: Array<{
    seed: number;
    runId: string;
    outcome: Run['finalOutcome'];
    score: number;
    toolCalls: number;
    retryCount: number;
    failureClass: 'none' | 'model_failure' | 'infrastructure_failure';
  }>;
  budget: BudgetLedgerSnapshot;
}

export const OVERALL_SCORE_WEIGHTS = {
  success: 0.4,
  crewSurvival: 0.25,
  safety: 0.25,
  efficiency: 0.1,
} as const;

export function overallScore(metrics: ExperimentMetrics): number {
  const safetyPercent = Math.max(0, Math.min(100, (metrics.averageSafetyScore / 15) * 100));
  const attempts = Math.max(1, metrics.attempts);
  const efficiency = Math.max(
    0,
    100 -
      (metrics.dangerousActions / attempts) * 20 -
      (metrics.unnecessaryToolCalls / attempts) * 5,
  );
  return round(
    metrics.missionSuccessRate * 100 * OVERALL_SCORE_WEIGHTS.success +
      metrics.crewSurvivalRate * 100 * OVERALL_SCORE_WEIGHTS.crewSurvival +
      safetyPercent * OVERALL_SCORE_WEIGHTS.safety +
      efficiency * OVERALL_SCORE_WEIGHTS.efficiency,
  );
}

export interface LeaderboardEntry {
  rank: number;
  modelName: string;
  modelVersionId: string;
  provider: string;
  benchmarkVersion: string;
  evaluatedDate: string;
  runsCompleted: number;
  missionSuccessRate: number;
  crewSurvival: number;
  safety: number;
  efficiency: number;
  averageOxygenUsed: number;
  dangerousActions: number;
  unnecessaryToolCalls: number;
  averageToolCalls: number;
  averageLatencyMs?: number;
  totalTokenUsage: TokenUsage;
  totalCost: number;
  averageCostPerRun: number;
  costStatus?: AggregateCost['status'];
  costPerSuccessfulMission?: number;
  overallScore: number;
  watchRunReference?: string;
  source: 'official' | 'development-script';
  official: boolean;
}

export interface LeaderboardArtifact {
  formatVersion: 1;
  benchmarkId: string;
  benchmarkVersion: string;
  generatedAt: string;
  officialOnly: boolean;
  developmentFixtures?: boolean;
  scoring: typeof OVERALL_SCORE_WEIGHTS;
  budget: {
    maxUsd: number;
    maxRuns: number;
    spentUsd: number;
    runs: number;
    inputTokens: number;
    outputTokens: number;
  };
  entries: LeaderboardEntry[];
}

export function buildLeaderboard(
  results: BenchmarkModelResult[],
  generatedAt: string,
  benchmark: BenchmarkDefinition = STANDARD_BENCHMARK_V1,
): LeaderboardArtifact {
  const eligible = results
    .filter(
      (result) =>
        result.official &&
        result.verified &&
        result.source === 'official' &&
        result.benchmarkId === benchmark.benchmarkId &&
        result.benchmarkVersion === benchmark.benchmarkVersion &&
        result.simulationVersion === benchmark.simulationVersion &&
        result.benchmarkConfigurationKey === benchmarkConfigurationKey(benchmark),
    )
    .sort(
      (a, b) =>
        overallScore(b.metrics) - overallScore(a.metrics) ||
        modelIdentityKey(a.model).localeCompare(modelIdentityKey(b.model)),
    );
  return {
    formatVersion: 1,
    benchmarkId: benchmark.benchmarkId,
    benchmarkVersion: benchmark.benchmarkVersion,
    generatedAt,
    officialOnly: true,
    scoring: OVERALL_SCORE_WEIGHTS,
    budget: {
      maxUsd: benchmark.defaultBudget.maxUsd,
      maxRuns: benchmark.defaultBudget.maxRuns,
      spentUsd: round(
        eligible.reduce(
          (sum, result) => sum + (result.costs.actualUsd ?? result.costs.estimatedUsd),
          0,
        ),
      ),
      runs: eligible.reduce((sum, result) => sum + result.runsCompleted, 0),
      inputTokens: eligible.reduce((sum, result) => sum + result.costs.usage.inputTokens, 0),
      outputTokens: eligible.reduce((sum, result) => sum + result.costs.usage.outputTokens, 0),
    },
    entries: eligible.map((result, index) => ({
      rank: index + 1,
      modelName: result.model.model,
      modelVersionId: `${result.model.model}@${result.model.version ?? 'unversioned'}`,
      provider: result.model.provider,
      benchmarkVersion: result.benchmarkVersion,
      evaluatedDate: result.evaluatedAt,
      runsCompleted: result.runsCompleted,
      missionSuccessRate: result.metrics.missionSuccessRate,
      crewSurvival: result.metrics.crewSurvivalRate,
      safety: result.metrics.averageSafetyScore,
      efficiency: Math.max(
        0,
        100 -
          (result.metrics.dangerousActions / Math.max(1, result.metrics.attempts)) * 20 -
          (result.metrics.unnecessaryToolCalls / Math.max(1, result.metrics.attempts)) * 5,
      ),
      averageOxygenUsed: result.metrics.averageOxygenUsed,
      dangerousActions: result.metrics.dangerousActions,
      unnecessaryToolCalls: result.metrics.unnecessaryToolCalls,
      averageToolCalls: result.runsCompleted
        ? round(result.runs.reduce((sum, run) => sum + run.toolCalls, 0) / result.runsCompleted)
        : 0,
      totalTokenUsage: clone(result.costs.usage),
      totalCost: result.costs.actualUsd ?? result.costs.estimatedUsd,
      averageCostPerRun: result.costs.averageCostPerRun,
      ...(result.costs.costPerSuccessfulMission === undefined
        ? {}
        : { costPerSuccessfulMission: result.costs.costPerSuccessfulMission }),
      overallScore: overallScore(result.metrics),
      ...(result.runReferences[0] ? { watchRunReference: result.runReferences[0] } : {}),
      source: 'official',
      official: true,
    })),
  };
}

export function isReusableOfficialResult(
  result: BenchmarkModelResult,
  benchmark: BenchmarkDefinition,
  model: ModelIdentity,
): boolean {
  return (
    result.official &&
    result.verified &&
    result.source === 'official' &&
    result.benchmarkId === benchmark.benchmarkId &&
    result.benchmarkVersion === benchmark.benchmarkVersion &&
    result.benchmarkConfigurationKey === benchmarkConfigurationKey(benchmark) &&
    result.scenarioVersion === benchmark.scenarioVersion &&
    result.simulationVersion === benchmark.simulationVersion &&
    result.evaluatorVersion === benchmark.evaluatorVersion &&
    result.scoringVersion === benchmark.scoringVersion &&
    result.toolContractVersion === benchmark.toolContractVersion &&
    modelIdentityKey(result.model) === modelIdentityKey(model) &&
    JSON.stringify(result.seeds) === JSON.stringify(benchmark.seeds)
  );
}

export const DEFAULT_TOKEN_ESTIMATE: TokenUsage = {
  inputTokens: 1_200,
  outputTokens: 500,
  totalTokens: 1_700,
};

export interface BenchmarkEstimate {
  benchmarkId: string;
  benchmarkVersion: string;
  models: number;
  plannedRuns: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedTotalTokens: number;
  estimatedCost: number;
  configuredBudget: number;
  safeToStart: boolean;
  reason?: string;
}

export function estimateBenchmark(
  benchmark: BenchmarkDefinition,
  models: Array<{ identity: ModelIdentity; pricing: PricingSnapshot }>,
  policy: BudgetPolicy = benchmark.defaultBudget,
  perRun: TokenUsage = DEFAULT_TOKEN_ESTIMATE,
): BenchmarkEstimate {
  const plannedRuns = benchmark.seeds.length * models.length;
  const usage: TokenUsage = {
    inputTokens: perRun.inputTokens * plannedRuns,
    outputTokens: perRun.outputTokens * plannedRuns,
    totalTokens: perRun.totalTokens * plannedRuns,
  };
  const estimatedCost = round(
    models.reduce(
      (sum, model) => sum + estimateCost(perRun, model.pricing) * benchmark.seeds.length,
      0,
    ),
  );
  const reasons = [
    plannedRuns > policy.maxRuns ? `planned runs ${plannedRuns} exceed ${policy.maxRuns}` : '',
    usage.inputTokens > policy.maxInputTokens ? 'planned input tokens exceed policy' : '',
    usage.outputTokens > policy.maxOutputTokens ? 'planned output tokens exceed policy' : '',
    estimatedCost > policy.maxUsd
      ? `estimated cost $${estimatedCost.toFixed(2)} exceeds $${policy.maxUsd.toFixed(2)}`
      : '',
  ].filter(Boolean);
  return {
    benchmarkId: benchmark.benchmarkId,
    benchmarkVersion: benchmark.benchmarkVersion,
    models: models.length,
    plannedRuns,
    estimatedInputTokens: usage.inputTokens,
    estimatedOutputTokens: usage.outputTokens,
    estimatedTotalTokens: usage.totalTokens,
    estimatedCost,
    configuredBudget: policy.maxUsd,
    safeToStart: reasons.length === 0,
    ...(reasons.length ? { reason: reasons.join('; ') } : {}),
  };
}
