import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import type { Run } from '@arena/arena-core';
import { durationOf, frameAt, validateRun } from './index';

describe('experiment recording compatibility', () => {
  test('accepts legacy and experiment-enriched run metadata', () => {
    const legacy = JSON.parse(readFileSync('runs/example-incident-001.json', 'utf8')) as Run;
    const experiment = JSON.parse(
      readFileSync('experiments/mars-learning-001-adaptive/attempt-002/run.json', 'utf8'),
    ) as Run;
    expect(validateRun(legacy).metadata.experimentId).toBeUndefined();
    expect(validateRun(experiment).metadata.learningMode).toBe('adaptive');
    expect(validateRun(experiment).metadata.attempt).toBe(2);
    expect(validateRun(experiment).metadata.scenarioVersion).toBe(1);
    expect(validateRun(experiment).metadata.scenarioVariant?.split).toBe('training');
    expect(validateRun(experiment).metadata.model?.model).toBe('scripted-adaptive');
    expect(validateRun(experiment).metadata.model?.version).toBe('v1');
  });

  test('seeks experiment frames without exposing a mutable snapshot', () => {
    const run = validateRun(
      JSON.parse(
        readFileSync('experiments/mars-learning-001-adaptive/attempt-002/run.json', 'utf8'),
      ),
    );
    const frame = frameAt(run, durationOf(run));
    frame.state.oxygenReserve = 0;
    expect(frameAt(run, durationOf(run)).state.oxygenReserve).not.toBe(0);
  });
});
