export type HabitatId = 'A' | 'B' | 'Hub';
export type Outcome = 'running' | 'success' | 'failure';
export type LearningMode = 'baseline' | 'adaptive';
export type VariantSplit = 'training' | 'holdout';
export type CostStatus = 'estimated' | 'actual' | 'not_applicable';

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  totalTokens: number;
}

export interface CostRecord {
  status: CostStatus;
  currency: 'USD';
  estimatedUsd: number;
  actualUsd?: number;
  usage: TokenUsage;
  pricingSnapshotId?: string;
}
export interface HabitatState {
  pressure: number;
  leakRate: number;
  isolated: boolean;
  externalAirlockOpen: boolean;
  oxygenFlow: number;
}
export interface CrewMember {
  id: string;
  location: HabitatId;
  status: 'safe' | 'at-risk' | 'lost';
}
export interface WorldState {
  consumptionMode?: 'normal' | 'emergency';
  powerRerouted?: boolean;
  time: number;
  sol: number;
  oxygenReserve: number;
  power: number;
  backupFuel: number;
  backupActive: boolean;
  backupContribution: number;
  lifeSupport: boolean;
  habitats: Record<HabitatId, HabitatState>;
  crew: CrewMember[];
  humanAssistance: 'none' | 'requested';
  outcome: Outcome;
  outcomeReason: string;
}
export interface ArenaEvent {
  sequence: number;
  time: number;
  type: string;
  message: string;
  data: Record<string, unknown>;
}
export interface Frame {
  time: number;
  state: WorldState;
  eventSequence: number;
}
export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
}
export interface ToolResult {
  ok: boolean;
  message: string;
  observation?: Record<string, unknown>;
}
export interface Score {
  total: number;
  crewSurvival: number;
  missionSuccess: number;
  safety: number;
  resourceEfficiency: number;
  timeToStabilization: number;
  dangerousActions: number;
}
export interface Run {
  formatVersion: 1;
  metadata: {
    id: string;
    scenarioId: string;
    scenarioName: string;
    scenarioVersion?: number;
    toolContractVersion?: 'mars-mcp-v1' | 'mars-mcp-v2';
    agent: string;
    seed: number;
    recordedAt: string;
    protocol: 'MCP/stdio' | 'browser/manual';
    briefing: string;
    scenario: unknown;
    experimentId?: string;
    attempt?: number;
    learningMode?: LearningMode;
    scenarioVariant?: {
      id: string;
      seed: number;
      split: VariantSplit;
    };
    inputStrategyVersion?: number;
    outputStrategyVersion?: number;
    model?: {
      provider: string;
      model?: string;
      version?: string;
      deployment?: string;
      configuration?: Record<string, unknown>;
    };
    usage?: TokenUsage;
    cost?: CostRecord;
    benchmarkId?: string;
    benchmarkVersion?: string;
    official?: boolean;
  };
  events: ArenaEvent[];
  frames: Frame[];
  finalOutcome: Outcome;
  score: Score;
}

/** Values are rounded after every simulation step to make logs reproducible. */
export const round = (value: number) => Math.round(value * 1000) / 1000;
export const bounded = (value: number) => round(Math.max(0, Math.min(100, value)));
export const clone = <T>(value: T): T => structuredClone(value);

export class EventJournal {
  readonly events: ArenaEvent[] = [];
  readonly frames: Frame[] = [];
  emit(state: WorldState, type: string, message: string, data: Record<string, unknown> = {}) {
    this.events.push({
      sequence: this.events.length,
      time: state.time,
      type,
      message,
      data: clone(data),
    });
  }
  capture(state: WorldState) {
    this.frames.push({
      time: state.time,
      state: clone(state),
      eventSequence: this.events.length - 1,
    });
  }
}
