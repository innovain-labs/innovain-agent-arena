# Create a Mars incident

Copy `scenarios/mars/habitat-b-leak/` to `scenarios/mars/<your-slug>/`. Keep one `scenario.yaml` and one public `briefing.md`. No engine changes are needed to vary the existing pressure, oxygen, transit, power, and crew systems.

## Edit the declaration

1. Set a unique metadata ID, English title, description, and difficulty.
2. Set initial resources and the A, B, and Hub habitat states. Crew IDs must be unique.
3. Declare transit paths with safe pressure thresholds. Isolation closes those paths.
4. Choose safe/lethal pressure and resource modifiers. Lethal pressure must be below safe pressure.
5. Add timed hazards, objectives, enabled failures, and score weights totaling 100.
6. Write a briefing with only information an agent is permitted to know.

Example additional hazard:

```yaml
timedEvents:
  - at: 8
    type: power_drop
    amount: 40
    message: A dust front reduces available colony power.
  - at: 15
    type: leak_increase
    habitat: B
    amount: 1.5
    message: The damaged seal deteriorates.
```

Validate from root:

```sh
pnpm scenario:validate scenarios/mars/<your-slug>/scenario.yaml
```

For an MCP session, configure the host environment `ARENA_SCENARIO` to the YAML path. The default is Incident 001. Start the host from repository root using `node --import tsx apps/server/src/mcp.ts` or `pnpm mcp`.

## Record a contribution

The example generator at `apps/server/src/generate-runs.ts` demonstrates the complete recording flow. For a new scenario, use `AgentSession` to spawn the host with `ARENA_SCENARIO` and a host-private `ARENA_RECORD_PATH`. Select a concrete scripted plan using only discovered tools and public observations. After the session closes, wrap the journal/frames in run format 1 and calculate host scoring. Do not add a recorder-export tool for the agent.

`pnpm generate:runs` regenerates rescue and failure fixtures for all three incidents in `marsIncidents`. Add a public catalog entry and explicit fixture plans when contributing an incident. The local CLI accepts a scenario and loads the adjacent briefing:

```sh
pnpm arena:run -- --provider scripted --model scripted-rescue --scenario scenarios/mars/power-blackout/scenario.yaml --output runs/my-blackout.json
```

Built-in scripted plans cover the three shipped incidents. A custom incident needs its own fixture plan or a real model run; the default rescue script is not a universal solver.

## Pull request expectations

- Explain the incident's research question and intended tradeoff.
- Include a public briefing and declarative scenario.
- Add deterministic tests for the intended success and failure paths.
- Include at least one recording generated through real MCP.
- Run `pnpm check` and watch the run in the browser.
- Keep hidden hazards/objectives/scoring out of agent observations.

The viewer derives the target habitat and mission information from the selected recording/scenario. It renders emergencies in Habitat A or B and shows the selected public briefing. Engine and replay contracts still support the fixed Mars habitats A, B, and Hub. A different world or physical system needs concrete rules, tools, tests, and a compatible renderer/recording contract.
