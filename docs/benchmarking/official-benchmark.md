# Official Standard Benchmark

Agent Arena has two separate research surfaces:

- **Standard Arena** asks which models operate the same environment most effectively. Every run starts clean and uses the same tools, scenario variants, seeds, evaluator, and scoring.
- **Adaptive Research** asks whether an agent improves after previous attempts. Its strategy memory never changes Standard Arena results.

`mars-standard-v1` is the first benchmark version. It currently contains one credible Mars incident family with ten deterministic seeds. The suite is intentionally small and can grow by adding declared scenarios and a new benchmark version when behavior, scoring, tools, or scenario versions change.

Each official model result records the exact provider, model/version identity, benchmark configuration, evaluator and scoring versions, seed list, run references, metrics, token usage, cost, and evaluation date. A result is reusable only when all of those identity and configuration fields still match.

Run the local scripted suite:

```sh
pnpm benchmark:run
pnpm benchmark:leaderboard
```

The current models are deterministic test doubles. They verify benchmark storage and ranking without paid inference. They are not evidence that one language model is universally better.

## Verification boundary

The simulator, consequences, scenario variants, evaluator, scoring, and benchmark configuration are deterministic. Model decisions and future provider responses are the non-deterministic boundary. The evaluator remains host-owned and cannot be changed by a model.

## Provider and execution seams

The benchmark runner owns the clean-run boundary and accepts a model adapter behind a small seam. A future interactive or batch provider can implement that seam without changing the simulator, MCP contract, evaluator, or replay format. Batch execution is deliberately not faked while no provider adapter exists. Local models may report `$0` API cost, but future artifacts can add hardware, duration, or energy metadata so API cost is not confused with computation cost.

Recorded model responses and scripted agents are development fixtures only. They keep UI, replay, scoring, and serialization work inexpensive and are never promoted to an official result without a controlled benchmark run.

## Community and BYOK boundary

Community runs are a separate source category. A contributor may run an adapter with a key supplied through the local environment, then share a replay and cost metadata. Keys are never persisted, logged, or copied into artifacts, and the contributor owns provider charges. Community artifacts can be reviewed beside the official board but cannot change `leaderboard.json` automatically.

An official re-evaluation is required when the benchmark version, scenario version, evaluator, scoring, MCP tool contract, simulation behavior, seed set, or exact provider model identity changes. A pricing change alone does not rewrite historical costs; it creates a new dated pricing snapshot for later runs.
