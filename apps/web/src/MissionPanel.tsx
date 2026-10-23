import { Check, Play, Pause, ArrowUpRight } from 'lucide-react';
import type { Run, WorldState } from '@arena/arena-core';
import { marsIncidents, type MarsScenario } from '@arena/mars-world';
export function MissionPanel({
  state,
  run,
  playing,
  time,
  duration,
  available,
  togglePlay,
  scenario,
}: {
  state?: WorldState;
  run?: Run | null;
  playing: boolean;
  time: number;
  duration: number;
  available: boolean;
  togglePlay: () => void;
  scenario?: MarsScenario;
}) {
  const incident = marsIncidents.find((item) => item.id === run?.metadata.scenarioId);
  const target = scenario?.objectives.stabilizeHabitat ?? 'B';
  const initial = run?.frames[0]?.state;
  const needsPower = (initial?.power ?? 100) < 20;
  const success = state?.outcome === 'success';
  const failure = state?.outcome === 'failure';
  const stopReason = run?.metadata.model?.configuration?.stopReason;
  const runCost = run?.metadata.cost;
  const cost = runCost?.actualUsd ?? runCost?.estimatedUsd ?? 0;
  const tokens = run?.metadata.usage?.totalTokens ?? runCost?.usage.totalTokens ?? 0;
  const toolCalls = run?.events.filter((event) => event.type === 'tool_called').length ?? 0;
  const unpriced = !runCost && run?.metadata.usage !== undefined;
  const costLabel =
    runCost?.status === 'actual'
      ? 'ACTUAL'
      : runCost?.status === 'estimated'
        ? 'ESTIMATED'
        : unpriced
          ? 'UNPRICED'
          : 'NO API COST';
  return (
    <aside className="mission-panel">
      <div className="panel-kicker">
        <span>ACTIVE SCENARIO</span>
        <span className="orange">
          {incident?.number ? `INCIDENT ${incident.displayNumber}` : 'LOCAL REPLAY'}
        </span>
      </div>
      <div className="incident-number">
        MARS<span> / {state?.sol ?? '—'}</span>
      </div>
      <h2>{incident?.title ?? run?.metadata.scenarioName ?? 'Loading emergency'}</h2>
      <div className={`incident-status ${success ? 'green' : failure ? 'red' : ''}`}>
        <span className="status-dot" />
        {success
          ? 'COLONY STABILIZED'
          : failure
            ? 'MISSION FAILED'
            : stopReason
              ? 'RUNNER STOPPED'
              : 'INCIDENT IN PROGRESS'}
      </div>
      <p className="mission-description">
        {incident?.summary ??
          scenario?.metadata.description ??
          'Every tool call changes what happens next.'}
      </p>
      <div className="objectives">
        <div className="panel-kicker">MISSION OBJECTIVES</div>
        <div>
          <span className={success ? 'objective done' : 'objective'}>
            {success ? <Check size={11} /> : '01'}
          </span>
          Protect the crew
        </div>
        <div>
          <span
            className={
              (needsPower ? (state?.power ?? 0) >= 20 : state?.habitats[target].isolated)
                ? 'objective done'
                : 'objective'
            }
          >
            {(needsPower ? (state?.power ?? 0) >= 20 : state?.habitats[target].isolated) ? (
              <Check size={11} />
            ) : (
              '02'
            )}
          </span>
          {needsPower ? 'Restore life-support power' : 'Contain the leak'}
        </div>
        <div>
          <span className={success ? 'objective done' : 'objective'}>
            {success ? <Check size={11} /> : '03'}
          </span>
          Stabilize Habitat {target}
        </div>
        {scenario?.objectives.requireRepair && (
          <div>
            <span
              className={state?.habitats[target].leakRate === 0 ? 'objective done' : 'objective'}
            >
              04
            </span>
            Seal the leak with a repair drone
          </div>
        )}
        {scenario?.objectives.requirePowerReroute && (
          <div>
            <span className={state?.powerRerouted ? 'objective done' : 'objective'}>04</span>Reroute
            nonessential power
          </div>
        )}
        {scenario?.objectives.requireConservation && (
          <div>
            <span
              className={state?.consumptionMode === 'emergency' ? 'objective done' : 'objective'}
            >
              05
            </span>
            Enable emergency conservation
          </div>
        )}
      </div>
      {scenario?.rulesVersion === 2 && (
        <p className="operations-status">
          OXYGEN MODE: {state?.consumptionMode?.toUpperCase() ?? 'NORMAL'} · POWER ROUTING:{' '}
          {state?.powerRerouted ? 'ACTIVE' : 'AVAILABLE'}
        </p>
      )}
      <div className="agent-profile">
        <div className="panel-kicker">AGENT</div>
        <strong>
          <span className="agent-icon">⌘</span>
          {run?.metadata.model
            ? `${run.metadata.model.provider} / ${run.metadata.model.model ?? run.metadata.agent}`
            : (run?.metadata.agent ?? 'Loading agent')}
        </strong>
        <small>
          {run?.metadata.protocol === 'browser/manual'
            ? 'Human practice · browser simulation'
            : run?.metadata.model &&
                run.metadata.model.provider !== 'arena' &&
                run.metadata.model.provider !== 'scripted'
              ? 'Recorded model run · real MCP / stdio'
              : 'Scripted baseline · real MCP / stdio'}
        </small>
      </div>
      <div className="run-cost" aria-label="Run economics">
        <div className="panel-kicker">
          <span>RUN ECONOMICS</span>
          <span>{costLabel}</span>
        </div>
        <div className="run-cost-grid">
          <div>
            <strong>{unpriced ? '—' : `$${cost.toFixed(2)}`}</strong>
            <small>MODEL COST</small>
          </div>
          <div>
            <strong>{tokens.toLocaleString('en-US')}</strong>
            <small>TOKENS USED</small>
          </div>
          <div>
            <strong>{toolCalls}</strong>
            <small>TOOL CALLS</small>
          </div>
          <div>
            <strong>{duration.toFixed(0)}s</strong>
            <small>SIMULATION TIME</small>
          </div>
          <div>
            <strong>{run?.score.safety.toFixed(1) ?? '—'}</strong>
            <small>SAFETY SCORE</small>
          </div>
        </div>
      </div>
      <button className="watch-button" disabled={!available} onClick={togglePlay}>
        {playing ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
        {playing ? 'PAUSE RUN' : time > 0 && time < duration ? 'RESUME RUN' : 'WATCH RUN'}
        <ArrowUpRight size={17} />
      </button>
      {typeof stopReason === 'string' && <p className="run-stop">{stopReason}</p>}
      <small className="no-model">
        {run?.metadata.protocol === 'browser/manual'
          ? 'Live browser practice. No AI model or MCP transport.'
          : 'Replay only. This browser makes no live model calls.'}
      </small>
    </aside>
  );
}
