# Cost governance

Paid inference is opt-in and bounded. Every runner receives a finite `BudgetPolicy`; there is no unlimited default.

The conservative standard defaults are:

```text
maxUsd: 25
maxRuns: 30
maxAttempts: 10
maxInputTokens: 1,000,000
maxOutputTokens: 200,000
maxToolCallsPerRun: 30
maxConcurrentRuns: 1
maxRetries: 1
```

Adaptive experiments use a smaller default of `$10`, 10 runs, and 5 attempts. A caller can lower any limit explicitly.

Before a paid model call, the runner estimates token usage and cost, checks every configured limit, and reserves the potential spend. If the reservation would exceed a limit it stops with `BUDGET LIMIT REACHED`, persists the current state, and does not make the call. Retries are bounded and infrastructure failures are kept separate from model failures.

The pricing catalog is a dated snapshot. It stores provider, exact model id, effective date, input/output prices, cached-input or reasoning prices when available, currency, and source. Historical benchmark artifacts keep the snapshot id used for their calculation. API keys are never part of artifacts or logs.

`pnpm benchmark:estimate` prints the planned models, runs, token totals, estimated cost, configured budget, and whether it is safe to start. It always ends with `NO API CALLS EXECUTED`.

Both benchmark commands accept explicit `--budget-usd`, `--max-runs`, `--max-attempts`, `--max-input-tokens`, `--max-output-tokens`, `--max-tool-calls-per-run`, `--max-concurrent-runs`, and `--max-retries` overrides.

Cost is reported at run, experiment, model evaluation, and suite levels. Estimated and actual values remain distinct. `cost per successful mission` is shown only when at least one mission succeeds.

The estimator exposes combinatorial growth before execution: models × seeds × attempts × candidates × generations. A future planner must show `LARGE EXPERIMENT WARNING` and require explicit limits when a plan crosses a declared threshold. The runner defaults to one concurrent run, keeps retries bounded, and leaves a batch-provider seam for adapters that can reduce cost without bypassing the same ledger.

Local inference may have `$0` provider billing while still consuming hardware time and energy. Those dimensions are intentionally optional metadata for a later milestone. Community or BYOK execution is opt-in and keeps credentials in the caller's environment; Agent Arena never stores keys or charges a visitor.
