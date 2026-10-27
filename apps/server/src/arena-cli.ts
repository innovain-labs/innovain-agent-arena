import { mkdir, readFile, writeFile, stat, realpath } from 'node:fs/promises';
import { dirname, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { currentMarsIncidents } from '@arena/mars-world';
import { executeLocalRun, parseLocalRunArgs, redactSecrets } from './run-local';
import { loadScenario } from './scenario-loader';
import { verifyCommunityRun } from './community';

const help = `Innovain Agent Arena — local runner (Node 24 recommended)
Usage: node arena.mjs <command> [options]
       pnpm arena -- <command> [options]   (source checkout)

Commands:
  list                         List the three current emergencies
  run [runner options]         Play one mission; --incident SLUG or --scenario YAML
  suite --entrant HANDLE ...   Play all three; generate a Community submission
  verify --directory PATH      Reproduce a submission against bundled canonical rules

Providers: scripted, ollama, openai, anthropic, deepseek, foundry, openai-compatible
Paid/local models require --model MODEL_OR_DEPLOYMENT.
Microsoft Foundry: --api-mode chat-completions|responses (default chat-completions).
Credentials: environment only; OPENAI_API_KEY, ANTHROPIC_API_KEY,
DEEPSEEK_API_KEY, AZURE_OPENAI_API_KEY, or --api-key-env CUSTOM_VARIABLE.
Endpoints: --base-url HTTPS_URL (required for foundry/openai-compatible).
Limits per mission: --max-tool-calls 60 --max-input-tokens 20000
--max-output-tokens 2000 --request-timeout-ms 30000. No automatic retries.
Optional prices: --input-price-usd-per-million N --output-price-usd-per-million N
enable --budget-usd N. Without prices, only token/call limits are enforced.
Suite: --output-dir PATH (default ./arena-results), --entrant PUBLIC_HANDLE.
Run: --output PATH. --help displays this message. No uploads or telemetry.
Examples:
  node arena.mjs suite --provider scripted --entrant demo
  node arena.mjs suite --provider openai --model YOUR_MODEL --entrant your-handle
  node arena.mjs verify --directory ./arena-results
`;

async function verify(directory: string) {
  const root = await realpath(directory);
  const manifestPath = resolve(root, 'submission.json');
  if ((await stat(manifestPath)).size > 64_000) throw new Error('Manifest exceeds 64 KB.');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.suite !== 'mars-operations-v2' || manifest.entries?.length !== 1)
    throw new Error('Expected one complete current Community submission.');
  const entry = manifest.entries[0];
  if (
    ![entry.entrant, entry.model].every(
      (value) => typeof value === 'string' && /^[a-zA-Z0-9 ._/@:+-]{1,160}$/.test(value),
    ) ||
    entry.runs?.length !== 3
  )
    throw new Error('Invalid submission identity or suite.');
  for (const [index, incident] of currentMarsIncidents.entries()) {
    if (typeof entry.runs[index] !== 'string') throw new Error('Invalid replay path.');
    const path = await realpath(resolve(root, entry.runs[index]));
    const within = relative(root, path);
    if (isAbsolute(within) || within.startsWith('..') || (await stat(path)).size > 5_000_000)
      throw new Error('Replay must be inside the submission and at most 5 MB.');
    const run = await verifyCommunityRun(
      JSON.parse(await readFile(path, 'utf8')),
      await loadScenario(resolve('scenarios/mars', incident.slug, 'scenario.yaml')),
    );
    console.log(`${incident.title}: ${run.finalOutcome}, reproduced score ${run.score.total}`);
  }
  console.log(
    'Valid Community actions and scores. Model identity is self-reported; this does not prove LLM use. Nothing was uploaded.',
  );
}

