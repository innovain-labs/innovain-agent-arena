# Scenario SDK

The v1 Scenario SDK is the exported `MarsScenario`, `scenarioSchema`, and `parseScenario` API in `packages/mars-world/src/scenario.ts`. The Node loader parses YAML then validates with Zod. It is deliberately a small Mars schema rather than a universal DSL.

The initial state contains sol, oxygen, power, backup fuel, support status, all three habitats, and uniquely identified crew. The schema supplies readable defaults for isolation, airlocks, and oxygen flow. Paths declare valid undirected transit connections and minimum pressure. Modifiers configure risk/lethal thresholds, oxygen use, containment factor, backup effects, and deadline. Objectives, enabled failure checks, and score weights are explicit.

Timed events support `power_drop` and `leak_increase`. New events should be added only alongside a concrete incident and tests. Unsupported keys are rejected so spelling mistakes cannot silently change a benchmark.

Three incidents ship: Habitat B Pressure Leak (001), Life Support Blackout affecting Habitat A (002), and Critical Oxygen Shortage (003). The latter two exercise power prerequisites, finite fuel, closed transit paths, and shared reserve depletion using existing deterministic rules. No simulation/scoring contract changed, so scenario schema 1 and run format 1 remain valid. `pnpm scenario:validate` checks all three.

Authoring guide: [creating-scenarios.md](creating-scenarios.md). A modified copy of Incident 001 can change resources, leak severity, crew allocation, paths, timing, and scoring without touching the engine. Adding a new physical system such as fire still requires a small world-rule extension; YAML is not executable code.

For repeated research, `createMarsVariant` derives bounded deterministic variants from integer seeds. Training and holdout seed lists belong to the experiment artifact. Variant parameters remain host metadata; agents discover the resulting state through the same public MCP tools.
