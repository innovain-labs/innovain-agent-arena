# Adaptive agents

Agent Arena studies **learning through external memory and strategy adaptation**. It does not fine-tune model weights, modify the simulator, or allow an agent to inspect private evaluator state.

## Experiment loop

An experiment runs a bounded sequence of attempts against deterministic scenario variants:

```text
Attempt 1 → MCP run → public outcome → reflection → Strategy v2
Attempt 2 → MCP run → public outcome → reflection → Strategy v3
```

The simulation, scenario transitions, consequences, replay frames, and score remain deterministic. Model decisions, reflection text, and strategy updates are the non-deterministic research surface. The current first experiment uses a scripted test double so the storage and comparison pipeline can be verified before a live model adapter is added.

## Learning modes

**Baseline** starts every attempt with no previous strategy. It is the control condition.

**Adaptive** receives the accumulated Strategy Artifact from previous training attempts. A holdout attempt receives the final training strategy but never contributes a reflection or strategy update.

Both modes receive the same public briefing, MCP tools, scenario variants, and scoring rules.

## Strategy Artifact

The strategy is a versioned JSON document. It contains readable principles, priorities, known risks, and causal hypotheses. It is data, not executable code. Every update is stored beside the attempt that produced it so a reviewer can inspect what changed.

## Reflection boundary

Reflection receives only the public briefing, discovered tool calls and results, observable world events, terminal outcome, and public evaluation feedback. The scenario declaration, hidden modifiers, scoring configuration, and undisclosed failure triggers are removed before reflection. This keeps adaptation auditable and prevents evaluator leakage.

## First research question

Mars Learning Experiment #001 asks: “Can an agent stabilize Habitat B more reliably after experiencing previous failures?” The shipped test double intentionally makes an unsafe first attempt, records the failure, and then uses the resulting strategy to select the cautious rescue ordering. This demonstrates infrastructure behavior; it is not evidence that a language model has learned.

The next step is to replace the test double with one concrete provider adapter while preserving the same MCP and recording boundary.
