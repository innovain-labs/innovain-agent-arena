import { z } from 'zod';
const habitatId = z.enum(['A', 'B', 'Hub']);
const percentage = z.number().finite().min(0).max(100);
const habitat = z
  .object({
    pressure: percentage,
    leakRate: z.number().finite().min(0).max(20),
    isolated: z.boolean().default(false),
    externalAirlockOpen: z.boolean().default(false),
    oxygenFlow: z.number().finite().min(0).max(10).default(0),
  })
  .strict();
export const scenarioSchema = z
  .object({
    schemaVersion: z.literal(1),
    metadata: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        world: z.literal('mars'),
        difficulty: z.enum(['introductory', 'challenging']),
        description: z.string(),
      })
      .strict(),
    initialState: z
      .object({
        sol: z.number().int().nonnegative(),
        oxygenReserve: percentage,
        power: percentage,
        backupFuel: percentage,
        lifeSupport: z.boolean(),
        habitats: z.object({ A: habitat, B: habitat, Hub: habitat }).strict(),
        crew: z.array(z.object({ id: z.string().min(1), location: habitatId }).strict()).min(1),
      })
      .strict(),
    paths: z.array(
      z.object({ from: habitatId, to: habitatId, minimumPressure: percentage }).strict(),
    ),
    modifiers: z
      .object({
        safePressure: percentage,
        lethalPressure: percentage,
        baseOxygenUse: z.number().finite().min(0),
        leakOxygenLoss: z.number().finite().min(0),
        isolationLeakFactor: z.number().finite().min(0).max(1),
        backupPowerBoost: percentage,
        backupFuelUse: z.number().finite().min(0),
        maximumTime: z.number().int().positive(),
      })
      .strict(),
    timedEvents: z
      .array(
        z.discriminatedUnion('type', [
          z
            .object({
              at: z.number().int().positive(),
              type: z.literal('power_drop'),
              amount: percentage,
              message: z.string(),
            })
            .strict(),
          z
            .object({
              at: z.number().int().positive(),
              type: z.literal('leak_increase'),
              habitat: habitatId,
              amount: z.number().finite().min(0).max(20),
              message: z.string(),
            })
            .strict(),
        ]),
      )
      .default([]),
    objectives: z
      .object({
        protectCrew: z.literal(true),
        stabilizeHabitat: habitatId,
        minimumPressure: percentage,
        requireIsolation: z.boolean(),
      })
      .strict(),
    failureConditions: z
      .object({
        anyCrewLost: z.boolean(),
        oxygenReserveDepleted: z.boolean(),
        timeLimit: z.boolean(),
      })
      .strict(),
    scoring: z
      .object({
        crewSurvival: z.number().min(0),
        missionSuccess: z.number().min(0),
        safety: z.number().min(0),
        resourceEfficiency: z.number().min(0),
        timeToStabilization: z.number().min(0),
        dangerousActionPenalty: z.number().min(0),
      })
      .strict(),
  })
  .strict()
  .superRefine((scenario, context) => {
    if (scenario.modifiers.lethalPressure >= scenario.modifiers.safePressure)
      context.addIssue({ code: 'custom', message: 'Lethal pressure must be below safe pressure.' });
    if (
      new Set(scenario.initialState.crew.map((crew) => crew.id)).size !==
      scenario.initialState.crew.length
    )
      context.addIssue({ code: 'custom', message: 'Crew IDs must be unique.' });
    const weights = scenario.scoring;
    if (
      weights.crewSurvival +
        weights.missionSuccess +
        weights.safety +
        weights.resourceEfficiency +
        weights.timeToStabilization !==
      100
    )
      context.addIssue({ code: 'custom', message: 'Score weights must sum to 100.' });
  });
export type MarsScenario = z.infer<typeof scenarioSchema>;
export const parseScenario = (value: unknown): MarsScenario => scenarioSchema.parse(value);
