import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { AgentSession, rescuePlan } from './index';
import type { WorldState } from '@arena/arena-core';

test('a separate MCP stdio process executes and durably records the rescue', async () => {
  await mkdir('work', { recursive: true });
  const recordPath = resolve('work/stdio-integration-record.json');
  const session = new AgentSession();
  try {
    const tools = await session.connect(
      process.execPath,
      ['--import', 'tsx', 'apps/server/src/mcp.ts'],
      process.cwd(),
      {
        ...Object.fromEntries(
          Object.entries(process.env).filter(
            (entry): entry is [string, string] => entry[1] !== undefined,
          ),
        ),
        ARENA_RECORD_PATH: recordPath,
      },
    );
    expect(tools.tools.map((tool) => tool.name)).toContain('move_crew');
    for (const call of rescuePlan) expect((await session.call(call)).ok).toBe(true);
    const record = JSON.parse(await readFile(recordPath, 'utf8')) as { state: WorldState };
    expect(record.state.outcome).toBe('success');
    expect(record.state.crew.every((crew) => crew.status === 'safe')).toBe(true);
  } finally {
    await session.close();
  }
});
