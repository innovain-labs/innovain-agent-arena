# Innovain Top 10: methodology and reproducibility

The Innovain Top 10 contains controlled model evaluations from Innovain. It is separate from the Community Top 10 and from deterministic scripted examples.

## Current evaluation

The first entry evaluates Azure Foundry **GPT-5.6 Luna**, deployment version `2026-07-09`, on all three Mars v2 emergencies. It contains six real model runs: two attempts per emergency. Three missions succeeded and three failed. The overall score is **69.78/100**. Recorded provider usage and Microsoft's published Global Standard token prices give an estimated API cost of **US$0.027**; this is an estimate, not an Azure invoice.

The [source manifest](../benchmarks/innovain-arena/evaluations/gpt-5-6-luna-20261023T190511769z/evaluation.json) and all six replays are bundled with the site. They include model response metadata, token usage, price snapshot, MCP tool calls and simulation outcomes. No API key is included.

- [Pressure leak · attempt 1 (failure)](../benchmarks/innovain-arena/evaluations/gpt-5-6-luna-20261023T190511769z/runs/habitat-b-leak-v2-attempt-01.json)
- [Pressure leak · attempt 2 (success)](../benchmarks/innovain-arena/evaluations/gpt-5-6-luna-20261023T190511769z/runs/habitat-b-leak-v2-attempt-02.json)
- [Power blackout · attempt 1 (success)](../benchmarks/innovain-arena/evaluations/gpt-5-6-luna-20261023T190511769z/runs/power-blackout-v2-attempt-01.json)
- [Power blackout · attempt 2 (success)](../benchmarks/innovain-arena/evaluations/gpt-5-6-luna-20261023T190511769z/runs/power-blackout-v2-attempt-02.json)
- [Oxygen shortage · attempt 1 (failure)](../benchmarks/innovain-arena/evaluations/gpt-5-6-luna-20261023T190511769z/runs/oxygen-shortage-v2-attempt-01.json)
- [Oxygen shortage · attempt 2 (failure)](../benchmarks/innovain-arena/evaluations/gpt-5-6-luna-20261023T190511769z/runs/oxygen-shortage-v2-attempt-02.json)

## Reproduce the result

Run `pnpm innovain:leaderboard` from the project root. The verifier replays each saved tool call against the canonical Mars v2 scenario, checks the resulting events and frames, recalculates scores and costs, and regenerates both the source and browser leaderboard artifacts. It makes no provider requests. **Watch Run** also plays the saved replay without calling Azure.

To make a new evaluation, configure a compatible Azure Foundry deployment and set its key in your local PowerShell environment. The runner sends the key directly to Azure and never includes it in the saved replay or manifest. This command makes new model calls and may produce different decisions and scores:

```powershell
$env:AZURE_OPENAI_API_KEY = '<your local Azure key>'
pnpm innovain:evaluate -- `
  --provider foundry `
  --base-url https://RESOURCE.openai.azure.com/openai/v1 `
  --model DEPLOYMENT_NAME `
  --catalog-model gpt-5.6-luna `
  --catalog-version 2026-07-09 `
  --region eastus2 `
  --deployment-type GlobalStandard `
  --attempts 2 `
  --seed 183 `
  --suite-budget-usd 0.09 `
  --max-input-tokens 60000 `
  --max-output-tokens 2000 `
  --max-tool-calls 30 `
  --request-timeout-ms 60000 `
  --input-price-usd-per-million 0.20 `
  --output-price-usd-per-million 1.20 `
  --price-effective-date 2026-07-30 `
  --price-source 'Microsoft Azure GPT-5.6 Luna Global Standard pricing'
Remove-Item Env:AZURE_OPENAI_API_KEY
```

## Limits

The Mars simulation is a stylized research environment, not a calibrated life-support model. Two attempts per incident are an initial sample, not broad statistical evidence. Replay verification proves that recorded actions and scores reproduce; it does not independently attest which provider model generated them. Provider-reported model metadata is retained for transparency. Community submissions are self-reported and cannot enter Innovain's board.