try {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  const command = args.shift();
  const callerDirectory = process.cwd();
  const bundled = fileURLToPath(import.meta.url).endsWith('.mjs');
  if (bundled) process.chdir(dirname(fileURLToPath(import.meta.url)));
  const take = (name: string, fallback?: string) => {
    const index = args.indexOf(`--${name}`);
    if (index < 0) return fallback;
    const value = args[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`--${name} requires a value.`);
    args.splice(index, 2);
    return value;
  };
  if (!command || command === '--help' || args.includes('--help')) console.log(help);
  else if (command === 'list')
    for (const incident of currentMarsIncidents)
      console.log(`${incident.slug}\n  ${incident.summary}`);
  else if (command === 'verify') {
    const directory = resolve(callerDirectory, take('directory', 'arena-results')!);
    if (args.length) throw new Error('Unknown verification options.');
    await verify(directory);
  } else if (command === 'run' || command === 'suite') {
    const entrant = take('entrant', 'local-user')!;
    if (!/^[a-zA-Z0-9_-]{1,50}$/.test(entrant))
      throw new Error('Entrant must be 1–50 letters, numbers, underscores or hyphens.');
    const directory = resolve(callerDirectory, take('output-dir', 'arena-results')!);
    const explicitOutput = take('output');
    const incidentSlug = take('incident');
    const options = parseLocalRunArgs(args);
    if (incidentSlug) {
      const incident = currentMarsIncidents.find((item) => item.slug === incidentSlug);
      if (!incident || options.scenarioPath || command === 'suite')
        throw new Error('Use --incident with a current slug from list for a single run only.');
      options.scenarioPath = resolve('scenarios/mars', incident.slug, 'scenario.yaml');
    } else if (options.scenarioPath)
      options.scenarioPath = resolve(callerDirectory, options.scenarioPath);
    if (command === 'run') {
      options.outputPath = resolve(callerDirectory, explicitOutput ?? options.outputPath);
      const run = await executeLocalRun(options);
      console.log(`${options.outputPath}: ${run.finalOutcome}, score ${run.score.total}`);
      if (run.finalOutcome === 'running') process.exitCode = 2;
    } else {
      if (!/^[a-zA-Z0-9 ._/@:+-]{1,160}$/.test(`${options.provider}/${options.model}`))
        throw new Error('Model label must contain at most 160 public identifier characters.');
      if (explicitOutput || options.scenarioPath)
        throw new Error('Suite fixes all three scenarios. Use --output-dir rather than --output.');
      await mkdir(dirname(directory), { recursive: true });
      try {
        await mkdir(directory);
      } catch {
        throw new Error(
          'Suite output directory already exists or cannot be created. Choose a new --output-dir to preserve previous attempts.',
        );
      }
      const runs: string[] = [];
      for (const incident of currentMarsIncidents) {
        const path = `community/runs/${entrant}/${incident.slug}.json`;
        const run = await executeLocalRun({
          ...options,
          scenarioPath: resolve('scenarios/mars', incident.slug, 'scenario.yaml'),
          outputPath: resolve(directory, path),
        });
        console.log(`${incident.title}: ${run.finalOutcome}, score ${run.score.total}`);
        if (run.finalOutcome === 'running')
          throw new Error(
            'Incomplete mission: inspect its replay and increase limits or adjust the model. Submission was not generated.',
          );
        runs.push(path);
      }
      await mkdir(directory, { recursive: true });
      await writeFile(
        resolve(directory, 'submission.json'),
        JSON.stringify(
          {
            suite: 'mars-operations-v2',
            entries: [{ entrant, model: `${options.provider}/${options.model}`, runs }],
          },
          null,
          2,
        ) + '\n',
      );
      await verify(directory);
      console.log(
        `Submission saved to ${directory}. Review it, then propose community/runs and the manifest entry via a GitHub pull request. It is eligible only for Community Top 10 after maintainer verification.`,
      );
    }
  } else throw new Error(`Unknown command: ${command}. Use --help.`);
} catch (error) {
  console.error(
    redactSecrets(
      error instanceof Error ? error.message : String(error),
      Object.entries(process.env)
        .filter(([key]) => /(key|token|secret|password|credential)/i.test(key))
        .map(([, value]) => value ?? ''),
    ),
  );
  process.exitCode = 1;
}
