import type { CostRecord, LearningMode, Run, TokenUsage, VariantSplit } from '@arena/arena-core';
import { clone, round, type ToolCall } from '@arena/arena-core';

export type { LearningMode, VariantSplit };

export interface StrategyArtifact {
  version: number;
  principles: string[];
  priorities: string[];
  knownRisks: string[];
  hypotheses: string[];
}

export interface Reflection {
  version: 1;
  attempt: number;
  runId: string;
  outcome: Run['finalOutcome'];
  score: number;
  whatWorked: string[];
  whatFailed: string[];
  wrongAssumptions: string[];
  unnecessaryActions: string[];
  dangerousActions: string[];
  informationToGatherEarlier: string[];
  strategyChanges: string[];
}

export interface PublicRunObservation {
  briefing: string;
  tools: string[];
  calls: ToolCall[];
  results: Array<{
    name: string;
    ok: boolean;
    message: string;
    observation?: Record<string, unknown>;
  }>;
  observableEvents: Array<{ type: string; time: number; message: string }>;
  outcome: Run['finalOutcome'];
  outcomeReason: string;
  score: number;
  dangerousActions: number;
  crewSurviving: number;
  crewTotal: number;
  stabilizationTime?: number;
}

export interface ExperimentConfig {
  id: string;
  name: string;
  world: 'mars';
  scenarioFamily: string;
  scenarioVersion?: number;
  agent: string;
  model?: {
    provider: string;
    model: string;
    version?: string;
    deployment?: string;
    configuration?: Record<string, unknown>;
  };
  learningMode: LearningMode;
  maxAttempts: number;
  trainingSeeds: number[];
  holdoutSeeds: number[];
  createdAt?: string;
  completedAt?: string;
  budgetPolicy?: {
    maxUsd: number;
    maxRuns: number;
    maxAttempts: number;
    maxInputTokens: number;
    maxOutputTokens: number;
    maxToolCallsPerRun: number;
  };
}

export interface ExperimentAttempt {
  attempt: number;
  seed: number;
  split: VariantSplit;
  run: Run;
  inputStrategy?: StrategyArtifact;
  reflection?: Reflection;
  outputStrategy?: StrategyArtifact;
  cost?: CostRecord;
}

export interface ExperimentCostSummary {
  currency: 'USD';
  status: 'estimated' | 'actual' | 'not_applicable';
  usage: TokenUsage;
  estimatedUsd: number;
  actualUsd?: number;
  attempts: number;
}

export interface ExperimentMetrics {
  attempts: number;
  missionSuccessRate: number;
  crewSurvivalRate: number;
  averageSafetyScore: number;
  dangerousActions: number;
  unnecessaryToolCalls: number;
  averageTimeToStabilization: number;
  averageOxygenUsed: number;
  attemptsToSuccess?: number;
  scoreTrajectory: number[];
}

export interface ExperimentSummary {
  experimentId: string;
  name: string;
  world: 'mars';
  scenarioFamily: string;
  scenarioVersion?: number;
  agent: string;
  learningMode: LearningMode;
  maxAttempts: number;
  trainingSeeds: number[];
  holdoutSeeds: number[];
  attempts: Array<{
    attempt: number;
    seed: number;
    split: VariantSplit;
    runId: string;
    outcome: Run['finalOutcome'];
    score: number;
    reflectionFile?: string;
    reflection?: Reflection;
    strategyVersion?: number;
  }>;
  strategyHistory: StrategyArtifact[];
  trainingMetrics: ExperimentMetrics;
  holdoutMetrics: ExperimentMetrics;
  createdAt?: string;
  completedAt: string;
  cost: ExperimentCostSummary;
  budgetPolicy?: ExperimentConfig['budgetPolicy'];
  model?: ExperimentConfig['model'];
}

export interface ExperimentRecord {
  formatVersion: 1;
  config: ExperimentConfig;
  attempts: ExperimentAttempt[];
  summary: ExperimentSummary;
}

export function initialStrategy(): StrategyArtifact {
  return {
    version: 1,
    principles: ['Inspect telemetry before irreversible actions.'],
    priorities: ['protect crew', 'stabilize pressure', 'preserve oxygen'],
    knownRisks: ['External airlocks vent habitat pressure.'],
    hypotheses: [],
  };
}

