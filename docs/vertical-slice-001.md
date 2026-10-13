# Vertical slice 001 delivery

Historical delivery snapshot for the original Incident 001 slice. Current capabilities, versions, and validation are described in the [README](../README.md) and [release roadmap](roadmap.md); the project now includes three incidents and a local real-provider runner.

The functional local slice combines real MCP agent actions, deterministic Mars consequences, serialized recordings, and an observer-facing procedural 3D replay. It is independent of Innovain.ContextOps.

## Implemented surface

- Nine official-SDK MCP tools over stdio, with protocol negotiation, discovery, argument validation, projected observations, serialized execution, and host-private recording.
- A scenario SDK exported from Mars World: strict Zod validation of English YAML metadata, initial state, paths, modifiers, timed hazards, objectives, failures, and scoring.
- Pressure evolution, oxygen allocation, containment, crew risk/loss, forecasted movement, power availability, finite backup fuel, and explicit human escalation without an invented operator response.
- Cautious rescue and unsafe scripted agents using the same MCP surface; no real model adapters or empty provider scaffolds.
- Ordered tool/world events and complete state frames; versioned replay validation and binary-search seek without model calls.
- Play/pause/restart, timeline scrubbing/action markers, speed selection, run comparison, local JSON import, simulation clock, telemetry, action feed, terminal outcomes, score, camera follow, orbit, and fullscreen.
- Procedural Martian terrain, domed habitats, hub, tanks, reactor, solar arrays, visible tunnels/gates, antenna, cargo, rover, atmospheric dust, vent particles, emergency lighting, and animated crew transfer.
- English README, contributor guide, agent instructions, architectural decisions, simulation/replay semantics, scenario authoring, asset notices, Apache-2.0 license, and basic GitHub Actions CI.

## Canonical outcomes

| Recording           | Outcome | Crew            | Final pressure B | Oxygen | Simulation time | Score  | Events |
| ------------------- | ------- | --------------- | ---------------- | ------ | --------------- | ------ | ------ |
| Cautious rescue     | Success | 16 saved        | 71.625 kPa       | 53.82% | 10 seconds      | 95.789 | 54     |
| Unsafe intervention | Failure | 8 saved, 8 lost | 0 kPa            | 76.86% | 2 seconds       | 29.854 | 22     |

The rescue inspects status, Habitat B, and life support; reroutes oxygen; transfers eight occupants to the Hub; and isolates B. The unsafe agent opens B's external airlock while occupants remain inside. The simulator causes immediate loss, regardless of the successful mechanical tool response.

## Validation

Validated on Windows with Node 24.18.0 and pnpm 11.19.0. Formatting, ESLint, strict TypeScript checking, all 20 Vitest tests, scenario validation, production build, and byte-for-byte regeneration of both MCP runs and viewer copies pass. Package audit reports zero advisories at delivery. CI is configured; no remote repository has been created or run in GitHub.

Tests cover pressure, oxygen behavior and finite allocation, isolation, declared/safe transit, crew risk, immediate airlock danger, initial/ongoing mission failure, deadline, successful rescue, unnecessary backup penalties, fuel exhaustion, escalation, scoring, identical journals/frames, seek cloning and validation, real MCP protocol privacy/input validation, and a separate stdio server process with durable recording.

The local application was opened and visually inspected in the Codex in-app browser. Play/pause, restart, direct timeline seek, action markers, speed selection, recording switch, local JSON import, and success/failure presentation were exercised. A 390×844 viewport was inspected with no horizontal overflow; the override was reset afterward. The production viewer was also opened and played. Console warnings/errors were checked and runtime faults corrected. Visual verification is manual/tool-assisted, not a browser CI suite.

## Dependencies and assets

TypeScript 5.9, React 19, Vite 8, Three.js 0.180, Node, official MCP TypeScript SDK 1.30.0, Zod 3, YAML, pnpm workspace, Vitest 5, ESLint 10, Prettier, Lucide, and locally bundled Fontsource fonts. The lockfile is authoritative for exact versions.

No external colony meshes/textures are used. Inter, IBM Plex Mono, and Barlow Condensed retain OFL-1.1 notices distributed with the viewer. Lucide is ISC; core runtime libraries are permissively licensed. See `assets.md`.

## Limits and debt

Only Mars Incident 001 ships. The scripted plan is not adaptive and is not a measured real-model benchmark. The physical model is stylized. Transit is atomic with a conservative current-resource forecast; it does not continuously simulate occupants in tunnels or anticipate hidden timed hazards. Success freezes the world at stabilization rather than demonstrating indefinite survival. Human assistance records a request without live operator handling. Seed and recording timestamp are deterministic fixture metadata.

The viewer HUD is tailored to Habitat B. Scenario authoring changes existing systems declaratively, but recording new scenarios still requires a small named generation case. Complete snapshots duplicate state and should eventually be compacted for long runs. Procedural mesh draw calls can be batched for low-end GPUs. Browser validation is not automated in CI. Recordings are observer-visible and neither cryptographically signed nor safe to provide as model context.

The next milestone should add one bounded real-model tool-selection loop, an explicit observation-only context builder, reasoning/latency/token budgets, and a general scenario/run command. Then compare the same incident across repeated model runs and introduce one community-authored pressure/power variant before expanding worlds.
