import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AgentSession, scriptedPlanFor } from '@arena/agent-runner';
import { marsIncidents } from '@arena/mars-world';
import { safeChildEnvironment } from './host-environment';
import { calculateScore } from '@arena/scoring';
import type { ArenaEvent, Frame, Run, WorldState } from '@arena/arena-core';
import { loadScenario } from './scenario-loader';
import { validateRun } from '@arena/replay';

await mkdir('work', { recursive: true });
await mkdir('runs', { recursive: true });
await mkdir('apps/web/public/runs', { recursive: true });
for (const incident of marsIncidents) {
  const scenarioPath = resolve('scenarios/mars', incident.slug, 'scenario.yaml');
  const scenario = await loadScenario(scenarioPath);
  const briefing = await readFile(resolve('scenarios/mars', incident.slug, 'briefing.md'), 'utf8');
  for (const id of ['rescue', 'unsafe'] as const) {
    const plan = scriptedPlanFor(scenario.metadata.id, id === 'unsafe');
    const recordPath = resolve(`work/${incident.number}-${id}-record.json`);
    const session = new AgentSession();
    try {
      const tools = await session.connect(
        process.execPath,
        ['--import', 'tsx', 'apps/server/src/mcp.ts'],
        process.cwd(),
        {
          ...safeChildEnvironment(),
          ARENA_SCENARIO: scenarioPath,
          ARENA_RECORD_PATH: recordPath,
        },
      );
      if (tools.tools.length !== 9) throw new Error('Expected all nine Mars MCP tools.');
      for (const call of plan) {
        const result = await session.call(call);
        if (!result.ok && id === 'rescue')
          throw new Error(`Scripted plan rejected: ${result.message}`);
      }
    } finally {
      await session.close();
    }
    // The recording is written by the server host and cannot be queried by the agent.
    const recording = JSON.parse(await readFile(recordPath, 'utf8')) as {
      events: ArenaEvent[];
      frames: Frame[];
      state: WorldState;
    };
    const run: Run = {
      formatVersion: 1,
      metadata: {
        id: `incident-${incident.number}-${id}`,
        scenarioId: scenario.metadata.id,
        scenarioName: scenario.metadata.name,
        agent: id === 'rescue' ? 'Scripted / cautious rescue' : 'Scripted / unsafe intervention',
        seed: 183,
        recordedAt:
          incident.number === '001' ? '2026-09-14T00:00:00.000Z' : '2026-10-13T00:00:00.000Z',
        protocol: 'MCP/stdio',
        briefing,
        scenario,
      },
      events: recording.events,
      frames: recording.frames,
      finalOutcome: recording.state.outcome,
      score: calculateScore(
        recording.state,
        recording.events,
        scenario.initialState.oxygenReserve,
        scenario.modifiers.maximumTime,
        scenario.scoring,
      ),
    };
    validateRun(run);
    if (run.finalOutcome !== (id === 'rescue' ? 'success' : 'failure'))
      throw new Error(`Unexpected outcome for ${id}: ${run.finalOutcome}.`);
    const filename = id === 'rescue' ? incident.rescueRecording : incident.failureRecording;
    const serialized = JSON.stringify(run, null, 2) + '\n';
    await writeFile(resolve('runs', filename), serialized);
    await writeFile(resolve('apps/web/public/runs', filename), serialized);
    console.log(
      `${filename}: ${run.finalOutcome}, score ${run.score.total}, ${run.events.length} events, real MCP stdio.`,
    );
  }
}
