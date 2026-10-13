import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  STANDARD_BENCHMARK_V1,
  buildLeaderboard,
  type BenchmarkModelResult,
} from '@arena/benchmarking';

const modelRoot = resolve('benchmarks', STANDARD_BENCHMARK_V1.benchmarkId, 'models');
const entries = await (async () => {
  try {
    return await (await import('node:fs/promises')).readdir(modelRoot, { withFileTypes: true });
  } catch {
    return [];
  }
})();
const results: BenchmarkModelResult[] = [];
for (const entry of entries) {
  if (!entry.isDirectory()) continue;
  try {
    results.push(
      JSON.parse(
        await readFile(resolve(modelRoot, entry.name, 'summary.json'), 'utf8'),
      ) as BenchmarkModelResult,
    );
  } catch {
    // Invalid or partial model artifacts are excluded from the official board.
  }
}
const leaderboard = buildLeaderboard(results, '2026-09-17');
const outputDirectory = resolve('benchmarks', STANDARD_BENCHMARK_V1.benchmarkId);
await mkdir(outputDirectory, { recursive: true });
await writeFile(
  resolve(outputDirectory, 'leaderboard.json'),
  JSON.stringify(leaderboard, null, 2) + '\n',
);
console.log(JSON.stringify(leaderboard, null, 2));
