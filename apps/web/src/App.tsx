import { PracticePanel } from './PracticePanel';
import { MissionPanel } from './MissionPanel';
import { Telemetry, EventItem, WorldBanner } from './ReplayPanels';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ChevronDown,
  CircleHelp,
  Crosshair,
  Expand,
  FileUp,
  Globe2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  ShieldCheck,
  Volume2,
  Wind,
  Zap,
} from 'lucide-react';
import type { Run } from '@arena/arena-core';
import { currentMarsIncidents, marsIncidents, parseScenario } from '@arena/mars-world';
import { durationOf, frameAt, validateRun } from '@arena/replay';
import { ColonyScene } from './ColonyScene';
import { ExperimentPanel } from './ExperimentPanel';
import type { ExperimentSummary } from '@arena/experiments';
import type { LeaderboardArtifact } from '@arena/benchmarking';
import { PublicPage } from './PublicPage';
import {
  assetUrl,
  publicLinks,
  resolveIncident,
  resolveRoute,
  routeHref,
  siteNavigation,
  type SiteRoute,
} from './site';

import { clock } from './clock';
const actionEvents = new Set([
  'tool_called',
  'tool_result',
  'dangerous_action',
  'warning_triggered',
  'crew_moved',
  'habitat_isolated',
  'oxygen_rerouted',
  'leak_repaired',
  'power_rerouted',
  'consumption_changed',
  'world_modifier',
  'mission_succeeded',
  'mission_failed',
  'incident_started',
  'power_changed',
  'human_assistance_requested',
  'crew_lost',
]);

