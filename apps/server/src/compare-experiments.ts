import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { compareExperiments, type ExperimentSummary } from '@arena/experiments';

const baselineId = process.argv[2] ?? 'mars-learning-001-baseline';
const adaptiveId = process.argv[3] ?? 'mars-learning-001-adaptive';
const baseline = JSON.parse(
  await readFile(resolve('experiments', baselineId, 'summary.json'), 'utf8'),
) as ExperimentSummary;
const adaptive = JSON.parse(
  await readFile(resolve('experiments', adaptiveId, 'summary.json'), 'utf8'),
) as ExperimentSummary;
const comparison = {
  formatVersion: 1,
  baselineExperiment: baseline.experimentId,
  adaptiveExperiment: adaptive.experimentId,
  sameTrainingSeeds:
    JSON.stringify(baseline.trainingSeeds) === JSON.stringify(adaptive.trainingSeeds),
  sameHoldoutSeeds: JSON.stringify(baseline.holdoutSeeds) === JSON.stringify(adaptive.holdoutSeeds),
  metrics: compareExperiments(baseline, adaptive),
};
await writeFile(
  resolve('experiments', `${adaptiveId}-vs-${baselineId}.json`),
  JSON.stringify(comparison, null, 2) + '\n',
);
console.log(JSON.stringify(comparison, null, 2));
