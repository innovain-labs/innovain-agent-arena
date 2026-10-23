import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMarsMcpServer } from '@arena/mars-mcp';
import { isDeepStrictEqual } from 'node:util';
import type { Run } from '@arena/arena-core';
import { MarsSimulation, parseScenario, type MarsScenario } from '@arena/mars-world';
import { validateRun } from '@arena/replay';
import { calculateScore } from '@arena/scoring';

/** Recompute consequences against a trusted host scenario; model provenance remains self-reported. */
export async function verifyCommunityRun(
  value: unknown,
  canonical: MarsScenario,
  options: { allowAgentStopped?: boolean } = {},
): Promise<Run> {
  const run = validateRun(value);
  const agentStopped =
    run.metadata.model?.configuration?.stopReason === 'MODEL_STOPPED_BEFORE_TERMINAL_OUTCOME';
  if (run.events.length > 20_000 || run.frames.length > 10_000)
    throw new Error('Community journal limit exceeded.');
  if (
    run.metadata.protocol !== 'MCP/stdio' ||
    run.metadata.official ||
    run.metadata.toolContractVersion !== 'mars-mcp-v2' ||
    canonical.rulesVersion !== 2 ||
    run.metadata.scenarioId !== canonical.metadata.id ||
    !isDeepStrictEqual(parseScenario(run.metadata.scenario), canonical)
  )
    throw new Error(
      'Community submission does not match the v2 canonical scenario and tool contract.',
    );
  const world = new MarsSimulation(canonical);
  const calls = run.events.filter((event) => event.type === 'tool_called');
  if (calls.length > 100) throw new Error('Community tool-call limit exceeded.');
  const server = createMarsMcpServer(world);
  const client = new Client({ name: 'community-verifier', version: '0.2.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    for (const call of calls)
      await client.callTool({
        name: String(call.data.name),
        arguments: call.data.arguments as Record<string, unknown>,
      });
    if (agentStopped) {
      if (!options.allowAgentStopped)
        throw new Error('Community runs cannot add the official model-stopped terminal marker.');
      world.markAgentStopped();
    }
  } finally {
    await client.close();
    await server.close();
  }
  const score = calculateScore(
    world.state,
    world.journal.events,
    canonical.initialState.oxygenReserve,
    canonical.modifiers.maximumTime,
    canonical.scoring,
  );
  if (
    !isDeepStrictEqual(world.journal.events, run.events) ||
    !isDeepStrictEqual(world.journal.frames, run.frames) ||
    !isDeepStrictEqual(score, run.score) ||
    run.finalOutcome !== world.state.outcome
  )
    throw new Error('Community replay, outcome or score does not reproduce.');
  if (run.finalOutcome === 'running')
    throw new Error('Community submissions require completed missions.');
  return run;
}