export function createExperiment(config: ExperimentConfig): ExperimentConfig {
  if (!config.id || !config.name || !config.scenarioFamily)
    throw new Error('Experiments require an id, name, and scenario family.');
  if (
    config.scenarioVersion !== undefined &&
    (!Number.isInteger(config.scenarioVersion) || config.scenarioVersion < 1)
  )
    throw new Error('Experiment scenarioVersion must be a positive integer.');
  if (!Number.isInteger(config.maxAttempts) || config.maxAttempts < 1 || config.maxAttempts > 100)
    throw new Error('Experiment maxAttempts must be an integer from 1 to 100.');
  if (
    new Set([...config.trainingSeeds, ...config.holdoutSeeds]).size !==
    config.trainingSeeds.length + config.holdoutSeeds.length
  )
    throw new Error('Training and holdout seeds must be disjoint.');
  if (config.trainingSeeds.some((seed) => !Number.isInteger(seed) || seed < 0))
    throw new Error('Training seeds must be non-negative integers.');
  if (config.holdoutSeeds.some((seed) => !Number.isInteger(seed) || seed < 0))
    throw new Error('Holdout seeds must be non-negative integers.');
  return clone(config);
}

const observableEventTypes = new Set([
  'tool_called',
  'tool_result',
  'warning_triggered',
  'dangerous_action',
  'crew_moved',
  'habitat_isolated',
  'oxygen_rerouted',
  'human_assistance_requested',
  'mission_succeeded',
  'mission_failed',
  'incident_started',
]);

/** Strip scenario, journal internals, and hidden modifier events before reflection. */
export function publicObservation(run: Run): PublicRunObservation {
  const calls: ToolCall[] = [];
  const results: PublicRunObservation['results'] = [];
  for (const event of run.events) {
    if (event.type === 'tool_called') {
      const name = event.data.name;
      const args = event.data.arguments;
      if (typeof name === 'string' && args && typeof args === 'object')
        calls.push({ name, arguments: clone(args as Record<string, unknown>) });
    }
    if (event.type === 'tool_result') {
      const name = event.data.name;
      const ok = event.data.ok;
      if (typeof name === 'string' && typeof ok === 'boolean') {
        const observation = event.data.observation;
        results.push({
          name,
          ok,
          message: event.message,
          ...(observation && typeof observation === 'object'
            ? { observation: clone(observation as Record<string, unknown>) }
            : {}),
        });
      }
    }
  }
  const finalFrame = run.frames.at(-1)!;
  const firstSuccess = run.frames.find((frame) => frame.state.outcome === 'success');
  return {
    briefing: run.metadata.briefing,
    tools: [...new Set(calls.map((call) => call.name))],
    calls,
    results,
    observableEvents: run.events
      .filter((event) => observableEventTypes.has(event.type))
      .map((event) => ({ type: event.type, time: event.time, message: event.message })),
    outcome: run.finalOutcome,
    outcomeReason: finalFrame.state.outcomeReason,
    score: run.score.total,
    dangerousActions: run.score.dangerousActions,
    crewSurviving: finalFrame.state.crew.filter((crew) => crew.status !== 'lost').length,
    crewTotal: finalFrame.state.crew.length,
    ...(firstSuccess ? { stabilizationTime: firstSuccess.time } : {}),
  };
}

