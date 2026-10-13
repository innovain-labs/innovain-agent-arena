# Arena Standard Benchmark v1

This directory contains official, reproducible model evaluations for `mars-standard-v1`.

- Every model receives the same scenario family, deterministic seeds, MCP tools, and evaluator.
- Standard runs start clean and never receive adaptive strategy memory.
- Only verified artifacts under `models/` can appear in `leaderboard.json`.
- Community runs are separate and cannot alter this official artifact.
- The current entries use local scripted test doubles, so their provider cost is `$0.00`.

Regenerate the suite from the repository root:

```sh
pnpm benchmark:run
pnpm benchmark:leaderboard
```
