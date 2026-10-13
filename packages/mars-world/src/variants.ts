import { clone, type HabitatId } from '@arena/arena-core';
import { parseScenario, type MarsScenario } from './scenario';

export type VariantSplit = 'training' | 'holdout';

export interface ScenarioVariantMetadata {
  id: string;
  baseScenarioId: string;
  seed: number;
  split: VariantSplit;
  parameters: {
    leakHabitat: HabitatId;
    leakRate: number;
    isolationLeakFactor: number;
    crewHabitat: HabitatId;
    oxygenReserve: number;
    initialPower: number;
    blockedPath?: string;
    backupFuel: number;
  };
}

export interface MarsScenarioVariant {
  scenario: MarsScenario;
  metadata: ScenarioVariantMetadata;
}

export interface VariantOptions {
  /** Vary the leaking habitat when the scenario family supports it. */
  varyLeakLocation?: boolean;
  /** Vary the location of the incident crew when the briefing is generic. */
  varyCrewLocation?: boolean;
}

/** A small deterministic mixer. It is intentionally not a cryptographic RNG. */
function mix(seed: number, salt: number): number {
  let value = (seed ^ salt) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  return (value ^ (value >>> 16)) >>> 0;
}

function choose<T>(values: readonly T[], seed: number, salt: number): T {
  return values[mix(seed, salt) % values.length]!;
}

function fixed(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Derive a reproducible scenario variant without changing the base declaration.
 * Variant parameters are host metadata; MCP observations still expose only the
 * resulting public world state.
 */
export function createMarsVariant(
  base: MarsScenario,
  seed: number,
  split: VariantSplit = 'training',
  options: VariantOptions = {},
): MarsScenarioVariant {
  if (!Number.isInteger(seed)) throw new Error('Scenario variant seeds must be integers.');
  const source = parseScenario(base);
  const scenario = clone(source);
  const habitats: HabitatId[] = ['A', 'B', 'Hub'];
  const leakHabitat =
    options.varyLeakLocation === false ? 'B' : choose(['A', 'B'] as const, seed, 11);
  const crewHabitat = options.varyCrewLocation === false ? 'B' : choose(habitats, seed, 17);
  const leakRate = fixed(2.5 + (mix(seed, 23) % 18) / 10);
  const isolationLeakFactor = fixed(0.15 + (mix(seed, 27) % 26) / 100);
  const oxygenReserve = fixed(
    Math.max(48, Math.min(92, source.initialState.oxygenReserve - 12 + (mix(seed, 29) % 25))),
  );
  const initialPower = fixed(
    Math.max(58, Math.min(96, source.initialState.power - 10 + (mix(seed, 31) % 21))),
  );
  const backupFuel = fixed(
    Math.max(12, Math.min(65, source.initialState.backupFuel - 12 + (mix(seed, 37) % 25))),
  );

  // Keep one path blocked in some variants so route inspection matters. Never
  // block every route to the Hub and retain a valid schema declaration.
  const candidatePaths = scenario.paths.filter((path) => path.from === 'B' || path.to === 'B');
  const blockPath = candidatePaths.length > 1 && mix(seed, 41) % 3 === 0;
  const blocked = blockPath ? candidatePaths[mix(seed, 43) % candidatePaths.length] : undefined;
  if (blocked) scenario.paths = scenario.paths.filter((path) => path !== blocked);

  for (const id of habitats) {
    scenario.initialState.habitats[id].leakRate = id === leakHabitat ? leakRate : 0;
  }
  scenario.initialState.habitats[leakHabitat].pressure = fixed(
    Math.max(48, Math.min(76, source.initialState.habitats[leakHabitat].pressure)),
  );
  scenario.initialState.oxygenReserve = oxygenReserve;
  scenario.initialState.power = initialPower;
  scenario.initialState.backupFuel = backupFuel;
  // This modifier is intentionally absent from the public briefing and MCP
  // schemas. Its deterministic effects can be inferred from repeated
  // observations, giving the first hidden-causality experiment a small scope.
  scenario.modifiers.isolationLeakFactor = isolationLeakFactor;
  scenario.initialState.crew = source.initialState.crew.map((crew, index) => ({
    ...crew,
    location: index < 8 ? crewHabitat : crew.location,
  }));

  // The official incident targets Habitat B. A variant can move the leak while
  // keeping the objective visible and valid; agents must inspect instead of
  // relying on a memorized location.
  scenario.metadata = {
    ...scenario.metadata,
    id: `${source.metadata.id}-variant-${seed}`,
    name: `${source.metadata.name} / Variant ${seed}`,
  };

  return {
    scenario: parseScenario(scenario),
    metadata: {
      id: `${source.metadata.id}-variant-${seed}`,
      baseScenarioId: source.metadata.id,
      seed,
      split,
      parameters: {
        leakHabitat,
        leakRate,
        isolationLeakFactor,
        crewHabitat,
        oxygenReserve,
        initialPower,
        ...(blocked ? { blockedPath: `${blocked.from}-${blocked.to}` } : {}),
        backupFuel,
      },
    },
  };
}

export function variantSeeds(start: number, count: number): number[] {
  if (!Number.isInteger(start) || !Number.isInteger(count) || count < 0)
    throw new Error('Variant seed ranges require an integer start and non-negative count.');
  return Array.from({ length: count }, (_, index) => start + index).filter((seed) => seed >= 0);
}
