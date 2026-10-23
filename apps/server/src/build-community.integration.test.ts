import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

test('community CLI publishes a complete verified suite, strips extra metadata and removes withdrawn replays', async () => {
  await mkdir('work', { recursive: true });
  const directory = await mkdtemp(resolve('work/community-build-test-'));
  const slugs = ['habitat-b-leak-v2', 'power-blackout-v2', 'oxygen-shortage-v2'];
  const paths = [];
  for (const [index, slug] of slugs.entries()) {
    const scenario = resolve(directory, 'scenarios/mars', slug);
    await mkdir(scenario, { recursive: true });
    for (const name of ['scenario.yaml', 'briefing.md'])
      await copyFile(resolve('scenarios/mars', slug, name), resolve(scenario, name));
    const path = `community/runs/entry-${index}.json`;
    await mkdir(resolve(directory, 'community/runs'), { recursive: true });
    const run = JSON.parse(await readFile(`runs/example-incident-00${index + 4}.json`, 'utf8'));
    run.metadata.model = { provider: 'test', configuration: { privateNote: 'metadata-canary' } };
    await writeFile(resolve(directory, path), JSON.stringify(run));
    paths.push(path);
  }
  const manifest = resolve(directory, 'community/submissions.json');
  await writeFile(
    manifest,
    JSON.stringify({
      suite: 'mars-operations-v2',
      entries: [{ entrant: 'test-user', model: 'scripted-fixture', runs: paths }],
    }),
  );
  const build = () =>
    execFileSync(
      process.execPath,
      ['--import', 'tsx', resolve('apps/server/src/build-community.ts')],
      { cwd: directory, encoding: 'utf8' },
    );
  build();
  const board = JSON.parse(
    await readFile(resolve(directory, 'apps/web/public/community/leaderboard.json'), 'utf8'),
  );
  expect(board.entries).toHaveLength(1);
  expect(board.entries[0].rank).toBe(1);
  expect(board.entries[0].score).toBeCloseTo(92.931, 3);
  const published = await readFile(
    resolve(directory, 'apps/web/public/community/entry-0-0.json'),
    'utf8',
  );
  expect(published).not.toContain('metadata-canary');
  await writeFile(manifest, JSON.stringify({ suite: 'mars-operations-v2', entries: [] }));
  build();
  await expect(
    readFile(resolve(directory, 'apps/web/public/community/entry-0-0.json')),
  ).rejects.toThrow();
});
