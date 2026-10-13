# Coding agent guide

## Mission

Build a visually compelling open-source agent research arena. Preserve visual impact, real MCP, deterministic consequences, replay, and approachable community authoring. The public project is entirely English.

## Workspace and protected assumptions

- Work only in this repository. Do not modify sibling repositories or Innovain.ContextOps.
- Innovain.ContextOps must never become a runtime dependency.
- Do not create a remote repository, push, deploy, publish, or commit without explicit owner authorization.
- All dangerous operations are fictional world actions. Never connect real industrial, life-support, reactor, or destructive infrastructure.
- Keep operational complexity low: no authentication, billing, databases, multitenancy, or distributed services in v1.
- No provider-specific model coupling in simulation or MCP packages.

## Boundaries

- `arena-core`: serializable contracts and the event journal; no rendering or provider dependencies.
- `mars-world`: scenario schema and all domain consequences. UI must not decide action validity or outcomes.
- `mars-mcp`: official SDK tool registration and explicit public observations. No hidden scenario/scoring state in tool results or resources.
- `agent-runner`: provider-independent MCP client sessions and concrete per-incident scripted plans. Local provider orchestration currently lives in `apps/server/src/run-local.ts`.
- `scoring`: deterministic evaluation by the trusted host. Never an agent-accessible tool.
- `replay`: recording validation and snapshot lookup; no agent calls during playback.
- `apps/server`: Node stdio host, YAML loading, artifact generation.
- `apps/web`: React controls and imperative Three.js visualization. All domain data comes from recorded frames.
- Public site routes live in `apps/web/src/site.ts` and use hash navigation so static previews need no rewrite server. Public copy remains English; GitHub links are shown only when a real remote is configured.
- `apps/server/src/run-local.ts` is the local-only provider boundary. It may call a user's configured provider directly, but must never pass credentials to the MCP child or write them to artifacts, logs, errors, or telemetry.
- `experiments`: serializable multi-attempt orchestration contracts, reflections, strategy artifacts, variant splits, and metrics. It may consume recorded runs but must never mutate simulation rules or expose hidden evaluator state.
- `benchmarking`: standard benchmark contracts, model identity, dated pricing snapshots, budget ledgers, cost calculation, result reuse checks, and leaderboard ranking. It must not call providers or control simulation consequences.

## Commands

Run from repository root with Node 24 recommended (22.13+ on the 22.x line also supported) and pnpm 11.25.0:

```sh
pnpm install
pnpm dev
pnpm scenario:validate
pnpm generate:runs
pnpm runs:verify
pnpm experiment:run -- --mode adaptive --attempts 5 --seed 101 --holdout-seed 901
pnpm experiment:compare
pnpm benchmark:estimate
pnpm benchmark:run
pnpm benchmark:leaderboard
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

Run `pnpm format` after changes. Changes to rules, scenario, tool behavior, or scoring require relevant tests and regenerated recordings. CI checks generated recording reproducibility. Validate visual changes in a browser; compilation alone is insufficient. Keep scratch files and screenshots in ignored `work/`.

## Scenario conventions

Each incident lives at `scenarios/mars/<slug>/scenario.yaml` with `briefing.md`. Validate through `parseScenario` or the CLI. Use schema version 1, unique crew IDs, score weights totaling 100, finite bounded values, and readable metadata. Briefings contain only public operational information. Declarative timed events currently support power drops and leak increases. See `docs/creating-scenarios.md`.

## Determinism

- Integer simulation seconds; tool latency advances time.
- No `Date.now`, random numbers, network calls, or timers inside world rules.
- Round updated resource/pressure values through shared helpers.
- Stable habitat and crew iteration order, monotonic sequence IDs, and ordered timed events.
- Record all outcomes and consequences; snapshot after every tick and action phase.
- Terminal worlds reject further mutation. Every replay seek returns an independent clone.
- Cosmetic scene randomness uses a fixed deterministic function and never changes the world.
- The metadata seed is reserved; v1 domain rules do not sample randomness.

## Change freely

Improve procedural visuals, responsive layout, accessibility, docs, tests, incident modifiers, tool descriptions, and concrete runner behavior within these boundaries. Small new rule extensions are welcome when demanded by a real incident. Avoid abstractions for hypothetical worlds/providers.

## Change with architectural care

Recording format, tool argument contracts, observation visibility, step ordering, objective semantics, and scoring weights affect reproducibility and research validity. Document changes, update tests, bump format/schema versions when compatibility changes, and regenerate artifacts. Never silently replace real MCP with direct internal calls. Read `docs/architecture.md`, `docs/simulation.md`, `docs/scenarios.md`, and `docs/replay.md` first.

## Adaptive research layer

Experiments use external, human-readable Strategy Artifacts and Reflections. Baseline and adaptive modes must receive identical public inputs and deterministic scoring; adaptive may carry only legitimate training knowledge between attempts. Holdout variants never participate in reflection. Keep this boundary explicit when adding provider adapters.

## Standard benchmark and cost boundary

Standard Benchmark runs are independent of adaptive memory. `mars-standard-v1` fixes its scenario family, version, seeds, evaluator, scoring, and MCP contract so model results are comparable. Official results are generated from verified files only; community artifacts cannot change the leaderboard. Any paid provider runner must use a finite `BudgetPolicy`, estimate and reserve spend before each call, enforce token/run/tool-call limits, bound retries and concurrency, and stop cleanly with `BUDGET LIMIT REACHED`. Use `pnpm benchmark:estimate` before live work. Never persist API keys or call a provider from the public replay UI.
