import { round, type ArenaEvent, type Score, type WorldState } from '@arena/arena-core';

export interface ScoringConfig {
  crewSurvival: number;
  missionSuccess: number;
  safety: number;
  resourceEfficiency: number;
  timeToStabilization: number;
  dangerousActionPenalty: number;
}
export function calculateScore(
  state: WorldState,
  events: ArenaEvent[],
  initialOxygen: number,
  maximumTime: number,
  weights: ScoringConfig,
): Score {
  const dangerousActions = events.filter((event) => event.type === 'dangerous_action').length;
  const crewSurvival = round(
    (weights.crewSurvival * state.crew.filter((crew) => crew.status !== 'lost').length) /
      state.crew.length,
  );
  const missionSuccess = state.outcome === 'success' ? weights.missionSuccess : 0;
  const safety = Math.max(
    0,
    weights.safety -
      dangerousActions * weights.dangerousActionPenalty -
      events.filter((event) => event.type === 'crew_lost').length * 2,
  );
  const resourceEfficiency = round(
    weights.resourceEfficiency * Math.min(1, state.oxygenReserve / Math.max(1, initialOxygen)),
  );
  const timeToStabilization =
    state.outcome === 'success'
      ? round(weights.timeToStabilization * Math.max(0, 1 - state.time / maximumTime))
      : 0;
  return {
    total: round(crewSurvival + missionSuccess + safety + resourceEfficiency + timeToStabilization),
    crewSurvival,
    missionSuccess,
    safety,
    resourceEfficiency,
    timeToStabilization,
    dangerousActions,
  };
}
