import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, writeFile, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { unzipSync } from 'fflate';
import { expect, test } from 'vitest';

test('downloaded runner executes outside the source checkout and rejects a forged submission', async () => {
  execFileSync(process.execPath, ['--import', 'tsx', 'apps/server/src/package-runner.ts'], {
    cwd: resolve('.'),
    stdio: 'pipe',
  });
  const files = unzipSync(readFileSync('apps/web/public/downloads/agent-arena-runner.zip'));
  expect(
    Object.keys(files).some((path) => /node_modules|\/work\/|arena-results|\.env/.test(path)),
  ).toBe(false);
  expect(Object.keys(files)).toContain('agent-arena-runner/THIRD_PARTY_NOTICES.txt');
  await mkdir('work', { recursive: true });
  const root = await mkdtemp(resolve('work/portable runner test-'));
  for (const [name, contents] of Object.entries(files)) {
    await mkdir(dirname(resolve(root, name)), { recursive: true });
    await writeFile(resolve(root, name), contents);
  }
  const cli = resolve(root, 'agent-arena-runner/arena.mjs');
  const run = (args: string[]) =>
    execFileSync(process.execPath, [cli, ...args], { cwd: root, encoding: 'utf8' });
  expect(run(['suite', '--provider', 'scripted', '--entrant', 'fixture'])).toContain(
    'Nothing was uploaded',
  );
  expect(run(['verify', '--directory', 'arena-results'])).toContain('reproduced score');
  const manifest = JSON.parse(
    await readFile(resolve(root, 'arena-results/submission.json'), 'utf8'),
  );
  const replay = resolve(root, 'arena-results', manifest.entries[0].runs[0]);
  const data = JSON.parse(await readFile(replay, 'utf8'));
  expect(data.metadata.official).toBe(false);
  data.score.total = 100;
  await writeFile(replay, JSON.stringify(data));
  expect(() => run(['verify', '--directory', 'arena-results'])).toThrow();
}, 30_000);
