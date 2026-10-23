import { describe, expect, test } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { MarsSimulation, parseScenario } from '@arena/mars-world';
import { createMarsMcpServer } from './index';

describe('real MCP protocol boundary', () => {
  test('negotiates protocol, lists nine tools, validates args, and hides research state', async () => {
    const simulation = new MarsSimulation(
      parseScenario(parse(readFileSync('scenarios/mars/habitat-b-leak/scenario.yaml', 'utf8'))),
    );
    const server = createMarsMcpServer(simulation);
    const client = new Client({ name: 'integration-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    try {
      const tools = await client.listTools();
      expect(tools.tools).toHaveLength(9);
      const response = await client.callTool({ name: 'get_colony_status', arguments: {} });
      const serialized = JSON.stringify(response);
      expect(serialized).not.toContain('scoring');
      expect(serialized).not.toContain('leakRate');
      expect(serialized).not.toContain('timedEvents');
      const invalid = await client.callTool({
        name: 'inspect_habitat',
        arguments: { habitat: 'Unknown' },
      });
      expect(invalid.isError).toBe(true);
      expect(simulation.state.time).toBe(1);
      const unsafe = await client.callTool({
        name: 'open_external_airlock',
        arguments: { habitat: 'B' },
      });
      expect(unsafe.isError).toBe(false);
      expect(simulation.state.outcome).toBe('failure');
    } finally {
      await client.close();
      await server.close();
    }
  });
});

test('v2 discovers twelve tools and validates interventions at the MCP boundary', async () => {
  const simulation = new MarsSimulation(
    parseScenario(parse(readFileSync('scenarios/mars/power-blackout-v2/scenario.yaml', 'utf8'))),
  );
  const server = createMarsMcpServer(simulation);
  const client = new Client({ name: 'v2-integration', version: '1.0.0' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(b);
  await client.connect(a);
  try {
    expect((await client.listTools()).tools).toHaveLength(12);
    expect(
      (await client.callTool({ name: 'set_consumption_mode', arguments: { mode: 'invalid' } }))
        .isError,
    ).toBe(true);
    expect(simulation.state.time).toBe(0);
    expect((await client.callTool({ name: 'reroute_power', arguments: {} })).isError).toBe(false);
    expect(simulation.state.power).toBe(22);
    const status = await client.callTool({ name: 'inspect_life_support', arguments: {} });
    expect(JSON.stringify(status)).toContain('powerRerouted');
    expect(JSON.stringify(status)).not.toContain('requirePowerReroute');
  } finally {
    await client.close();
    await server.close();
  }
});
