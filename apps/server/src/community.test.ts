import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { expect, test } from 'vitest';
import { parseScenario } from '@arena/mars-world';
import { verifyCommunityRun } from './community';
const read = () => JSON.parse(readFileSync('runs/example-incident-004.json', 'utf8'));
const canonical = parseScenario(
  parse(readFileSync('scenarios/mars/habitat-b-leak-v2/scenario.yaml', 'utf8')),
);
test('community verification reproduces an authentic run but does not assert model identity', async () => {
  expect((await verifyCommunityRun(read(), canonical)).finalOutcome).toBe('success');
});
test('community verification rejects forged scoring, physics, frames and official promotion', async () => {
  for (const mutate of [
    (r: ReturnType<typeof read>) => {
      r.score.total = 100;
    },
    (r: ReturnType<typeof read>) => {
      r.metadata.scenario.initialState.oxygenReserve = 100;
    },
    (r: ReturnType<typeof read>) => {
      r.frames[1].state.power = 0;
    },
    (r: ReturnType<typeof read>) => {
      r.metadata.official = true;
    },
    (r: ReturnType<typeof read>) => {
      r.metadata.toolContractVersion = 'mars-mcp-v1';
    },
  ]) {
    const run = read();
    mutate(run);
    await expect(verifyCommunityRun(run, canonical)).rejects.toThrow();
  }
});
