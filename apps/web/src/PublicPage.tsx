import type { ExperimentSummary } from '@arena/experiments';
import type { LeaderboardArtifact } from '@arena/benchmarking';
import { ArrowUpRight, FileUp, Github, LockKeyhole, Terminal, ExternalLink } from 'lucide-react';
import { ExperimentPanel } from './ExperimentPanel';
import { LeaderboardPanel } from './LeaderboardPanel';
import { assetUrl, routeHref, type SiteRoute } from './site';
import { marsIncidents } from '@arena/mars-world';

interface PublicPageProps {
  route: Exclude<SiteRoute, 'arena'>;
  summaries: Partial<Record<'adaptive' | 'baseline', ExperimentSummary>>;
  leaderboard: LeaderboardArtifact | null;
  experimentMode: 'adaptive' | 'baseline';
  experimentAttempt: number;
  onModeChange: (mode: 'adaptive' | 'baseline') => void;
  onOpenAttempt: (attempt: number) => void;
  onWatchRun: (reference: string) => void;
  onOpenLocalRun: () => void;
}

const communityIdeas = [
  'Solar flare evacuation with a failing communications relay',
  'Dust-front navigation with competing habitat priorities',
  'Medical supply routing across a damaged transit graph',
];

export function PublicPage({
  route,
  summaries,
  leaderboard,
  experimentMode,
  experimentAttempt,
  onModeChange,
  onOpenAttempt,
  onWatchRun,
  onOpenLocalRun,
}: PublicPageProps) {
  if (route === 'leaderboard')
    return (
      <main className="public-page">
        <div className="page-heading">
          <span className="eyebrow">STANDARD ARENA / VERIFIED ARTIFACTS</span>
          <h1>Leaderboard</h1>
          <p>
            Comparable, versioned results from the same scenario family, seeds, evaluator, and MCP
            contract.
          </p>
        </div>
        {leaderboard ? (
          <LeaderboardPanel leaderboard={leaderboard} onWatchRun={onWatchRun} />
        ) : (
          <p className="loading">Loading official results…</p>
        )}
        <div className="notice-card">
          <strong>Official versus community</strong>
          <span>
            Official entries are generated from verified artifacts. Imported local runs are clearly
            marked and never change this board.
          </span>
        </div>
      </main>
    );
  if (route === 'research')
    return (
      <main className="public-page">
        <div className="page-heading">
          <span className="eyebrow">RESEARCH / ADAPTIVE ARENA</span>
          <h1>Research</h1>
          <p>
            Measure tool selection, consequences, and learning while every attempt stays replayable.
          </p>
        </div>
        <div className="research-grid">
          <article className="research-card">
            <span className="panel-kicker">STANDARD ARENA</span>
            <h2>Clean-state comparison</h2>
            <p>
              Each model sees the same public briefing, tools, deterministic variants, and host-side
              scoring. The model chooses actions; the trusted simulator decides what they do.
            </p>
            <a className="inline-link" href={routeHref('leaderboard')}>
              View verified leaderboard <ArrowUpRight size={14} />
            </a>
          </article>
          <article className="research-card">
            <span className="panel-kicker">ADAPTIVE ARENA</span>
            <h2>Learning across attempts</h2>
            <p>
              Adaptive agents can carry a human-readable strategy artifact between training
              attempts. Holdout seeds remain isolated from reflection.
            </p>
            <a className="inline-link" href="#research-metrics">
              Jump to metrics <ArrowUpRight size={14} />
            </a>
          </article>
        </div>
        {summaries[experimentMode] && (
          <ExperimentPanel
            summary={summaries[experimentMode]!}
            baseline={summaries.baseline ?? null}
            selectedAttempt={experimentAttempt}
            onModeChange={onModeChange}
            onOpenAttempt={onOpenAttempt}
          />
        )}
        <section id="research-metrics" className="copy-section">
          <span className="eyebrow">WHAT IS MEASURED</span>
          <div className="copy-columns">
            <p>
              <strong>Actions.</strong> Tool calls and observations are recorded through a real MCP
              stdio session.
            </p>
            <p>
              <strong>Consequences.</strong> Oxygen, pressure, transit safety, crew status, and the
              final outcome come from the world state.
            </p>
            <p>
              <strong>Cost.</strong> Paid runs use a local budget ledger with preflight estimates,
              hard token limits, and redacted errors.
            </p>
          </div>
        </section>
      </main>
    );
  if (route === 'scenarios')
    return (
      <main className="public-page">
        <div className="page-heading">
          <span className="eyebrow">SCENARIO CATALOG</span>
          <h1>Scenarios</h1>
          <p>
            Every incident is declarative, deterministic, and authored as public operational
            information.
          </p>
        </div>
        <section className="scenario-list">
          {marsIncidents.map((incident) => (
            <article className="scenario-card active" key={incident.slug}>
              <div>
                <span className="scenario-status">SHIPPED / ACTIVE</span>
                <h2>
                  Incident {incident.number} · {incident.title}
                </h2>
                <p>{incident.summary} Rescue and failure recordings are included.</p>
              </div>
              <a className="watch-button" href={`#/?incident=${incident.slug}`}>
                Open arena <ArrowUpRight size={16} />
              </a>
            </article>
          ))}
        </section>
        <section className="copy-section">
          <span className="eyebrow">COMMUNITY IDEAS</span>
          <p>These are ideas for future contributions, not implemented scenarios:</p>
          <div className="idea-grid">
            {communityIdeas.map((idea) => (
              <div className="idea-card" key={idea}>
                <span>UNIMPLEMENTED</span>
                <strong>{idea}</strong>
              </div>
            ))}
          </div>
        </section>
        <section className="docs-card">
          <Terminal size={20} />
          <div>
            <h2>Create your own scenario</h2>
            <p>
              Follow the authoring guide for YAML schema, public briefings, timed events,
              validation, and reproducible recordings.
            </p>
          </div>
          <a className="watch-button" href={assetUrl('docs/creating-scenarios.md')}>
            Read the SDK docs <ExternalLink size={15} />
          </a>
        </section>
      </main>
    );
  if (route === 'try-your-model')
    return (
      <main className="public-page">
        <div className="page-heading">
          <span className="eyebrow">LOCAL RUNNER / YOUR MACHINE</span>
          <h1>Try Your Model</h1>
          <p>
            Run an agent against the Mars MCP server locally, then open the resulting JSON replay in
            this browser.
          </p>
        </div>
        <div className="try-grid">
          <section className="command-card">
            <div className="command-label">
              <Terminal size={15} /> QUICK START
            </div>
            <pre>
              <code>
                pnpm arena:run -- --provider scripted --model scripted-rescue --output
                runs/my-run.json
              </code>
            </pre>
            <p>
              Set provider credentials only in your local environment. Azure Foundry and other
              compatible services use the <code>openai-compatible</code> provider. Pricing is
              optional for local tests; without it, Agent Arena records token usage and labels the
              replay unpriced. Ollama uses <code>http://127.0.0.1:11434</code> and never needs a
              key.
            </p>
            <button className="watch-button" onClick={onOpenLocalRun}>
              <FileUp size={15} /> Open local run.json
            </button>
          </section>
          <section className="security-card">
            <LockKeyhole size={21} />
            <h2>Local by design</h2>
            <p>
              The browser only reads a file you choose with the File API. Keys stay in the local
              process, are never sent to Innovain, and are excluded from logs, artifacts, and
              telemetry.
            </p>
            <a className="inline-link" href={assetUrl('docs/local-runner.md')}>
              Read runner docs <ArrowUpRight size={14} />
            </a>
          </section>
        </div>
        <section className="provider-table">
          <span className="eyebrow">SUPPORTED PROVIDERS</span>
          <div className="provider-row">
            <strong>Scripted</strong>
            <span>Deterministic smoke test, $0.00</span>
            <code>--provider scripted</code>
          </div>
          <div className="provider-row">
            <strong>Ollama</strong>
            <span>Local OpenAI-compatible endpoint, $0.00</span>
            <code>--provider ollama</code>
          </div>
          <div className="provider-row">
            <strong>OpenAI</strong>
            <span>Remote API called only by your local runner</span>
            <code>--provider openai</code>
          </div>
          <div className="provider-row">
            <strong>OpenAI-compatible</strong>
            <span>Azure Foundry and compatible endpoints, configured locally</span>
            <code>--provider openai-compatible</code>
          </div>
        </section>
      </main>
    );
  return (
    <main className="public-page">
      <div className="page-heading">
        <span className="eyebrow">OPEN SOURCE / RESEARCH TOOL</span>
        <img
          className="about-logo"
          src={assetUrl('innovain-agent-arena-logo.png')}
          alt="innovain Agent Arena"
        />
        <h1>About Agent Arena</h1>
        <p>
          Agent Arena is a transparent environment for studying how models select tools when the
          world remembers every consequence.
        </p>
      </div>
      <div className="about-grid">
        <article className="research-card">
          <h2>How it works</h2>
          <p>
            The model receives a public briefing and MCP tools. The Mars world applies deterministic
            rules, records every action, and scores the resulting state. The viewer replays that
            recording without making model calls.
          </p>
        </article>
        <article className="research-card">
          <h2>What it is for</h2>
          <p>
            Compare planning, observation gathering, safety, abstention, and adaptation. A bad
            decision can depressurize a habitat; the evaluator never relies on the agent's own
            report.
          </p>
        </article>
        <article className="research-card">
          <h2>Build with it</h2>
          <p>
            Scenarios are YAML, the MCP server is local stdio, runs are JSON, and the renderer is
            React plus procedural Three.js. Read the authoring and runner docs to contribute.
          </p>
        </article>
      </div>
      <section className="docs-card">
        <Github size={20} />
        <div>
          <h2>Community contribution</h2>
          <p>
            Open a pull request with a scenario, replay, scoring proposal, or research note. This
            checkout has no configured remote yet, so the public site does not invent a GitHub URL.
          </p>
        </div>
      </section>
    </main>
  );
}
