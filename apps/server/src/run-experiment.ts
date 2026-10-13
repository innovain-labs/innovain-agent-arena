import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { stringify } from 'yaml';
import type { ArenaEvent, Frame, Run, ToolCall, WorldState } from '@arena/arena-core';
import {
  createExperiment,
  initialStrategy,
  reflect,
  summarizeExperiment,
  updateStrategy,
  type ExperimentAttempt,
  type ExperimentConfig,
  type ExperimentRecord,
  type StrategyArtifact,
} from '@arena/experiments';
import { createMarsVariant, type MarsScenarioVariant } from '@arena/mars-world';
import { validateRun } from '@arena/replay';
import { calculateScore } from '@arena/scoring';
import { AgentSession, rescuePlan, unsafePlan } from '@arena/agent-runner';
import { loadScenario } from './scenario-loader';
import { safeChildEnvironment } from './host-environment';

const root = resolve('.');
const baseScenarioPath = resolve('scenarios/mars/habitat-b-leak/scenario.yaml');
const briefingPath = resolve('scenarios/mars/habitat-b-leak/briefing.md');

export interface ExperimentRunOptions {
  config: ExperimentConfig;
  scenarioPath?: string;
  outputDirectory?: string;
}

function paddedAttempt(attempt: number): string {
  return String(attempt).padStart(3, '0');
}

function planFor(
  mode: ExperimentConfig['learningMode'],
  strategy: StrategyArtifact,
  attempt: number,
): ToolCall[] {
  // This deterministic test double deliberately starts with a risky ordering.
  // It gives the infrastructure a reproducible failure to reflect on while a
  // future provider adapter can replace this function with a real model loop.
  if (mode === 'adaptive' && (strategy.version > 1 || attempt > 1)) return rescuePlan;
  return unsafePlan;
}

