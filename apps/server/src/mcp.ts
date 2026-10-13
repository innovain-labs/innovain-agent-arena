import { writeFile } from 'node:fs/promises';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createMarsMcpServer } from '@arena/mars-mcp';
import { MarsSimulation } from '@arena/mars-world';
import { loadScenario } from './scenario-loader';

const simulation = new MarsSimulation(await loadScenario(process.env.ARENA_SCENARIO));
// The recorder belongs to the host, never to the MCP tool surface.
const recordPath = process.env.ARENA_RECORD_PATH;
const record = recordPath
  ? () =>
      writeFile(
        recordPath,
        JSON.stringify({
          events: simulation.journal.events,
          frames: simulation.journal.frames,
          state: simulation.state,
        }),
      )
  : undefined;
// Capture startup state even if a budget gate prevents the first tool call.
await record?.();
const server = createMarsMcpServer(simulation, record);
await server.connect(new StdioServerTransport());
process.stdin.on('end', async () => {
  await server.close();
});
