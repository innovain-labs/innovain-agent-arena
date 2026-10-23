import { mkdir, readFile, writeFile, readdir, unlink, stat, realpath } from 'node:fs/promises';
import { resolve, relative, isAbsolute } from 'node:path';
import { marsIncidents } from '@arena/mars-world';
import { loadScenario } from './scenario-loader';
import { verifyCommunityRun } from './community';

if ((await stat('community/submissions.json')).size > 64_000)
  throw new Error('Manifest exceeds 64 KB.');
const manifest = JSON.parse(await readFile('community/submissions.json', 'utf8')) as {
  suite: string;
  entries: Array<{ entrant: string; model: string; runs: string[] }>;
};
if (manifest.suite !== 'mars-operations-v2' || !Array.isArray(manifest.entries))
  throw new Error('Unsupported community suite.');
if (manifest.entries.length > 500) throw new Error('Submission limit exceeded.');
const incidents = marsIncidents.filter((incident) => incident.slug.endsWith('-v2'));
const output = resolve('apps/web/public/community');
await mkdir(output, { recursive: true });
const seen = new Set<string>();
const replays = new Map<string, string>();
const entries = [];
for (const [index, entry] of manifest.entries.entries()) {
  if (
    ![entry.entrant, entry.model].every(
      (value) => typeof value === 'string' && /^[a-zA-Z0-9 ._/@:+-]{1,160}$/.test(value),
    ) ||
    !Array.isArray(entry.runs) ||
    entry.runs.length !== incidents.length
  )
    throw new Error('Invalid community identity or incomplete suite.');
  const identity = `${entry.entrant}/${entry.model}`;
  if (seen.has(identity)) throw new Error('Duplicate community identity.');
  seen.add(identity);
  const scores = [];
  const references = [];
  for (const [position, incident] of incidents.entries()) {
    const file = entry.runs[position]!;
    if (typeof file !== 'string') throw new Error('Invalid run path.');
    const path = await realpath(resolve(file));
    const within = relative(await realpath(resolve('community/runs')), path);
    if (within.startsWith('..') || isAbsolute(within))
      throw new Error('Run must be under community/runs.');
    if ((await stat(path)).size > 5_000_000) throw new Error('Run exceeds 5 MB.');
    const raw = await readFile(path, 'utf8');
    if (/(?:sk-(?:proj-|ant-api)[a-zA-Z0-9_-]{12,}|Bearer\s+[a-zA-Z0-9._-]{20,})/i.test(raw))
      throw new Error('Possible credential found. Review the replay privately before submission.');
    if (Buffer.byteLength(raw) > 5_000_000) throw new Error('Run exceeds 5 MB.');
    const scenario = await loadScenario(resolve('scenarios/mars', incident.slug, 'scenario.yaml'));
    const run = await verifyCommunityRun(JSON.parse(raw), scenario);
    const reference = `community/entry-${index}-${position}.json`;
    // Publish only selected metadata. Review free-text tool arguments before merging submissions.
    run.metadata = {
      id: `community-${index}-${position}`,
      scenarioId: scenario.metadata.id,
      scenarioName: scenario.metadata.name,
      scenarioVersion: 2,
      toolContractVersion: 'mars-mcp-v2',
      agent: identity,
      seed: 183,
      recordedAt: run.metadata.recordedAt,
      protocol: 'MCP/stdio',
      briefing: await readFile(resolve('scenarios/mars', incident.slug, 'briefing.md'), 'utf8'),
      scenario,
      official: false,
    };
    replays.set(`entry-${index}-${position}.json`, JSON.stringify(run, null, 2) + '\n');
    scores.push(run.score.total);
    references.push(reference);
  }
  entries.push({
    entrant: entry.entrant,
    model: entry.model,
    score: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 1000) / 1000,
    runs: references,
    provenance: 'self-reported',
    verification: 'reproduced',
  });
}
entries.sort(
  (a, b) =>
    b.score - a.score || a.entrant.localeCompare(b.entrant) || a.model.localeCompare(b.model),
);
// Validate the entire intake before publishing. Remove only owned generated replay files.
const selected = new Set(
  entries
    .slice(0, 10)
    .flatMap((entry) => entry.runs.map((reference) => reference.slice('community/'.length))),
);
for (const name of await readdir(output))
  if (/^entry-\d+-\d+\.json$/.test(name) && !selected.has(name))
    await unlink(resolve(output, name));
for (const name of selected) await writeFile(resolve(output, name), replays.get(name)!);
await writeFile(
  resolve(output, 'leaderboard.json'),
  JSON.stringify(
    {
      suite: manifest.suite,
      toolContractVersion: 'mars-mcp-v2',
      source: 'community',
      entries: entries.slice(0, 10).map((entry, index) => ({ rank: index + 1, ...entry })),
    },
    null,
    2,
  ) + '\n',
);
console.log(
  `Community board: ${entries.length} reviewed submissions, canonical v2 replays verified.`,
);