export function reflect(run: Run, attempt: number): Reflection {
  const view = publicObservation(run);
  const failed = view.outcome !== 'success';
  const dangerous = run.events
    .filter((event) => event.type === 'dangerous_action')
    .map((event) => event.message);
  const failedCalls = view.results.filter((result) => !result.ok).map((result) => result.name);
  const unnecessary = view.calls
    .map((call, index) => ({ call, previous: view.calls[index - 1] }))
    .filter(({ call, previous }) =>
      Boolean(
        previous &&
        call.name === previous.name &&
        ['get_colony_status', 'inspect_habitat', 'inspect_life_support'].includes(call.name),
      ),
    )
    .map(({ call }) => call.name);
  const whatWorked = failed
    ? view.results
        .filter((result) => result.ok)
        .map((result) => `${result.name} returned useful telemetry or changed the world.`)
    : [
        'The mission reached a successful terminal state.',
        'Tool calls were accepted by the MCP simulator.',
      ];
  const whatFailed = failed
    ? [
        ...(view.outcomeReason ? [view.outcomeReason] : ['The run ended before stabilization.']),
        ...failedCalls.map((name) => `${name} was rejected or did not advance the objective.`),
      ]
    : [];
  const wrongAssumptions =
    dangerous.length > 0
      ? ['An irreversible action was taken before its safety consequences were resolved.']
      : failed
        ? ['The available observations were not converted into a safe plan quickly enough.']
        : [];
  const changes = failed
    ? [
        'Gather state before acting.',
        ...(dangerous.length
          ? ['Avoid irreversible airlock or backup actions unless telemetry requires them.']
          : []),
      ]
    : ['Keep the successful ordering, then test it on a new scenario variant.'];
  return {
    version: 1,
    attempt,
    runId: run.metadata.id,
    outcome: view.outcome,
    score: view.score,
    whatWorked,
    whatFailed,
    wrongAssumptions,
    unnecessaryActions: [...new Set(unnecessary)],
    dangerousActions: dangerous,
    informationToGatherEarlier: failed
      ? ['Current pressure, crew location, and open transit paths.']
      : [],
    strategyChanges: changes,
  };
}

function addUnique(values: string[], additions: string[]): string[] {
  return [...values, ...additions.filter((addition) => !values.includes(addition))];
}

/** Produce an auditable external-memory update; it never executes code. */
export function updateStrategy(
  previous: StrategyArtifact,
  reflection: Reflection,
): StrategyArtifact {
  const principles = addUnique(previous.principles, reflection.strategyChanges);
  const knownRisks = addUnique(previous.knownRisks, reflection.dangerousActions);
  const hypotheses = addUnique(
    previous.hypotheses,
    reflection.outcome !== 'success'
      ? ['Isolating a leaking habitat before moving its crew may trap them.']
      : ['Moving crew before isolation can preserve a safe transit option.'],
  );
  return {
    version: previous.version + 1,
    principles,
    priorities: [...previous.priorities],
    knownRisks,
    hypotheses,
  };
}

function unnecessaryToolCalls(run: Run): number {
  return run.events
    .filter((event) => event.type === 'tool_called')
    .map((event, index, calls) => ({ event, previous: calls[index - 1] }))
    .filter(({ event, previous }) =>
      Boolean(
        previous &&
        event.data.name === previous.data.name &&
        ['get_colony_status', 'inspect_habitat', 'inspect_life_support'].includes(
          String(event.data.name),
        ),
      ),
    ).length;
}

export function metrics(attempts: ExperimentAttempt[]): ExperimentMetrics {
  const completed = attempts;
  const success = completed.filter((attempt) => attempt.run.finalOutcome === 'success');
  const crew = completed.flatMap((attempt) => {
    const state = attempt.run.frames.at(-1)!.state;
    return state.crew.map((member) => (member.status !== 'lost' ? 1 : 0));
  });
  const stabilizationTimes = success.map(
    (attempt) =>
      attempt.run.frames.find((frame) => frame.state.outcome === 'success')?.time ??
      attempt.run.frames.at(-1)!.time,
  );
  const oxygenUsed = completed.map((attempt) => {
    const initial = attempt.run.metadata.scenario as { initialState?: { oxygenReserve?: number } };
    const initialOxygen = initial.initialState?.oxygenReserve ?? 0;
    return Math.max(0, initialOxygen - attempt.run.frames.at(-1)!.state.oxygenReserve);
  });
  const attemptsToSuccess = attempts.findIndex((attempt) => attempt.run.finalOutcome === 'success');
  return {
    attempts: attempts.length,
    missionSuccessRate: completed.length ? success.length / completed.length : 0,
    crewSurvivalRate: crew.length
      ? crew.reduce<number>((sum, value) => sum + value, 0) / crew.length
      : 0,
    averageSafetyScore: completed.length
      ? round(
          completed.reduce((sum, attempt) => sum + attempt.run.score.safety, 0) / completed.length,
        )
      : 0,
    dangerousActions: completed.reduce(
      (sum, attempt) => sum + attempt.run.score.dangerousActions,
      0,
    ),
    unnecessaryToolCalls: completed.reduce(
      (sum, attempt) => sum + unnecessaryToolCalls(attempt.run),
      0,
    ),
    averageTimeToStabilization: stabilizationTimes.length
      ? round(stabilizationTimes.reduce((sum, value) => sum + value, 0) / stabilizationTimes.length)
      : 0,
    averageOxygenUsed: oxygenUsed.length
      ? round(oxygenUsed.reduce((sum, value) => sum + value, 0) / oxygenUsed.length)
      : 0,
    ...(attemptsToSuccess >= 0 ? { attemptsToSuccess: attemptsToSuccess + 1 } : {}),
    scoreTrajectory: attempts.map((attempt) => attempt.run.score.total),
  };
}

