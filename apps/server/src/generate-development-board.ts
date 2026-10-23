import { readFile, writeFile } from 'node:fs/promises';
import { currentMarsIncidents } from '@arena/mars-world';
import { type LeaderboardArtifact } from '@arena/benchmarking';
import type { Run } from '@arena/arena-core';
import { loadScenario } from './scenario-loader';
import { verifyCommunityRun } from './community';

const board: LeaderboardArtifact = JSON.parse(
  await readFile('benchmarks/innovain-arena/leaderboard.json', 'utf8'),
);
if (process.argv.includes('--clear')) {
  board.entries = board.entries.filter((entry) => entry.source !== 'development-script');
  board.officialOnly = true;
  delete board.developmentFixtures;
} else {
  if (board.entries.some((entry) => entry.source === 'official'))
    throw new Error('Refusing to replace existing real evaluations with development fixtures.');
  board.developmentFixtures = true;
  board.officialOnly = false;
  board.entries = [];
  for (const unsafe of [false, true]) {
    const runs: Run[] = [];
    for (const incident of currentMarsIncidents) {
      const file = unsafe ? incident.failureRecording : incident.rescueRecording;
      runs.push(
        await verifyCommunityRun(
          JSON.parse(await readFile(`runs/${file}`, 'utf8')),
          await loadScenario(`scenarios/mars/${incident.slug}/scenario.yaml`),
        ),
      );
    }
    const mean = (values: number[]) =>
      values.reduce((sum, value) => sum + value, 0) / values.length;
    board.entries.push({
      rank: board.entries.length + 1,
      modelName: unsafe ? 'Scripted unsafe intervention (demo)' : 'Scripted cautious rescue (demo)',
      modelVersionId: unsafe ? 'scripted-unsafe-v2' : 'scripted-rescue-v2',
      provider: 'Innovain development scripts',
      benchmarkVersion: 'mars-operations-v2',
      evaluatedDate: new Date().toISOString().slice(0, 10),
      runsCompleted: runs.length,
      missionSuccessRate: runs.filter((run) => run.finalOutcome === 'success').length / runs.length,
      crewSurvival: mean(runs.map((run) => run.score.crewSurvival / 40)),
      safety: mean(runs.map((run) => (run.score.safety / 15) * 100)),
      efficiency: mean(runs.map((run) => (run.score.resourceEfficiency / 10) * 100)),
      averageOxygenUsed: mean(
        runs.map(
          (run) => run.frames[0]!.state.oxygenReserve - run.frames.at(-1)!.state.oxygenReserve,
        ),
      ),
      dangerousActions: runs.reduce((sum, run) => sum + run.score.dangerousActions, 0),
      unnecessaryToolCalls: 0,
      averageToolCalls: mean(
        runs.map((run) => run.events.filter((event) => event.type === 'tool_called').length),
      ),
      totalTokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      totalCost: 0,
      averageCostPerRun: 0,
      overallScore: mean(runs.map((run) => run.score.total)),
      watchRunReference: `runs/${unsafe ? currentMarsIncidents[0]!.failureRecording : currentMarsIncidents[0]!.rescueRecording}`,
      source: 'development-script',
      official: false,
    });
  }
}
for (const path of [
  'benchmarks/innovain-arena/leaderboard.json',
  'apps/web/public/benchmarks/innovain-arena/leaderboard.json',
])
  await writeFile(path, JSON.stringify(board, null, 2) + '\n');
console.log(
  board.developmentFixtures
    ? 'Two temporary scripted examples restored; not real model evaluations.'
    : 'Development examples removed.',
);
