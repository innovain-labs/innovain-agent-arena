import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { zipSync } from 'fflate';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { currentMarsIncidents } from '@arena/mars-world';

const directory = resolve('dist/agent-arena-runner');
await mkdir(directory, { recursive: true });
const result = await build({
  entryPoints: { arena: 'apps/server/src/arena-cli.ts', mcp: 'apps/server/src/mcp.ts' },
  outdir: directory,
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  metafile: true,
  outExtension: { '.js': '.mjs' },
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
});
const packageRoots = new Set<string>();
for (const input of Object.keys(result.metafile.inputs)) {
  if (!input.includes('node_modules/')) continue;
  let candidate = dirname(resolve(input));
  while (candidate !== dirname(candidate)) {
    try {
      await readFile(resolve(candidate, 'package.json'));
      packageRoots.add(candidate);
      break;
    } catch {
      candidate = dirname(candidate);
    }
  }
}
const notices: string[] = [];
for (const root of [...packageRoots].sort()) {
  const info = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  notices.push(`${info.name} ${info.version} — ${info.license ?? 'see license below'}`);
  for (const file of await readdir(root))
    if (/^(license|licence|notice|copying)(\.|$)/i.test(file)) {
      try {
        notices.push(await readFile(resolve(root, file), 'utf8'));
      } catch {
        /* License directory, not a text file. */
      }
    }
}
await writeFile(resolve(directory, 'THIRD_PARTY_NOTICES.txt'), notices.join('\n\n'));
for (const incident of currentMarsIncidents)
  await cp(
    resolve('scenarios/mars', incident.slug),
    resolve(directory, 'scenarios/mars', incident.slug),
    { recursive: true },
  );
await cp('LICENSE', resolve(directory, 'LICENSE'));
await cp('docs/local-runner.md', resolve(directory, 'README.md'));
for (const doc of ['community-leaderboard.md', 'mcp-tools.md'])
  await cp(`docs/${doc}`, resolve(directory, doc));
await writeFile(resolve(directory, 'start.cmd'), '@echo off\r\nnode "%~dp0arena.mjs" %*\r\n');
const hashes = [];
for (const file of ['arena.mjs', 'mcp.mjs'])
  hashes.push(
    `${createHash('sha256')
      .update(await readFile(resolve(directory, file)))
      .digest('hex')}  ${file}`,
  );
await writeFile(resolve(directory, 'SHA256SUMS'), hashes.join('\n') + '\n');
const files: Record<string, Uint8Array> = {};
// Explicit distribution allowlist: never package a prior user's work/results or extra files.
for (const name of [
  'arena.mjs',
  'mcp.mjs',
  'README.md',
  'LICENSE',
  'THIRD_PARTY_NOTICES.txt',
  'community-leaderboard.md',
  'mcp-tools.md',
  'start.cmd',
  'SHA256SUMS',
  ...currentMarsIncidents.flatMap((incident) =>
    ['scenario.yaml', 'briefing.md'].map((file) => `scenarios/mars/${incident.slug}/${file}`),
  ),
])
  files[`agent-arena-runner/${name}`] = await readFile(resolve(directory, name));
const archive = zipSync(files);
await mkdir('apps/web/public/downloads', { recursive: true });
await writeFile('apps/web/public/downloads/agent-arena-runner.zip', archive);
await writeFile(
  'apps/web/public/downloads/agent-arena-runner.sha256',
  `${createHash('sha256').update(archive).digest('hex')}  agent-arena-runner.zip\n`,
);
console.log(
  `Portable runner: ${directory}. Requires Node; no pnpm, source checkout or API keys included.`,
);
