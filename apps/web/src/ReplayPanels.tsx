import { ShieldCheck, TriangleAlert, Flag } from 'lucide-react';
import type { ArenaEvent, HabitatId, Score, WorldState } from '@arena/arena-core';
import { clock } from './clock';
export function Telemetry({
  label,
  value,
  unit,
  color,
  icon,
  detail,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
  icon: React.ReactNode;
  detail: string;
}) {
  return (
    <div className="telemetry">
      <div className="telemetry-label">
        {icon}
        {label}
      </div>
      <div className="telemetry-value">
        {value.toFixed(1)}
        <span>{unit}</span>
      </div>
      <div className="meter">
        <i style={{ width: `${Math.min(100, value)}%`, background: color }} />
      </div>
      <small>{detail}</small>
    </div>
  );
}

export function EventItem({ event }: { event: ArenaEvent }) {
  const danger = event.type === 'dangerous_action' || event.type === 'mission_failed';
  const action = event.type === 'tool_called';
  const result = event.type === 'tool_result';
  return (
    <div
      className={`event ${danger ? 'danger' : ''} ${action ? 'action' : ''} ${event.type === 'mission_succeeded' ? 'event-success' : ''}`}
    >
      <div className="event-meta">
        <span>
          {action ? 'TOOL CALL' : result ? 'TOOL RESULT' : danger ? 'WARNING' : 'WORLD EVENT'}
        </span>
        <time>{clock(event.time)}</time>
      </div>
      {action ? (
        <>
          <code>{String(event.data.name)}</code>
          {Object.keys(event.data.arguments as object).length > 0 && (
            <pre>{JSON.stringify(event.data.arguments, null, 0)}</pre>
          )}
        </>
      ) : (
        <p>{event.message}</p>
      )}
      {danger && (
        <span className="danger-tag">
          <TriangleAlert size={11} />
          {event.type === 'dangerous_action' ? 'DANGEROUS ACTION' : 'MISSION FAILED'}
        </span>
      )}
    </div>
  );
}

export function WorldBanner({
  state,
  lastAction,
  score,
  targetHabitat = 'B',
}: {
  state: WorldState;
  lastAction?: ArenaEvent;
  score?: Score;
  targetHabitat?: HabitatId;
}) {
  if (state.outcome !== 'running') {
    const saved = state.crew.filter((crew) => crew.status !== 'lost').length;
    return (
      <div className={`outcome-banner ${state.outcome}`}>
        <div>
          {state.outcome === 'success' ? <ShieldCheck size={22} /> : <TriangleAlert size={22} />}
          <span>
            {state.outcome === 'success' ? 'COLONY STABILIZED' : 'MISSION FAILED'}
            <strong>
              {state.outcome === 'success'
                ? `${saved} CREW SAVED`
                : `${state.crew.length - saved} CREW LOST · ${saved} SURVIVING`}
            </strong>
          </span>
        </div>
        <p>{state.outcomeReason}</p>
        {state.outcome === 'failure' && lastAction && (
          <code>
            Last recorded action: {String(lastAction.data.name)}(
            {JSON.stringify(lastAction.data.arguments)})
          </code>
        )}
        <div className="score-line">
          <Flag size={13} />
          FINAL SCORE <b>{score?.total.toFixed(1)}</b> / 100 · Safety {score?.safety.toFixed(0)}
        </div>
      </div>
    );
  }
  return (
    <div className="incident-overlay">
      <span className="status-dot" />
      <span>
        {state.power < 20
          ? 'LIFE SUPPORT BLACKOUT'
          : state.oxygenReserve < 15
            ? 'CRITICAL OXYGEN RESERVE'
            : state.habitats[targetHabitat].isolated
              ? `HABITAT ${targetHabitat.toUpperCase()} ISOLATED`
              : 'PRESSURE LEAK DETECTED'}
        <small>
          {
            state.crew.filter((crew) => crew.location === targetHabitat && crew.status !== 'lost')
              .length
          }{' '}
          CREW IN HABITAT {targetHabitat.toUpperCase()} ·{' '}
          {state.habitats[targetHabitat].pressure.toFixed(1)} kPa
        </small>
      </span>
    </div>
  );
}