export function App() {
  const [route, setRoute] = useState<SiteRoute>(() => resolveRoute(window.location.hash));
  const [run, setRun] = useState<Run | null>(null);
  const [runKind, setRunKind] = useState('rescue');
  const [incident, setIncident] = useState(() => resolveIncident(window.location.hash));
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.5);
  const [follow, setFollow] = useState(true);
  const [error, setError] = useState('');
  const [showBriefing, setShowBriefing] = useState(false);
  const [experimentMode, setExperimentMode] = useState<'adaptive' | 'baseline'>('adaptive');
  const [experimentSummaries, setExperimentSummaries] = useState<
    Partial<Record<'adaptive' | 'baseline', ExperimentSummary>>
  >({});
  const [experimentAttempt, setExperimentAttempt] = useState(1);
  const [leaderboard, setLeaderboard] = useState<LeaderboardArtifact | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const feed = useRef<HTMLDivElement>(null);
  const arenaRef = useRef<HTMLElement>(null);
  const focusArenaAfterRun = useRef(false);
  useEffect(() => {
    const updateRoute = () => {
      setRoute(resolveRoute(window.location.hash));
      if (window.location.hash.includes('incident=')) {
        setIncident(resolveIncident(window.location.hash));
        setRunKind('rescue');
      }
    };
    window.addEventListener('hashchange', updateRoute);
    return () => window.removeEventListener('hashchange', updateRoute);
  }, []);
  useEffect(() => {
    if (!focusArenaAfterRun.current || !run || route !== 'arena') return;
    focusArenaAfterRun.current = false;
    const frame = window.requestAnimationFrame(() => {
      arenaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [route, run]);
  useEffect(() => {
    if (runKind === 'custom') return;
    const controller = new AbortController();
    setPlaying(false);
    setError('');
    setTime(0);
    setRun(null);
    fetch(
      assetUrl(
        `runs/${runKind === 'rescue' ? incident.rescueRecording : incident.failureRecording}`,
      ),
      {
        signal: controller.signal,
      },
    )
      .then((response) => {
        if (!response.ok)
          throw new Error('Example recording could not be loaded. Run pnpm generate:runs.');
        return response.json();
      })
      .then((value) => setRun(validateRun(value)))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'Unable to load recording.');
      });
    return () => controller.abort();
  }, [runKind, incident]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.all(
      (['adaptive', 'baseline'] as const).map(async (mode) => {
        const response = await fetch(
          assetUrl(`experiments/mars-learning-001/${mode}/summary.json`),
          {
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error('Learning experiment summary could not be loaded.');
        return [mode, (await response.json()) as ExperimentSummary] as const;
      }),
    )
      .then((entries) => setExperimentSummaries(Object.fromEntries(entries)))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'Unable to load experiment summary.');
      });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch(assetUrl('benchmarks/innovain-arena/leaderboard.json'), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Official benchmark leaderboard could not be loaded.');
        return response.json();
      })
      .then((value) => setLeaderboard(value as LeaderboardArtifact))
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'Unable to load leaderboard.');
      });
    return () => controller.abort();
  }, []);
  const duration = run ? durationOf(run) : 0;
  useEffect(() => {
    if (!playing || !run) return;
    let last = performance.now();
    let animation = 0;
    const step = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.25) * speed;
      last = now;
      setTime((current) => Math.min(duration, current + delta));
      animation = requestAnimationFrame(step);
    };
    animation = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animation);
  }, [playing, speed, duration, run]);
  useEffect(() => {
    if (playing && time >= duration) setPlaying(false);
  }, [time, duration, playing]);
  const frame = run ? frameAt(run, time) : null;
  const events =
    run?.events.filter((event) => event.sequence <= (frame?.eventSequence ?? -1)) ?? [];
  const visibleEvents = events.filter((event) => actionEvents.has(event.type));
  const lastAction = events.findLast((event) => event.type === 'tool_called');
  const state = frame?.state;
  useEffect(() => {
    if (feed.current) feed.current.scrollTop = feed.current.scrollHeight;
  }, [visibleEvents.length]);
  const togglePlay = () => {
    if (time >= duration) setTime(0);
    setPlaying((value) => !value);
  };
  const upload = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 10_000_000) throw new Error('Recording exceeds the 10 MB limit.');
      const value = validateRun(JSON.parse(await file.text()));
      setRunKind('custom');
      setRun(value);
      setTime(0);
      setPlaying(false);
      setError('');
      window.location.hash = '#/';
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Invalid recording.');
    }
    if (fileInput.current) fileInput.current.value = '';
  };
  const openExperimentAttempt = async (attempt: number) => {
    try {
      const response = await fetch(
        assetUrl(
          `experiments/mars-learning-001/${experimentMode}/attempt-${String(attempt).padStart(3, '0')}/run.json`,
        ),
      );
      if (!response.ok) throw new Error('Experiment attempt recording could not be loaded.');
      setRun(validateRun(await response.json()));
      setExperimentAttempt(attempt);
      setRunKind('custom');
      setTime(0);
      setPlaying(false);
      setError('');
      window.location.hash = '#/';
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load experiment attempt.');
    }
  };
  const openLeaderboardRun = async (reference: string) => {
    try {
      const response = await fetch(
        assetUrl(
          /^(community\/entry-\d+-\d+|runs\/(example|unsafe)-incident-\d+)\.json$/.test(reference)
            ? reference
            : `benchmarks/innovain-arena/${reference}`,
        ),
      );
      if (!response.ok) throw new Error('Official benchmark replay could not be loaded.');
      focusArenaAfterRun.current = true;
      setRun(validateRun(await response.json()));
      setRunKind('custom');
      setTime(0);
      setPlaying(true);
      setError('');
      window.location.hash = '#/';
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load benchmark replay.');
    }
  };
  const lost = state?.crew.filter((crew) => crew.status === 'lost').length ?? 0;
  const safe = state?.crew.filter((crew) => crew.status === 'safe').length ?? 0;
  const atRisk = state?.crew.filter((crew) => crew.status === 'at-risk').length ?? 0;
  const failure = state?.outcome === 'failure';
  const scenario = useMemo(() => {
    if (!run) return undefined;
    try {
      return parseScenario(run.metadata.scenario);
    } catch {
      return undefined;
    }
  }, [run]);
  const targetHabitat = scenario?.objectives.stabilizeHabitat ?? 'B';
  const provider = run?.metadata.model?.provider.toLowerCase();
  const isModelRecording = !!run?.metadata.model && provider !== 'arena' && provider !== 'scripted';
  const isScriptedRecording =
    !run?.metadata.model && run?.metadata.agent.toLowerCase().startsWith('scripted');

  return (
    <div className={`app ${failure ? 'failed' : ''}`}>
      <header className="header">
        <a className="brand" href={routeHref('arena')} aria-label="Innovain Agent Arena home">
          <img
            className="brand-logo"
            src={assetUrl('innovain-agent-arena-logo.png')}
            alt="innovain Agent Arena"
          />
        </a>
        <nav className="site-nav" aria-label="Primary navigation">
          {siteNavigation.map((item) => (
            <a
              className={route === item.route ? 'active' : ''}
              href={routeHref(item.route)}
              key={item.route}
            >
              {item.label}
            </a>
          ))}
          {publicLinks.github && (
            <a
              className="site-nav-external"
              href={publicLinks.github}
              target="_blank"
              rel="noreferrer"
            >
              GitHub <ArrowUpRight size={11} />
            </a>
          )}
        </nav>
        <details className="innovain-menu">
          <summary>
            Innovain <ChevronDown size={12} />
          </summary>
          <div className="innovain-menu-panel">
            <strong>Innovain Agent Arena</strong>
            <a href={publicLinks.innovain} target="_blank" rel="noreferrer">
              www.innovain.ai <ArrowUpRight size={12} />
            </a>
            <a href={publicLinks.contact}>{publicLinks.contactLabel}</a>
            <a href={routeHref('privacy')}>Privacy</a>
          </div>
        </details>
        <div className="header-center">
          <span className="status-dot" /> EXPERIMENTAL RESEARCH PLATFORM{' '}
          <span className="version">v0.1</span>
        </div>
        <button
          className="text-button"
          title="Open the game guide and the selected mission briefing"
          aria-label="How to play: open the game guide and mission briefing"
          onClick={() => setShowBriefing(true)}
        >
          <CircleHelp size={15} /> How to play
        </button>
      </header>
      {route !== 'arena' ? (
        <PublicPage
          route={route}
          summaries={experimentSummaries}
          leaderboard={leaderboard}
          experimentMode={experimentMode}
          experimentAttempt={experimentAttempt}
          onModeChange={(mode) => {
            setExperimentMode(mode);
            setExperimentAttempt(1);
          }}
          onOpenAttempt={(attempt) => void openExperimentAttempt(attempt)}
          onWatchRun={(reference) => void openLeaderboardRun(reference)}
          onOpenLocalRun={() => fileInput.current?.click()}
        />
      ) : (
        <main>
          <section className="masthead">
            <div>
              <div className="eyebrow">
                WORLD 01 <span>/</span> MARS COLONY ALPHA
              </div>
              <h1>
                AI decisions. <em>Real consequences.</em>
              </h1>
              <p>Watch AI agents. Take the controls. Every decision has a cost.</p>
            </div>
            <div className="masthead-right">
              <span className="live-label">
                <Radio size={13} />{' '}
                {run?.metadata.protocol === 'browser/manual'
                  ? 'MANUAL PRACTICE'
                  : isModelRecording
                    ? 'RECORDED MODEL RUN'
                    : isScriptedRecording || runKind !== 'custom'
                      ? 'SCRIPTED DEMO · NO LLM'
                      : 'SAVED RECORDING · MODEL UNKNOWN'}
              </span>
              <p>
                Can an AI agent save the colony
                <br />
                without making things worse?
              </p>
            </div>
          </section>
          <section className="incident-selector" aria-labelledby="incident-selector-title">
            <div className="incident-selector-heading">
              <div>
                <span className="panel-kicker">CHOOSE AN EMERGENCY</span>
                <p id="incident-selector-title">
                  Choose an emergency to load its scripted example. Use the Leaderboard to inspect
                  saved model runs.
                </p>
              </div>
              <a className="inline-link" href={routeHref('scenarios')}>
                Full scenario catalog <ArrowUpRight size={14} />
              </a>
            </div>
            <div className="incident-card-grid">
              {currentMarsIncidents.map((item) => {
                const selected = runKind !== 'custom' && incident.slug === item.slug;
                return (
                  <button
                    aria-pressed={selected}
                    className={`incident-card${selected ? ' selected' : ''}`}
                    key={item.slug}
                    onClick={() => {
                      setIncident(item);
                      setRunKind('rescue');
                      setTime(0);
                      setPlaying(false);
                      window.location.hash = `#/?incident=${item.slug}`;
                    }}
                    type="button"
                  >
                    <span className="incident-card-topline">
                      <span>INCIDENT {item.displayNumber}</span>
                      <span>MARS OPERATIONS · 12 TOOLS</span>
                    </span>
                    <strong className="incident-card-title">{item.title}</strong>
                    <span className="incident-card-summary">{item.summary}</span>
                    <span className="incident-card-detail">
                      <span>MISSION OBJECTIVE</span>
                      {item.objective}
                    </span>
                    <span className="incident-card-detail risk">
                      <span>KEY DECISION</span>
                      {item.keyDecision}
                    </span>
                    <span className="incident-card-action">
                      {selected ? 'Rescue recording selected' : 'Watch rescue recording'}
                      <ArrowUpRight size={14} />
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
          {scenario && run && (
            <PracticePanel
              key={run.metadata.scenarioId}
              scenario={scenario}
              source={run}
              onRun={(practice) => {
                setRun(practice);
                setRunKind('custom');
                setTime(durationOf(practice));
                setPlaying(false);
              }}
            />
          )}
          {error && (
            <div className="error" role="alert">
              {error}
            </div>
          )}
          <section className="arena" ref={arenaRef}>
            <MissionPanel
              state={state}
              run={run}
              playing={playing}
              time={time}
              duration={duration}
              available={!!run}
              togglePlay={togglePlay}
              scenario={scenario}
            />
            <div className="world-view">
              <div className="world-top">
                <span>
                  <Globe2 size={13} /> COLONY OVERVIEW
                </span>
                <span>
                  SOL {state?.sol ?? 183} <i /> LOCAL 14:32
                </span>
              </div>
              {state && (
                <ColonyScene
                  state={state}
                  event={lastAction}
                  events={events}
                  time={time}
                  follow={follow}
                />
              )}
              <a
                className="real-run-callout"
                href={routeHref('leaderboard')}
                aria-label="Open the Leaderboard to watch real LLM runs"
              >
                <span className="real-run-callout-label">REAL MODEL RUNS</span>
                <span>Want to see an LLM handle an emergency?</span>
                <strong>
                  Explore the Leaderboard <ArrowUpRight size={13} />
                </strong>
              </a>
              <div className="view-controls">
                <button
                  aria-label={follow ? 'Disable cinematic camera' : 'Enable cinematic camera'}
                  title="Cinematic camera"
                  className={follow ? 'selected' : ''}
                  onClick={() => setFollow(!follow)}
                >
                  <Crosshair size={16} />
                </button>
                <button
                  aria-label="Expand colony view"
                  title="Expand colony view"
                  onClick={() => {
                    const element = document.querySelector('.world-view');
                    if (document.fullscreenElement) void document.exitFullscreen();
                    else
                      void element
                        ?.requestFullscreen()
                        .catch(() => setError('Fullscreen is unavailable in this browser.'));
                  }}
                >
                  <Expand size={16} />
                </button>
              </div>
              <div className="world-bottom">
                <span className="coordinates">18.65° N / 226.20° E</span>
                <span>
                  <Wind size={13} /> DUST FRONT · 12 KM/H
                </span>
              </div>
              {state && (
                <WorldBanner
                  state={state}
                  lastAction={lastAction}
                  score={run?.score}
                  targetHabitat={targetHabitat}
                />
              )}
              {!state && <div className="loading">Loading colony recording…</div>}
            </div>
            <aside className="activity-panel">
              <div className="activity-heading">
                <span className="panel-kicker">AGENT ACTIVITY</span>
                <span className="mcp-pill">MCP</span>
              </div>
              <div className="activity-subtitle">
                <span className="status-dot" />
                TOOLS → CONSEQUENCES
              </div>
              <div ref={feed} className="feed" aria-label="Agent activity event log">
                {visibleEvents.map((event) => (
                  <EventItem key={event.sequence} event={event} />
                ))}
              </div>
              <div className="activity-footer">
                <ShieldCheck size={14} />
                <span>
                  Agent observations exclude hidden
                  <br />
                  state and scoring rules.
                </span>
              </div>
            </aside>
          </section>
          <section className="telemetry-row">
            {state && (
              <>
                <Telemetry
                  label="OXYGEN RESERVE"
                  value={state.oxygenReserve}
                  unit="%"
                  color={state.oxygenReserve < 25 ? '#ef6a55' : '#71bfb4'}
                  icon={<Wind size={15} />}
                  detail="Shared colony supply"
                />
                <Telemetry
                  label="COLONY POWER"
                  value={state.power}
                  unit="%"
                  color="#9aacce"
                  icon={<Zap size={15} />}
                  detail={
                    state.backupActive
                      ? 'Backup reactor active'
                      : state.power < 20
                        ? 'Primary grid offline'
                        : 'Primary grid operational'
                  }
                />
                <Telemetry
                  label={`HABITAT ${targetHabitat.toUpperCase()} PRESSURE`}
                  value={state.habitats[targetHabitat].pressure}
                  unit="kPa"
                  color={state.outcome === 'success' ? '#71bfb4' : '#ff8054'}
                  icon={<Volume2 size={15} />}
                  detail={
                    state.habitats[targetHabitat].isolated
                      ? state.outcome === 'success'
                        ? 'Isolated · leak contained'
                        : state.power < 20 ||
                            state.oxygenReserve <= 0 ||
                            state.habitats[targetHabitat].oxygenFlow <
                              state.habitats[targetHabitat].leakRate *
                                (scenario?.modifiers.isolationLeakFactor ?? 0.25)
                          ? 'Isolated · local pressure falling'
                          : 'Isolated · pressure stabilizing'
                      : state.habitats[targetHabitat].pressure === 0
                        ? 'Habitat depressurized'
                        : state.habitats[targetHabitat].leakRate > 0
                          ? 'Active leak detected'
                          : 'Pressure stable'
                  }
                />
                <div className="telemetry crew-telemetry">
                  <div className="telemetry-label">
                    <ShieldCheck size={15} />
                    CREW SAFETY
                  </div>
                  <div className="telemetry-value">
                    {safe}
                    <span>/ {state.crew.length} SAFE</span>
                  </div>
                  <div className="crew-dots">
                    {state.crew.map((crew) => (
                      <i
                        key={crew.id}
                        className={crew.status}
                        title={`${crew.id}: ${crew.status} / ${crew.location}`}
                      />
                    ))}
                  </div>
                  <small>
                    {lost
                      ? `${lost} crew lost`
                      : atRisk
                        ? `${atRisk} crew at risk`
                        : 'All crew accounted for'}
                  </small>
                </div>
              </>
            )}
          </section>
          {experimentSummaries[experimentMode] &&
            run?.metadata.scenarioId === marsIncidents[0].id && (
              <ExperimentPanel
                summary={experimentSummaries[experimentMode]!}
                baseline={experimentSummaries.baseline ?? null}
                selectedAttempt={experimentAttempt}
                onModeChange={(mode) => {
                  setExperimentMode(mode);
                  setExperimentAttempt(1);
                }}
                onOpenAttempt={(attempt) => void openExperimentAttempt(attempt)}
              />
            )}
          <section className="replay-bar">
            <div className="replay-controls">
              <button
                disabled={!run}
                onClick={togglePlay}
                aria-label={playing ? 'Pause replay' : 'Play replay'}
                className="play-control"
              >
                {playing ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
              </button>
              <button
                disabled={!run}
                onClick={() => {
                  setTime(0);
                  setPlaying(false);
                }}
                aria-label="Restart replay"
              >
                <RotateCcw size={16} />
              </button>
              <span className="clock">
                {clock(time)}
                <small> / {clock(duration)}</small>
              </span>
            </div>
            <div className="timeline-wrap">
              <div className="timeline-label">
                <span>RECORDED RUN TIMELINE</span>
                <span>
                  {run?.events.filter((event) => event.type === 'tool_called').length ?? 0}{' '}
                  {run?.metadata.protocol === 'browser/manual'
                    ? 'MANUAL ACTIONS'
                    : 'SAVED MCP ACTIONS'}
                </span>
              </div>
              <div className="timeline">
                <input
                  aria-label="Simulation timeline"
                  type="range"
                  min={0}
                  max={duration || 1}
                  step="0.05"
                  value={time}
                  onChange={(event) => setTime(Number(event.target.value))}
                  style={
                    {
                      '--progress': `${duration ? (time / duration) * 100 : 0}%`,
                    } as React.CSSProperties
                  }
                />
                <div className="timeline-markers">
                  {run?.events
                    .filter((event) => event.type === 'tool_called')
                    .map((event) => (
                      <button
                        key={event.sequence}
                        title={`${event.data.name} at ${event.time}s`}
                        aria-label={`Seek to ${event.data.name}`}
                        style={{ left: `${duration ? (event.time / duration) * 100 : 0}%` }}
                        onClick={() => {
                          setTime(event.time);
                          setPlaying(false);
                        }}
                      />
                    ))}
                </div>
              </div>
            </div>
            <label className="speed-select">
              <select
                aria-label="Replay speed"
                value={speed}
                onChange={(event) => setSpeed(Number(event.target.value))}
              >
                <option value={0.5}>Cinematic</option>
                <option value={1}>1× speed</option>
                <option value={2}>2× speed</option>
              </select>
              <ChevronDown size={12} />
            </label>
            <label className="run-select">
              <select
                aria-label="Choose recording"
                value={runKind}
                onChange={(event) => setRunKind(event.target.value)}
              >
                <option value="rescue">Scripted rescue example</option>
                <option value="unsafe">Scripted failure example</option>
                {runKind === 'custom' && (
                  <option value="custom">
                    {run?.metadata.protocol === 'browser/manual'
                      ? 'Manual practice'
                      : isModelRecording
                        ? 'Model recording'
                        : 'Imported recording'}
                  </option>
                )}
              </select>
              <ChevronDown size={12} />
            </label>
            <button
              className="upload-button"
              title="Load recorded run"
              aria-label="Load recorded run"
              onClick={() => fileInput.current?.click()}
            >
              <FileUp size={16} />
            </button>
          </section>
          <footer className="footer">
            <span>
              <span className="tiny-square" /> PUBLIC DEMO · OPEN QUESTIONS
            </span>
            <img
              className="footer-logo"
              src={assetUrl('innovain-agent-arena-logo.png')}
              alt="innovain Agent Arena"
            />
            <span>SIMULATED WORLD · REAL TOOL CONSEQUENCES</span>
            <div className="footer-contact" aria-label="Innovain contact links">
              <a href={publicLinks.innovain} target="_blank" rel="noreferrer">
                www.innovain.ai
              </a>
              <a href={publicLinks.contact}>{publicLinks.contactLabel}</a>
            </div>
            <button onClick={() => setShowBriefing(true)}>
              <CircleHelp size={13} /> How to play
            </button>
          </footer>
        </main>
      )}
      <input
        hidden
        ref={fileInput}
        type="file"
        accept=".json,application/json"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      {showBriefing && (
        <div className="modal-backdrop" onClick={() => setShowBriefing(false)}>
          <section
            className="briefing-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Mission briefing and game guide"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="eyebrow">GAME GUIDE / MISSION BRIEFING</div>
            <h2>Understand the mission. Follow every consequence.</h2>
            <p className="briefing-text">
              {run?.metadata.briefing.replace(/^#{1,6}\s+/gm, '') ??
                'Choose an emergency to load its public mission briefing.'}
            </p>
            <p>
              The mission briefing is the situation report for the selected emergency: it explains
              what happened and what the agent must protect. Choose an emergency, then practice
              manually or watch a saved run to see how each tool call changes the colony.
            </p>
            <p>
              This page replays recorded actions and state changes; it does not run a model in your
              browser. Real-model evaluations and their saved runs are available in the Leaderboard.
            </p>
            <button className="watch-button" onClick={() => setShowBriefing(false)}>
              BACK TO ARENA <ArrowUpRight size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
