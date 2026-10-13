import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { marsIncidents } from '@arena/mars-world';

const filenames = marsIncidents.flatMap((incident) => [
  incident.rescueRecording,
  incident.failureRecording,
]);
const files = filenames.flatMap((name) => [`runs/${name}`, `apps/web/public/runs/${name}`]);
const before = await Promise.all(files.map((file) => readFile(file, 'utf8')));
const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', 'apps/server/src/generate-runs.ts'],
  { stdio: 'inherit' },
);
if (result.status !== 0) throw new Error('MCP run regeneration failed.');
const after = await Promise.all(files.map((file) => readFile(file, 'utf8')));
if (
  after.some((content, index) => content !== before[index]) ||
  filenames.some((_, index) => after[index * 2] !== after[index * 2 + 1])
)
  throw new Error(
    'Recordings are inconsistent with source or viewer copies. Review generated changes and run verification again.',
  );
console.log('All six real MCP recordings reproduce byte-for-byte and viewer copies match.');
