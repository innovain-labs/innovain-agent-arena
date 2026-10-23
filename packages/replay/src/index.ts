import { clone, type Frame, type Run } from '@arena/arena-core';
import { z } from 'zod';

const percentage = z.number().finite().min(0).max(100);
const habitat = z.object({
  pressure: percentage,
  leakRate: z.number().finite().nonnegative(),
  isolated: z.boolean(),
  externalAirlockOpen: z.boolean(),
  oxygenFlow: z.number().finite().nonnegative(),
});
const state = z.object({
  consumptionMode: z.enum(['normal', 'emergency']).optional(),
  powerRerouted: z.boolean().optional(),
  time: z.number().int().nonnegative(),
  sol: z.number().int().nonnegative(),
  oxygenReserve: percentage,
  power: percentage,
  backupFuel: percentage,
  backupActive: z.boolean(),
  backupContribution: percentage,
  lifeSupport: z.boolean(),
  habitats: z.object({ A: habitat, B: habitat, Hub: habitat }),
  crew: z
    .array(
      z.object({
        id: z.string(),
        location: z.enum(['A', 'B', 'Hub']),
        status: z.enum(['safe', 'at-risk', 'lost']),
      }),
    )
    .min(1),
  humanAssistance: z.enum(['none', 'requested']),
  outcome: z.enum(['running', 'success', 'failure']),
  outcomeReason: z.string(),
});
const runSchema = z.object({
  formatVersion: z.literal(1),
  metadata: z.object({
    id: z.string(),
    scenarioId: z.string(),
    scenarioName: z.string(),
    scenarioVersion: z.number().int().positive().optional(),
    toolContractVersion: z.enum(['mars-mcp-v1', 'mars-mcp-v2']).optional(),
    agent: z.string(),
    seed: z.number().int(),
    recordedAt: z.string(),
    protocol: z.enum(['MCP/stdio', 'browser/manual']),
    briefing: z.string(),
    scenario: z.unknown(),
    experimentId: z.string().optional(),
    attempt: z.number().int().positive().optional(),
    learningMode: z.enum(['baseline', 'adaptive']).optional(),
    scenarioVariant: z
      .object({
        id: z.string(),
        seed: z.number().int().nonnegative(),
        split: z.enum(['training', 'holdout']),
      })
      .optional(),
    inputStrategyVersion: z.number().int().positive().optional(),
    outputStrategyVersion: z.number().int().positive().optional(),
    model: z
      .object({
        provider: z.string(),
        model: z.string().optional(),
        version: z.string().optional(),
        deployment: z.string().optional(),
        configuration: z.record(z.unknown()).optional(),
      })
      .optional(),
    usage: z
      .object({
        inputTokens: z.number().int().nonnegative(),
        outputTokens: z.number().int().nonnegative(),
        cachedInputTokens: z.number().int().nonnegative().optional(),
        reasoningTokens: z.number().int().nonnegative().optional(),
        totalTokens: z.number().int().nonnegative(),
      })
      .optional(),
    cost: z
      .object({
        status: z.enum(['estimated', 'actual', 'not_applicable']),
        currency: z.literal('USD'),
        estimatedUsd: z.number().finite().nonnegative(),
        actualUsd: z.number().finite().nonnegative().optional(),
        usage: z.object({
          inputTokens: z.number().int().nonnegative(),
          outputTokens: z.number().int().nonnegative(),
          cachedInputTokens: z.number().int().nonnegative().optional(),
          reasoningTokens: z.number().int().nonnegative().optional(),
          totalTokens: z.number().int().nonnegative(),
        }),
        pricingSnapshotId: z.string().optional(),
      })
      .optional(),
    benchmarkId: z.string().optional(),
    benchmarkVersion: z.string().optional(),
    official: z.boolean().optional(),
  }),
  events: z.array(
    z.object({
      sequence: z.number().int().nonnegative(),
      time: z.number().int().nonnegative(),
      type: z.string(),
      message: z.string(),
      data: z.record(z.unknown()),
    }),
  ),
  frames: z
    .array(
      z.object({
        time: z.number().int().nonnegative(),
        state,
        eventSequence: z.number().int().min(-1),
      }),
    )
    .min(1),
  finalOutcome: z.enum(['running', 'success', 'failure']),
  score: z.object({
    total: percentage,
    crewSurvival: percentage,
    missionSuccess: percentage,
    safety: percentage,
    resourceEfficiency: percentage,
    timeToStabilization: percentage,
    dangerousActions: z.number().int().nonnegative(),
  }),
});
export function validateRun(value: unknown): Run {
  const run = runSchema.parse(value) as Run;
  const toolData = z.object({ name: z.string().min(1), arguments: z.record(z.unknown()) });
  for (const event of run.events) if (event.type === 'tool_called') toolData.parse(event.data);
  if (
    run.frames[0]!.time !== 0 ||
    run.events.some(
      (event, index) =>
        event.sequence !== index || (index > 0 && event.time < run.events[index - 1]!.time),
    ) ||
    run.frames.some(
      (frame, index) =>
        frame.time !== frame.state.time ||
        frame.eventSequence >= run.events.length ||
        (index > 0 && frame.time < run.frames[index - 1]!.time),
    ) ||
    run.frames.at(-1)!.state.outcome !== run.finalOutcome
  )
    throw new Error('Run ordering or final outcome is inconsistent.');
  return run;
}
/** Binary search returns the last snapshot at or before time, including equal-time actions. */
export function frameAt(run: Run, time: number): Frame {
  let low = 0;
  let high = run.frames.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (run.frames[middle]!.time <= time) low = middle;
    else high = middle - 1;
  }
  return clone(run.frames[low]!);
}
export const durationOf = (run: Run) => run.frames.at(-1)!.time;
