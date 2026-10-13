# Experiments

An Experiment groups repeatable runs over one scenario family. Experiment artifacts are plain files so they can be reviewed, diffed, copied, and regenerated without a database.

The artifact also records the exact model identity, scenario version, creation/completion timestamps, external-memory versions, and cost summary. Paid adapters must attach a finite budget policy before they start.

```text
experiments/<experiment-id>/
  experiment.json
  summary.json
  attempt-001/
    run.json
    reflection.json
    reflection.md
    strategy.json
```

Run the first adaptive or baseline experiment from the repository root:

```sh
pnpm experiment:run -- --mode adaptive --attempts 5 --seed 101 --holdout-seed 901
pnpm experiment:run -- --mode baseline --attempts 5 --seed 101 --holdout-seed 901
pnpm experiment:compare
```

The two modes should use identical training and holdout seeds when they are compared. Training seeds are used for reflection. Holdout seeds are evaluated after training and never alter the strategy.

## Future experiment

**Mars Long-Horizon Survival** will ask whether an agent can keep Mars Colony Alpha alive for 1,000 simulated sols. It will require resource management, maintenance, exploration, randomized incidents, and long-term planning. It is intentionally outside the current milestone.

## Metrics

`summary.json` records mission success rate, crew survival rate, average safety, dangerous actions, unnecessary tool calls, time to stabilization, oxygen used, attempts to success, and the score trajectory. A trajectory may move backwards; improvement is an empirical result rather than a monotonic assumption.

## Scenario variants

`createMarsVariant` derives bounded, reproducible changes from an integer seed. The first implementation varies leak severity, resources, available paths, and one hidden isolation efficiency factor while keeping Incident 001's public Habitat B target coherent. The API can also vary leak and crew locations for a scenario family with a generic briefing. Variant parameters are host metadata and are not serialized into MCP observations.

## Reproducibility and limits

Every attempt records its experiment, attempt number, variant seed and split, strategy versions, model label, MCP protocol, tool calls, events, frames, outcome, and score. Secrets are never persisted. The simulator remains fictional and deterministic; external memory is not weight training, and the initial test double must be replaced by a real model before making claims about model learning.