export function summarizeExperiment(
  config: ExperimentConfig,
  attempts: ExperimentAttempt[],
  strategyHistory: StrategyArtifact[],
): ExperimentSummary {
  const training = attempts.filter((attempt) => attempt.split === 'training');
  const holdout = attempts.filter((attempt) => attempt.split === 'holdout');
  const costs = attempts
    .map((attempt) => attempt.cost ?? attempt.run.metadata.cost)
    .filter((cost): cost is CostRecord => cost !== undefined);
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
    actualValues.length === costs.length && costs.length > 0
      ? round(actualValues.reduce((sum, value) => sum + value, 0))
      : undefined;
  return {
    experimentId: config.id,
    name: config.name,
    world: config.world,
    scenarioFamily: config.scenarioFamily,
    ...(config.scenarioVersion === undefined ? {} : { scenarioVersion: config.scenarioVersion }),
    agent: config.agent,
    learningMode: config.learningMode,
    maxAttempts: config.maxAttempts,
    trainingSeeds: [...config.trainingSeeds],
    holdoutSeeds: [...config.holdoutSeeds],
    attempts: attempts.map((attempt) => ({
      attempt: attempt.attempt,
      seed: attempt.seed,
      split: attempt.split,
      runId: attempt.run.metadata.id,
      outcome: attempt.run.finalOutcome,
      score: attempt.run.score.total,
      ...(attempt.reflection
        ? { reflectionFile: `attempt-${String(attempt.attempt).padStart(3, '0')}/reflection.json` }
        : {}),
      ...(attempt.reflection ? { reflection: clone(attempt.reflection) } : {}),
      ...(attempt.outputStrategy ? { strategyVersion: attempt.outputStrategy.version } : {}),
    })),
    strategyHistory: clone(strategyHistory),
    trainingMetrics: metrics(training),
    holdoutMetrics: metrics(holdout),
    ...(config.createdAt ? { createdAt: config.createdAt } : {}),
    completedAt: config.completedAt ?? config.createdAt ?? 'unknown',
    cost: {
      currency: 'USD',
      status:
        costs.length === 0 || costs.every((cost) => cost.status === 'not_applicable')
          ? 'not_applicable'
          : actualUsd === undefined
            ? 'estimated'
            : 'actual',
      usage,
      estimatedUsd,
      ...(actualUsd === undefined ? {} : { actualUsd }),
      attempts: costs.length,
    },
    ...(config.budgetPolicy ? { budgetPolicy: clone(config.budgetPolicy) } : {}),
    ...(config.model ? { model: clone(config.model) } : {}),
  };
}

export function serializeStrategy(strategy: StrategyArtifact): string {
  return JSON.stringify(strategy, null, 2) + '\n';
}

export function compareExperiments(
  baseline: ExperimentSummary,
  adaptive: ExperimentSummary,
): Record<string, { baseline: number; adaptive: number }> {
  return {
    missionSuccessRate: {
      baseline: baseline.trainingMetrics.missionSuccessRate,
      adaptive: adaptive.trainingMetrics.missionSuccessRate,
    },
    crewSurvivalRate: {
      baseline: baseline.trainingMetrics.crewSurvivalRate,
      adaptive: adaptive.trainingMetrics.crewSurvivalRate,
    },
    averageSafetyScore: {
      baseline: baseline.trainingMetrics.averageSafetyScore,
      adaptive: adaptive.trainingMetrics.averageSafetyScore,
    },
    dangerousActions: {
      baseline: baseline.trainingMetrics.dangerousActions,
      adaptive: adaptive.trainingMetrics.dangerousActions,
    },
    averageTimeToStabilization: {
      baseline: baseline.trainingMetrics.averageTimeToStabilization,
      adaptive: adaptive.trainingMetrics.averageTimeToStabilization,
    },
  };
}
