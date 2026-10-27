import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import type { Run } from '@arena/arena-core';
import { currentMarsIncidents } from '@arena/mars-world';
import { validateRun } from '@arena/replay';
import { executeLocalRun, parseLocalRunArgs, pricingFor } from './run-local';
import type { LocalRunOptions } from './run-local';
import { verifyCommunityRun } from './community';
import {
  buildInnovainLeaderboard,
  INNOVAIN_BENCHMARK_ID,
  INNOVAIN_BENCHMARK_VERSION,
} from './innovain-leaderboard';
import { loadScenario } from './scenario-loader';

function takeOption(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  args.splice(index, 2);
  return value;
}

function safeSlug(value: string): string {
  return value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function readResumableRun(
  path: string,
  scenarioId: string,
  seed: number,
  deployment: string,
  modelVersion: string,
  pricingId: string,
  provider: LocalRunOptions['provider'],
  apiMode: LocalRunOptions['apiMode'],
  canonical: Awaited<ReturnType<typeof loadScenario>>,
): Promise<Run | undefined> {
  try {
    const run = validateRun(JSON.parse(await readFile(path, 'utf8')) as unknown);
    const model = run.metadata.model;
    const alreadyPromoted =
      run.metadata.official === true &&
      run.metadata.benchmarkId === INNOVAIN_BENCHMARK_ID &&
      run.metadata.benchmarkVersion === INNOVAIN_BENCHMARK_VERSION;
    if (
      run.finalOutcome === 'running' ||
      run.metadata.scenarioId !== scenarioId ||
      run.metadata.seed !== seed ||
      (run.metadata.official !== false && !alreadyPromoted) ||
      !(
        model?.provider === provider ||
        (['foundry', 'anthropic'].includes(provider) && model?.provider === 'Microsoft Foundry')
      ) ||
      (apiMode === 'responses' &&
        model.configuration?.api !==
          (alreadyPromoted ? 'azure-openai-responses-v1' : 'responses')) ||
      (model?.deployment ?? model?.model) !== deployment ||
      (alreadyPromoted && model.version !== modelVersion) ||
      (model.configuration?.stopReason &&
        model.configuration.stopReason !== 'MODEL_STOPPED_BEFORE_TERMINAL_OUTCOME') ||
      !run.metadata.usage ||
      !run.metadata.cost ||
      (alreadyPromoted && run.metadata.cost.pricingSnapshotId !== pricingId)
    )
      return undefined;
    const replayForPhysics = structuredClone(run);
    replayForPhysics.metadata.official = false;
    delete replayForPhysics.metadata.benchmarkId;
    delete replayForPhysics.metadata.benchmarkVersion;
    await verifyCommunityRun(replayForPhysics, canonical, { allowAgentStopped: true });
    return run;
  } catch {
    return undefined;
  }
}

export function foundryConnectionFor(options: LocalRunOptions) {
  if (options.provider === 'foundry')
    return {
      api:
        options.apiMode === 'responses'
          ? ('azure-openai-responses-v1' as const)
          : ('azure-openai-v1' as const),
      authentication: 'api-key (secret not retained)' as const,
    };
  if (options.provider !== 'anthropic' || !options.baseUrl)
    throw new Error('Innovain official evaluation requires a supported Microsoft Foundry API.');
  const endpoint = new URL(options.baseUrl);
  if (
    !endpoint.hostname.endsWith('.services.ai.azure.com') ||
    endpoint.pathname.replace(/\/+$/, '') !== '/anthropic/v1' ||
    !/^claude-/i.test(options.model)
  )
    throw new Error(
      'Foundry Claude requires a deployment name beginning with claude- and a Foundry /anthropic/v1 endpoint.',
    );
  return {
    api: 'anthropic-messages-v1' as const,
    authentication: 'x-api-key (secret not retained)' as const,
  };
}

export async function runInnovainEvaluation(argv: string[]): Promise<void> {
  const args = [...argv].filter((argument) => argument !== '--');
  const resumeIndex = args.indexOf('--resume');
  const resume = resumeIndex >= 0;
  if (resume) args.splice(resumeIndex, 1);
  const attemptsPerIncident = Number(takeOption(args, '--attempts') ?? '3');
  const suiteBudgetUsd = Number(takeOption(args, '--suite-budget-usd') ?? '0.06');
  const catalogModel = takeOption(args, '--catalog-model');
  const catalogVersion = takeOption(args, '--catalog-version');
  const evaluationId = takeOption(args, '--evaluation-id');
  const region = takeOption(args, '--region') ?? 'eastus2';
  const deploymentType = takeOption(args, '--deployment-type') ?? 'GlobalStandard';
  const priceEffectiveDate = takeOption(args, '--price-effective-date');
  const priceSource = takeOption(args, '--price-source');
  if (!Number.isInteger(attemptsPerIncident) || attemptsPerIncident < 1 || attemptsPerIncident > 5)
    throw new Error('--attempts must be an integer from 1 to 5.');
  if (!Number.isFinite(suiteBudgetUsd) || suiteBudgetUsd <= 0)
    throw new Error('--suite-budget-usd must be a positive finite amount.');
  if (args.includes('--scenario') || args.includes('--output'))
    throw new Error('Innovain evaluation fixes the complete suite and its output paths.');
  const options = parseLocalRunArgs(args);
  if (options.provider !== 'foundry' && options.provider !== 'anthropic')
    throw new Error('Innovain official evaluation requires Azure Foundry.');
  if (!options.baseUrl || !options.apiKeyEnv)
    throw new Error('Azure Foundry endpoint and local API-key environment variable are required.');
  if (
    options.inputPriceUsdPerMillion === undefined ||
    options.outputPriceUsdPerMillion === undefined
  )
    throw new Error('Set both explicit pricing flags so the suite can enforce its cost limit.');
  const modelName = catalogModel ?? options.model;
  const modelVersion = catalogVersion ?? 'unversioned';
  const connection = foundryConnectionFor(options);
  if (options.provider === 'anthropic' && !/^claude-/i.test(modelName))
    throw new Error('The Foundry Anthropic Messages API can only be recorded for Claude models.');
  if (!/^[a-zA-Z0-9 ._/@:+-]{1,160}$/.test(modelName) || !modelVersion)
    throw new Error('Catalog model identity is invalid.');

  const plannedRuns = currentMarsIncidents.length * attemptsPerIncident;
  const worstCaseCost =
    ((options.maxInputTokens * options.inputPriceUsdPerMillion +
      options.maxOutputTokens * options.outputPriceUsdPerMillion) /
      1_000_000) *
    plannedRuns;
  if (worstCaseCost > suiteBudgetUsd + 1e-9)
    throw new Error(
      `Token ceilings could cost up to $${worstCaseCost.toFixed(4)}, above the suite budget $${suiteBudgetUsd.toFixed(4)}. Reduce limits or raise the explicit cap.`,
    );
  const pricing = pricingFor(options);
  if (!pricing) throw new Error('A dated pricing snapshot is required for official evaluation.');
  const effectiveDate =
    priceEffectiveDate ??
    (modelName === 'gpt-5.6-luna' &&
    options.inputPriceUsdPerMillion === 0.2 &&
    options.outputPriceUsdPerMillion === 1.2
      ? '2026-07-30'
      : undefined);
  const source =
    priceSource ??
    (modelName === 'gpt-5.6-luna' && effectiveDate
      ? 'Microsoft Azure GPT-5.6 Luna Global Standard pricing table, 2026-07-30 update'
      : undefined);
  if (!effectiveDate || !source)
    throw new Error('Set --price-effective-date and --price-source for this model price snapshot.');
  const pricingId = `azure-foundry-${safeSlug(modelName)}-${effectiveDate}-${safeSlug(deploymentType)}`;
  const dateTime = new Date().toISOString();
  const id =
    evaluationId ?? `${safeSlug(modelName)}-${dateTime.replaceAll(/[-:.]/g, '').replace('Z', 'z')}`;
  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(id)) throw new Error('Invalid --evaluation-id.');
  const directory = resolve('benchmarks/innovain-arena/evaluations', id);
  if (resume) {
    let manifestExists = true;
    try {
      await access(resolve(directory, 'evaluation.json'));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') manifestExists = false;
      else throw error;
    }
    if (manifestExists)
      throw new Error(`Evaluation ${id} already has a manifest and cannot be resumed.`);
    await mkdir(directory, { recursive: true });
  } else {
    await mkdir(dirname(directory), { recursive: true });
    await mkdir(directory);
  }
  const runDirectory = resolve(directory, 'runs');
  await mkdir(runDirectory, { recursive: resume });
  const providerName = 'Microsoft Foundry';
  const officialRuns: Array<{
    scenarioSlug: string;
    attempt: number;
    seed: number;
    reference: string;
  }> = [];
  let suiteTokens = 0;
  const perRunBudget = suiteBudgetUsd / plannedRuns;

  for (const incident of currentMarsIncidents) {
    const scenarioPath = resolve('scenarios/mars', incident.slug, 'scenario.yaml');
    const canonical = await loadScenario(scenarioPath);
    for (let attempt = 1; attempt <= attemptsPerIncident; attempt += 1) {
      const seed = options.seed + attempt - 1;
      const reference = `runs/${incident.slug}-attempt-${String(attempt).padStart(2, '0')}.json`;
      const outputPath = resolve(directory, reference);
      let run = resume
        ? await readResumableRun(
            outputPath,
            canonical.metadata.id,
            seed,
            options.model,
            modelVersion,
            pricingId,
            options.provider,
            options.apiMode,
            canonical,
          )
        : undefined;
      if (run) console.log(`Reusing verified completed replay: ${reference}`);
      else {
        console.log(`Running ${incident.title} · attempt ${attempt}/${attemptsPerIncident}…`);
        run = await executeLocalRun({
          ...options,
          scenarioPath,
          seed,
          outputPath,
          budgetUsd: Math.min(options.budgetUsd, perRunBudget),
        });
      }
      if (run.finalOutcome === 'running')
        throw new Error(
          `${incident.slug} attempt ${attempt} did not finish; its partial replay is preserved, but the suite will not enter Innovain Top 10.`,
        );
      const replayForPhysics = structuredClone(run);
      replayForPhysics.metadata.official = false;
      delete replayForPhysics.metadata.benchmarkId;
      delete replayForPhysics.metadata.benchmarkVersion;
      await verifyCommunityRun(replayForPhysics, canonical, { allowAgentStopped: true });
      const reportedModel = run.metadata.model?.configuration?.providerReportedModel;
      const stopReason = run.metadata.model?.configuration?.stopReason;
      run.metadata.id = `innovain-${id}-${incident.slug}-${attempt}`;
      run.metadata.agent = `${providerName}/${modelName}`;
      run.metadata.model = {
        provider: providerName,
        model: modelName,
        version: modelVersion,
        deployment: options.model,
        configuration: {
          runner: 'innovain-evaluation-v1',
          api: connection.api,
          region,
          deploymentType,
          endpoint: options.baseUrl,
          ...(options.apiMode === 'responses' ? { reasoningEffort: 'medium' } : {}),
          ...(typeof reportedModel === 'string' ? { providerReportedModel: reportedModel } : {}),
          ...(typeof stopReason === 'string' ? { stopReason } : {}),
        },
      };
      run.metadata.benchmarkId = INNOVAIN_BENCHMARK_ID;
      run.metadata.benchmarkVersion = INNOVAIN_BENCHMARK_VERSION;
      run.metadata.official = true;
      if (run.metadata.cost) run.metadata.cost.pricingSnapshotId = pricingId;
      validateRun(run);
      await writeFile(outputPath, JSON.stringify(run, null, 2) + '\n');
      officialRuns.push({ scenarioSlug: incident.slug, attempt, seed, reference });
      suiteTokens += run.metadata.usage?.totalTokens ?? 0;
      console.log(
        `  ${run.finalOutcome}; score ${run.score.total}; ${run.metadata.usage?.totalTokens ?? 0} tokens.`,
      );
    }
  }

  const manifest = {
    formatVersion: 1 as const,
    benchmarkId: INNOVAIN_BENCHMARK_ID,
    benchmarkVersion: INNOVAIN_BENCHMARK_VERSION,
    source: 'official' as const,
    official: true as const,
    verified: true as const,
    evaluatedAt: dateTime,
    seed: options.seed,
    model: {
      provider: providerName,
      model: modelName,
      version: modelVersion,
      deployment: options.model,
    },
    connection: {
      endpoint: options.baseUrl,
      ...connection,
    },
    pricing: {
      id: pricingId,
      effectiveDate,
      inputUsdPerMillionTokens: options.inputPriceUsdPerMillion,
      outputUsdPerMillionTokens: options.outputPriceUsdPerMillion,
      source,
    },
    budget: {
      maxUsd: suiteBudgetUsd,
      maxInputTokens: options.maxInputTokens,
      maxOutputTokens: options.maxOutputTokens,
      maxToolCalls: options.maxToolCalls,
      attemptsPerIncident,
      minRequestIntervalMs: options.minRequestIntervalMs,
      requestTimeoutMs: options.requestTimeoutMs,
    },
    runs: officialRuns,
  };
  await writeFile(resolve(directory, 'evaluation.json'), JSON.stringify(manifest, null, 2) + '\n');
  const board = await buildInnovainLeaderboard();
  const row = board.entries.find(
    (entry) => entry.modelVersionId === `${modelName}@${modelVersion}`,
  );
  console.log(
    `Official Innovain evaluation recorded: ${row?.runsCompleted ?? plannedRuns} runs, score ${row?.overallScore.toFixed(2) ?? 'n/a'}, ${suiteTokens} tokens, estimated cost $${row?.totalCost.toFixed(4) ?? 'n/a'}.`,
  );
  console.log(`Evaluation files: ${relative(resolve('.'), directory).replaceAll('\\', '/')}`);
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/run-innovain-evaluation.ts')) {
  try {
    await runInnovainEvaluation(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
