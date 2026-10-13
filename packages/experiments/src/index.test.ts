import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import type { ExperimentAttempt, StrategyArtifact } from './index';
import {
  createExperiment,
  initialStrategy,
  metrics,
  publicObservation,
  reflect,
  summarizeExperiment,
  updateStrategy,
} from './index';
import { createMarsVariant, parseScenario } from '@arena/mars-world';
import type { Run } from '@arena/arena-core';

const base = parseScenario(
  parse(readFileSync('scenarios/mars/habitat-b-leak/scenario.yaml', 'utf8')),
);
const rescue = JSON.parse(readFileSync('runs/example-incident-001.json', 'utf8')) as Run;
const unsafe = JSON.parse(readFileSync('runs/unsafe-incident-001.json', 'utf8')) as Run;

describe('experiment contracts', () => {
  test('creates a validated experiment and rejects overlapping seeds', () => {
    expect(
      createExperiment({
        id: 'exp-001',
        name: 'Learning test',
        world: 'mars',
        scenarioFamily: 'mars/habitat-b-leak',
        agent: 'test double',
        learningMode: 'adaptive',
        maxAttempts: 3,
        trainingSeeds: [101, 102],
        holdoutSeeds: [901],
      }).id,
    ).toBe('exp-001');
    expect(() =>
      createExperiment({
        id: 'bad',
        name: 'Bad',
        world: 'mars',
        scenarioFamily: 'mars/habitat-b-leak',
        agent: 'test',
        learningMode: 'baseline',
        maxAttempts: 1,
        trainingSeeds: [1],
        holdoutSeeds: [1],
      }),
    ).toThrow('disjoint');
  });

  test('variants are deterministic and keep hidden parameters out of public observations', () => {
    const first = createMarsVariant(base, 101, 'training');
    const second = createMarsVariant(base, 101, 'training');
    expect(first).toEqual(second);
    expect(first.metadata.parameters.leakRate).toBeGreaterThan(0);
    expect(first.metadata.parameters.isolationLeakFactor).toBeGreaterThan(0);
    const observed = publicObservation(rescue);
    expect(JSON.stringify(observed)).not.toContain('timedEvents');
    expect(JSON.stringify(observed)).not.toContain('leakRate');
    expect(observed.calls.length).toBeGreaterThan(0);
  });

  test('reflection uses only run observations and adaptive strategy versions carry over', () => {
    const reflection = reflect(unsafe, 1);
    expect(reflection.outcome).toBe('failure');
    expect(reflection.dangerousActions.length).toBeGreaterThan(0);
    expect(JSON.stringify(reflection)).not.toContain('scoring');
    const next = updateStrategy(initialStrategy(), reflection);
    expect(next.version).toBe(2);
    expect(next.principles.length).toBeGreaterThan(1);
    expect(next.hypotheses.length).toBe(1);
  });

  test('baseline has no memory while adaptive summary records trajectory and holdout', () => {
    const baselineAttempts: ExperimentAttempt[] = [
      { attempt: 1, seed: 101, split: 'training', run: unsafe },
      { attempt: 2, seed: 102, split: 'training', run: unsafe },
      { attempt: 3, seed: 901, split: 'holdout', run: unsafe },
    ];
    const strategy: StrategyArtifact = initialStrategy();
    const adaptiveAttempts: ExperimentAttempt[] = [
      {
        attempt: 1,
        seed: 101,
        split: 'training',
        run: unsafe,
        inputStrategy: strategy,
        reflection: reflect(unsafe, 1),
        outputStrategy: updateStrategy(strategy, reflect(unsafe, 1)),
      },
      {
        attempt: 2,
        seed: 102,
        split: 'training',
        run: rescue,
        inputStrategy: updateStrategy(strategy, reflect(unsafe, 1)),
      },
      {
        attempt: 3,
        seed: 901,
        split: 'holdout',
        run: rescue,
        inputStrategy: updateStrategy(strategy, reflect(unsafe, 1)),
      },
    ];
    const config = createExperiment({
      id: 'summary-001',
      name: 'Summary test',
      world: 'mars',
      scenarioFamily: 'mars/habitat-b-leak',
      agent: 'test double',
      learningMode: 'adaptive',
      maxAttempts: 2,
      trainingSeeds: [101, 102],
      holdoutSeeds: [901],
    });
    const summary = summarizeExperiment(config, adaptiveAttempts, [
      strategy,
      adaptiveAttempts[0]!.outputStrategy!,
    ]);
    expect(metrics(baselineAttempts).scoreTrajectory).toHaveLength(3);
    expect(baselineAttempts.every((attempt) => attempt.inputStrategy === undefined)).toBe(true);
    expect(adaptiveAttempts[1]!.inputStrategy?.version).toBe(2);
    expect(summary.trainingMetrics.attemptsToSuccess).toBe(2);
    expect(summary.holdoutMetrics.missionSuccessRate).toBe(1);
    expect(summary.attempts[0]!.reflection?.outcome).toBe('failure');
    expect(
      summary.attempts.find((attempt) => attempt.split === 'holdout')!.reflection,
    ).toBeUndefined();
    expect(summary.attempts.map((attempt) => attempt.attempt)).toEqual([1, 2, 3]);
    expect(summary.strategyHistory.map((item) => item.version)).toEqual([1, 2]);
  });
});
