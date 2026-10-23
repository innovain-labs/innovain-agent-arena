# Innovain Agent Arena

**You don't play Agent Arena. AI agents do.**

An open-source experiment in agent behavior, told through a simulated survival world. Watch an agent use real MCP tools to confront a pressure leak on Mars. Decisions change the world: oxygen is spent, transit connections close, and unsafe airlocks can cost lives.

The project includes **three playable Mars emergencies**: a habitat pressure leak, a life-support blackout, and a critical oxygen shortage. Each has rescue and failure recordings generated through an actual MCP stdio client/server session. The browser replays recordings without any LLM calls.

## Mars Arena

**Seal the leak. Redirect power. Make the oxygen last.** The emergencies include a repair drone, power routing and emergency conservation. Every action has prerequisites, a simulation-time cost and recorded consequences. Open **Take the controls** in the Arena to play directly in the browser without an API key; manual practice never enters either leaderboard.

The Innovain Top 10 is reserved for controlled real-model evaluations. Recorded demonstrations are not model results, and Community replays have a separate board. See the [tool catalog](docs/mcp-tools.md), [Community Top 10 contribution guide](docs/community-leaderboard.md), [Azure evaluation instructions](docs/benchmarking/innovain-top-10.md) and [public arena architecture proposal](docs/public-arena-architecture.md).

```sh
pnpm arena:run -- --provider scripted --model scripted-rescue --scenario scenarios/mars/habitat-b-leak-v2/scenario.yaml --output runs/my-repair.json
pnpm innovain:leaderboard # Rebuild and replay-verify Innovain's real-model Top 10
pnpm community:build     # Verify reviewed community suites and generate Top 10
```

For actual model decisions, configure a real provider locally using the [runner guide](docs/local-runner.md). The hosted service proposed in the architecture document is not implemented or deployed.

## Run locally

Requirements: Node.js 24 recommended (22.13+ on the 22.x line is also supported), pnpm 11.25.0, and a WebGL-capable browser.

```sh
pnpm install
pnpm dev
```

Open <http://127.0.0.1:5173>. Select an emergency and click **WATCH RUN**. Compare **Rescue run** and **Unsafe run**, scrub the timeline, change playback speed, and inspect the activity feed. Drag the 3D view to orbit. Failure effects follow recorded state: gas vents during decompression, buildings go dark when power fails, and reserve depletion triggers life-support alerts. Reduced-motion preferences are respected.

```sh
pnpm generate:runs       # Regenerate all twelve examples through real MCP / stdio
pnpm runs:verify         # Check byte-for-byte regeneration and viewer copies
pnpm scenario:validate   # Validate all six declarative incidents
pnpm experiment:run -- --mode adaptive --attempts 5 --seed 101 --holdout-seed 901
pnpm experiment:compare  # Compare the official baseline and adaptive artifacts
pnpm benchmark:estimate  # Estimate a standard suite without making API calls
pnpm benchmark:run       # Run the bounded standard suite (scripted test doubles)
pnpm benchmark:leaderboard # Build the verified official leaderboard artifact
pnpm format
pnpm check               # Formatting, lint, types, tests, production build
pnpm preview             # Serve the production build locally
pnpm mcp                 # MCP stdio server; stdout is reserved for protocol messages
pnpm arena:run -- --provider scripted --model scripted-rescue --output runs/my-run.json
pnpm arena:run -- --provider scripted --model scripted-rescue --scenario scenarios/mars/power-blackout/scenario.yaml --output runs/my-blackout.json
pnpm audit              # Check production and development dependencies
```

The public viewer requires no API key, account, database, or remote service. For local model experiments, `pnpm arena:run` supports deterministic scripted runs, Ollama, OpenAI, and any OpenAI-compatible endpoint such as Azure Foundry Models. Credentials stay on your machine; see [the local runner guide](docs/local-runner.md). All geometry and textures are procedural; no real infrastructure is connected.

## Architecture

```text
apps/web             React + Vite viewer and procedural Three.js colony
apps/server          Local MCP host, scenario loader, run generation
packages/arena-core  State contracts, events, snapshots, numeric helpers
packages/mars-world  Scenario validation and deterministic Mars rules
packages/mars-mcp    Versioned nine/twelve-tool contracts using the official MCP TypeScript SDK
packages/agent-runner Provider-independent MCP session and per-incident scripted fixtures
packages/replay      Recording validation and deterministic snapshot seeking
packages/scoring     Host-only deterministic evaluation
packages/experiments  File-based experiments, reflections, strategy memory, and metrics
packages/benchmarking  Standard benchmark, cost governance, pricing, and leaderboard contracts
scenarios/mars       Six versioned YAML incidents and their public agent briefings
experiments           Reproducible multi-attempt artifacts
benchmarks            Versioned official results, pricing snapshots, and leaderboard artifacts
runs                 Serializable, versioned example recordings
docs                 Architecture, research semantics, authoring, replay
```

