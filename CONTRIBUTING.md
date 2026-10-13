# Contributing

Agent Arena welcomes clear, reproducible contributions to scenarios, agent behavior research, Mars visuals, scoring, accessibility, and replay.

Use English throughout public code, docs, UI, errors, and commit messages. Read `AGENTS.md` and the architecture docs. Keep domain rules out of React, use real MCP for evaluated agent actions, and preserve replay artifacts and observation privacy.

Run `pnpm install`, `pnpm format`, and `pnpm check`. Regenerate runs after changes to scenario/rules/scoring. For visuals, watch both recordings and test replay controls in a WebGL browser. Explain changed behavior and validation in your PR. External assets need redistributable licensing and notices in `docs/assets.md`.

Avoid operational infrastructure and generic abstractions unrelated to a concrete experiment. Discuss material changes to format, scoring, or agent visibility with maintainers. All dangerous operations must remain confined to the fictional simulation.