async function runAttempt(
  config: ExperimentConfig,
  variant: MarsScenarioVariant,
  attempt: number,
  split: 'training' | 'holdout',
  inputStrategy?: StrategyArtifact,
): Promise<Run> {
  const experimentRoot = resolve('work', 'experiments', config.id);
  const variantDirectory = resolve(experimentRoot, 'variants');
  const attemptDirectory = resolve(experimentRoot, `attempt-${paddedAttempt(attempt)}`);
  await mkdir(variantDirectory, { recursive: true });
  await mkdir(attemptDirectory, { recursive: true });
  const variantPath = resolve(variantDirectory, `${variant.metadata.seed}.yaml`);
  const recordPath = resolve(attemptDirectory, 'mcp-record.json');
  await writeFile(variantPath, stringify(variant.scenario));
  const session = new AgentSession();
  const strategy = inputStrategy ?? initialStrategy();
  const plan = planFor(config.learningMode, strategy, attempt);
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
  const run: Run = {
    formatVersion: 1,
    metadata: {
      id: `${config.id}-attempt-${paddedAttempt(attempt)}`,
      scenarioId: variant.scenario.metadata.id,
      scenarioName: variant.scenario.metadata.name,
      scenarioVersion: variant.scenario.schemaVersion,
      agent: config.agent,
      seed: variant.metadata.seed,
      recordedAt: `2026-09-17T00:${String(attempt % 60).padStart(2, '0')}:00.000Z`,
      protocol: 'MCP/stdio',
      briefing: await readFile(briefingPath, 'utf8'),
      scenario: variant.scenario,
      experimentId: config.id,
      attempt,
      learningMode: config.learningMode,
      scenarioVariant: {
        id: variant.metadata.id,
        seed: variant.metadata.seed,
        split,
      },
      ...(inputStrategy ? { inputStrategyVersion: inputStrategy.version } : {}),
      model: config.model ?? { provider: 'scripted-test-double' },
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      cost: {
        status: 'not_applicable',
        currency: 'USD',
        estimatedUsd: 0,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      },
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
  return run;
}

function reflectionMarkdown(reflection: ReturnType<typeof reflect>): string {
  const section = (title: string, values: string[]) =>
    `## ${title}\n\n${values.length ? values.map((value) => `- ${value}`).join('\n') : '- None recorded.'}\n`;
  return [
    `# Reflection / Attempt ${reflection.attempt}`,
    '',
    `Outcome: **${reflection.outcome}**`,
    `Score: **${reflection.score.toFixed(3)}**`,
    '',
    section('What worked', reflection.whatWorked),
    section('What failed', reflection.whatFailed),
    section('Wrong assumptions', reflection.wrongAssumptions),
    section('Unnecessary actions', reflection.unnecessaryActions),
    section('Dangerous actions', reflection.dangerousActions),
    section('Information to gather earlier', reflection.informationToGatherEarlier),
    section('Strategy changes', reflection.strategyChanges),
  ].join('\n');
}

export async function runExperiment({
  config: rawConfig,
  scenarioPath = baseScenarioPath,
}: ExperimentRunOptions): Promise<ExperimentRecord> {
  const config = createExperiment(rawConfig);
  const base = await loadScenario(scenarioPath);
  const outputDirectory = resolve('experiments', config.id);
  await mkdir(outputDirectory, { recursive: true });
  const attempts: ExperimentAttempt[] = [];
  const strategyHistory: StrategyArtifact[] = [];
  let strategy = initialStrategy();
  strategyHistory.push(strategy);

  const trainingSeeds = config.trainingSeeds.slice(0, config.maxAttempts);
  for (const [index, seed] of trainingSeeds.entries()) {
    const attempt = index + 1;
    const variant = createMarsVariant(base, seed, 'training', {
      // Incident #001's public briefing specifically names Habitat B. Keep
      // that causal target fixed while varying pressure, resources, and paths.
      varyLeakLocation: false,
      varyCrewLocation: false,
    });
    const inputStrategy = config.learningMode === 'adaptive' ? strategy : undefined;
    const run = await runAttempt(config, variant, attempt, 'training', inputStrategy);
    const record: ExperimentAttempt = { attempt, seed, split: 'training', run };
    if (config.learningMode === 'adaptive') {
      record.inputStrategy = inputStrategy ? structuredClone(inputStrategy) : undefined;
      record.reflection = reflect(run, attempt);
      strategy = updateStrategy(strategy, record.reflection);
      record.outputStrategy = strategy;
      strategyHistory.push(strategy);
      run.metadata.outputStrategyVersion = strategy.version;
    }
    attempts.push(record);
    const directory = resolve(
      'work',
      'experiments',
      config.id,
      `attempt-${paddedAttempt(attempt)}`,
    );
    await writeFile(resolve(directory, 'run.json'), JSON.stringify(run, null, 2) + '\n');
    const publicDirectory = resolve(outputDirectory, `attempt-${paddedAttempt(attempt)}`);
    await mkdir(publicDirectory, { recursive: true });
    await writeFile(resolve(publicDirectory, 'run.json'), JSON.stringify(run, null, 2) + '\n');
    if (record.reflection) {
      await writeFile(
        resolve(directory, 'reflection.json'),
        JSON.stringify(record.reflection, null, 2) + '\n',
      );
      await writeFile(
        resolve(publicDirectory, 'reflection.json'),
        JSON.stringify(record.reflection, null, 2) + '\n',
      );
      await writeFile(
        resolve(publicDirectory, 'reflection.md'),
        reflectionMarkdown(record.reflection),
      );
    }
    if (record.outputStrategy) {
      await writeFile(
        resolve(directory, 'strategy.json'),
        JSON.stringify(record.outputStrategy, null, 2) + '\n',
      );
      await writeFile(
        resolve(publicDirectory, 'strategy.json'),
        JSON.stringify(record.outputStrategy, null, 2) + '\n',
      );
    }
  }

  // Holdout variants are evaluated after training and never feed reflection or
  // strategy updates back into the experiment.
  for (const seed of config.holdoutSeeds) {
    const attempt = attempts.length + 1;
    const variant = createMarsVariant(base, seed, 'holdout', {
      varyLeakLocation: false,
      varyCrewLocation: false,
    });
    const inputStrategy = config.learningMode === 'adaptive' ? strategy : undefined;
    const run = await runAttempt(config, variant, attempt, 'holdout', inputStrategy);
    const record: ExperimentAttempt = { attempt, seed, split: 'holdout', run };
    if (inputStrategy) {
      record.inputStrategy = structuredClone(inputStrategy);
      run.metadata.outputStrategyVersion = strategy.version;
    }
    attempts.push(record);
    const directory = resolve(
      'work',
      'experiments',
      config.id,
      `attempt-${paddedAttempt(attempt)}`,
    );
    await writeFile(resolve(directory, 'run.json'), JSON.stringify(run, null, 2) + '\n');
    const publicDirectory = resolve(outputDirectory, `attempt-${paddedAttempt(attempt)}`);
    await mkdir(publicDirectory, { recursive: true });
    await writeFile(resolve(publicDirectory, 'run.json'), JSON.stringify(run, null, 2) + '\n');
  }

  const summary = summarizeExperiment(config, attempts, strategyHistory);
  await writeFile(
    resolve(outputDirectory, 'experiment.json'),
    JSON.stringify(
      {
        formatVersion: 1,
        ...config,
        attempts: summary.attempts,
        strategyHistory: summary.strategyHistory,
        createdAt: summary.createdAt,
        completedAt: summary.completedAt,
        cost: summary.cost,
        finalMetrics: {
          training: summary.trainingMetrics,
          holdout: summary.holdoutMetrics,
        },
      },
      null,
      2,
    ) + '\n',
  );
  await writeFile(
    resolve(outputDirectory, 'summary.json'),
    JSON.stringify(summary, null, 2) + '\n',
  );
  return { formatVersion: 1, config, attempts, summary };
}

function getOption(name: string, fallback: string): string {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1]! : fallback;
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/run-experiment.ts')) {
  const mode = getOption('--mode', 'adaptive');
  if (mode !== 'baseline' && mode !== 'adaptive')
    throw new Error('--mode must be baseline or adaptive.');
  const attempts = Number(getOption('--attempts', '5'));
  const seed = Number(getOption('--seed', '101'));
  const holdoutStart = Number(getOption('--holdout-seed', '901'));
  const id = getOption('--id', `mars-habitat-learning-${mode}-001`);
  const record = await runExperiment({
    config: {
      id,
      name: `Mars Learning Experiment #001 / ${mode}`,
      world: 'mars',
      scenarioFamily: 'mars/habitat-b-leak',
      scenarioVersion: 1,
      agent:
        mode === 'adaptive' ? 'Scripted adaptive test double' : 'Scripted baseline test double',
      model: {
        provider: 'arena',
        model: mode === 'adaptive' ? 'scripted-adaptive' : 'scripted-baseline',
        version: 'v1',
      },
      learningMode: mode,
      maxAttempts: attempts,
      trainingSeeds: Array.from({ length: attempts }, (_, index) => seed + index),
      holdoutSeeds: [holdoutStart, holdoutStart + 1],
      createdAt: '2026-09-17T00:00:00.000Z',
      completedAt: '2026-09-17T00:05:00.000Z',
      budgetPolicy: {
        maxUsd: 10,
        maxRuns: 10,
        maxAttempts: 5,
        maxInputTokens: 200_000,
        maxOutputTokens: 50_000,
        maxToolCallsPerRun: 30,
      },
    },
  });
  console.log(JSON.stringify(record.summary, null, 2));
}