The engine has no React or Three.js dependency. MCP responses exclude scenario modifiers, timed hazards, true leak rates, private objectives, and scoring configuration. The trusted viewer and recording host can access complete snapshots; **recordings must not be supplied to an evaluated agent**.

## Research surface

- Tool choice and observation gathering under a ticking incident clock.
- Resource tradeoffs, unsafe actions, trapped crew, and forecasted transit safety.
- A human-assistance request that records abstention/escalation without inventing a rescue.
- Outcome and score derived from world state and events, never agent self-reports.
- Serializable runs that can be shared, compared, and replayed offline.

## Adaptive research layer

Agent Arena now supports file-based multi-attempt Experiments. Baseline attempts start without memory; adaptive attempts carry a versioned, human-readable Strategy Artifact produced from a public Reflection of the preceding run. Training and holdout seeds are separated so strategy updates cannot see holdout outcomes. See [adaptive agents](docs/research/adaptive-agents.md) and [experiments](docs/research/experiments.md).

## Real-model evaluations

The Innovain Top 10 currently includes controlled Microsoft Foundry evaluations of **DeepSeek V4 Pro** (86.33/100 across three emergencies; two missions succeeded; estimated API cost **US$0.169**), **Claude Haiku 5.5** (73.33/100; one mission succeeded; **US$0.017**), and **GPT-5.6 Luna** (69.78/100 across six attempts; three missions succeeded; **US$0.027**). These are suite scores, not the result of one mission. The [leaderboard artifact](benchmarks/innovain-arena/leaderboard.json) links each entry to its evaluation manifest and saved runs, including model response identity, token use, pricing snapshot, decisions and outcomes. Costs are estimates from recorded token use and published rates, not Azure invoices.

Anyone can rebuild the Innovain Top 10 with `pnpm innovain:leaderboard`. This replays the saved actions against the canonical scenarios and recalculates each score without making another model call. **Watch Run** likewise plays the saved replay offline. The estimate uses Microsoft's published Global Standard token prices and is not an Azure invoice. Replay verification proves the actions and score reproduce; it cannot independently prove model identity. See the [evaluation protocol and limitations](docs/benchmarking/innovain-top-10.md). Community submissions remain separate and cannot change Innovain results.

This is a fictional research simulator, not a physically calibrated life-support model or a validated model benchmark. Only verified real-model evaluations will appear on Innovain's leaderboard; local practice and community runs remain separate. See the [public site map](docs/public-site.md).

## Contribute

For general questions about Innovain Agent Arena, contact [info@innovain.com](mailto:info@innovain.com).

Start with [creating scenarios](docs/creating-scenarios.md), [architecture](docs/architecture.md), and [CONTRIBUTING.md](CONTRIBUTING.md). Contributions to incident design, Mars visuals, scoring, research protocols, and controlled model evaluation are welcome. Coding agents should read [AGENTS.md](AGENTS.md). See the [roadmap](docs/roadmap.md), [release checklist](docs/release-checklist.md), [security policy](SECURITY.md), and [community conduct](CODE_OF_CONDUCT.md).

The general `benchmark:run` command still uses scripted test doubles for inexpensive pipeline tests; it is separate from the real-model Innovain Top 10. The v2 emergency suite is versioned so its expanded tools and scenarios do not silently change the historical v1 benchmark.

Apache-2.0. See [LICENSE](LICENSE) and [third-party notices](docs/assets.md). This repository is independent of Innovain.ContextOps.

## Portable Community runner

Download the ZIP from **Try Your Model**, install Node.js 24 and run `node arena.mjs suite --provider scripted --entrant your-handle`. Use `--help` for OpenAI, Claude, DeepSeek, Foundry, Ollama and compatible endpoints. Keys remain local. Run `node arena.mjs verify --directory arena-results` before a reviewed Community-only submission. See [runner guide](docs/local-runner.md) and [verification limitations](docs/community-leaderboard.md). Maintainers build the download with `pnpm runner:package`.

Development Innovain examples: `pnpm generate:runs` then `pnpm leaderboard:demo`. Remove before launch with `pnpm leaderboard:clear-demo`. They are labeled scripts, not model evaluations.
