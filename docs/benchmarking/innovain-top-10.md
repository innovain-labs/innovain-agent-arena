# Innovain Top 10: controlled Azure evaluations

`innovain-mars-arena` evaluates a real Azure Foundry model against all three current Mars emergencies. It runs three attempts per emergency by default (nine paid runs), records the complete MCP action journals, usage and price snapshot, and generates the Innovain Top 10 artifact. The verified replay is deterministic; calling the model again can produce different actions.

GPT-5.6 Luna uses Azure OpenAI's chat-completions endpoint with `reasoning_effort: none` so function tools are accepted. The runner keeps the deployment key in a local environment variable and never writes it to runs, manifests or logs. Model and version details follow Microsoft's [Foundry model catalog](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure); the recorded rates link to Microsoft's [GPT-5.6 Luna pricing announcement](https://azure.microsoft.com/en-us/blog/gpt-5-6-now-available-in-microsoft-foundry/).

```powershell
$env:AZURE_OPENAI_API_KEY = '<key from the Azure resource>'
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

This example makes six runs (two per emergency) and caps the suite at about **$0.0864** using the listed rates, before any provider-side billing adjustments. The default is three attempts per emergency. The runner enforces a per-run budget based on the total suite cap and stops a mission when its token or dollar limit is reached. If the model returns a final answer while the simulation is still running, the official evaluator records that as a mission failure in the replay. Provider or budget interruptions remain partial and are excluded from the board. The evaluation manifest keeps the non-secret endpoint and API type; credentials never enter saved files.

If a suite stops partway through, repeat it with `--resume --evaluation-id <same-id>`. The runner reuses completed, replay-verified attempts that match the scenario, seed and deployment, then retries missing or incomplete attempts. It refuses to overwrite a suite that already has its final manifest.

The v2 incident worlds are deterministic and do not vary with the seed. Repeated attempts therefore measure variation in model decisions from the same initial incident state; they are not independent world variants. Each completed result stores the actual decisions and replay so the score can be reproduced without calling Azure again.

## GPT-6.1 Sol in Foundry

GPT-6.1 Sol is listed by Microsoft Foundry as model version `2026-09-29`; its function and tool calling uses the Responses API. The runner's `--api-mode responses` option calls that API, supplies the real Mars MCP tool schemas, executes the returned function calls in the local MCP session, and passes each result back through the response chain. This evaluation used one attempt for each of the three emergencies, reasoning effort `medium`, and a 180-second request timeout. Microsoft's published Global Standard rates checked on 2026-10-26 were **US$2 / million input tokens** and **US$10 / million output tokens**; see the [model catalog](https://learn.microsoft.com/en-us/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure) and [token pricing and weights](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/provisioned-throughput-sizing).

The verified suite scored **100/100** across the three completed missions. The individual replay scores were 96.895 for the Habitat B leak, 93.784 for the blackout, and 88.500 for the oxygen crisis. Total usage was 51,428 tokens and the conservative estimate was **US$0.114**. The suite score aggregates success, crew survival, safety and efficiency; it is not the arithmetic mean of the three per-run scores. The run records and cost snapshot are in [`gpt-6-1-sol-20261027T031606803z`](../../benchmarks/innovain-arena/evaluations/gpt-6-1-sol-20261027T031606803z/evaluation.json). The temporary deployment was deleted after the run; only the saved, replay-verified evaluation remains.

To reproduce, first confirm current pricing and available Global Standard quota. Standard deployment capacity controls request throughput; it is pay-per-token, unlike provisioned throughput, which is billed by reserved capacity. The example's 250 capacity units matched the available quota for this evaluation and provided ample throughput for the sequential suite.

```powershell
az cognitiveservices account deployment create `
  --resource-group RESOURCE_GROUP `
  --name FOUNDRY_ACCOUNT `
  --deployment-name gpt-6-1-sol-arena-test `
  --model-name gpt-6.1-sol `
  --model-version 2026-09-29 `
  --model-format OpenAI `
  --sku-name GlobalStandard `
  --sku-capacity 250

$env:AZURE_OPENAI_API_KEY = az cognitiveservices account keys list `
  --resource-group RESOURCE_GROUP `
  --name FOUNDRY_ACCOUNT `
  --query key1 -o tsv
pnpm innovain:evaluate -- `
  --provider foundry `
  --api-mode responses `
  --base-url https://FOUNDRY_ACCOUNT.openai.azure.com/openai/v1 `
  --model gpt-6-1-sol-arena-test `
  --catalog-model gpt-6.1-sol `
  --catalog-version 2026-09-29 `
  --region REGION `
  --deployment-type GlobalStandard `
  --attempts 1 `
  --seed 183 `
  --suite-budget-usd 3 `
  --max-input-tokens 200000 `
  --max-output-tokens 50000 `
  --max-tool-calls 30 `
  --request-timeout-ms 180000 `
  --min-request-interval-ms 1000 `
  --input-price-usd-per-million 2 `
  --output-price-usd-per-million 10 `
  --price-effective-date 2026-10-26 `
  --price-source 'Microsoft Foundry GPT-6.1 Sol Global Standard pricing, checked 2026-10-26'
Remove-Item Env:AZURE_OPENAI_API_KEY
az cognitiveservices account deployment delete `
  --resource-group RESOURCE_GROUP `
  --name FOUNDRY_ACCOUNT `
  --deployment-name gpt-6-1-sol-arena-test
```

The suite ceiling is US$3, but the three completed runs used an estimated **US$0.114**. The recorded estimate prices all input tokens at the uncached rate and may differ from the Azure invoice or account-specific offer. Deleting the deployment stops future inference; Azure still bills for already-used tokens.

## Claude Haiku 5.5 in Foundry

Claude models use Foundry's Anthropic Messages API (`/anthropic/v1/messages`), so the official evaluator records the API contract separately from Azure OpenAI. This command runs one attempt for each of the three emergencies against the Azure-hosted Claude Haiku 5.5 deployment, caps the suite at **$0.04 estimated token cost**, and retains no key in the evaluation files. Foundry lists Hosted on Azure as model version `2`; confirm the model card and pricing before a future rerun. Foundry requires accepting the Anthropic Marketplace offer and providing accurate organization details during deployment.

```powershell
$env:CLAUDE_FOUNDRY_API_KEY = (az cognitiveservices account keys list `
  --resource-group RESOURCE_GROUP `
  --name FOUNDRY_ACCOUNT `
  --query key1 -o tsv)
pnpm innovain:evaluate -- `
  --provider anthropic `
  --base-url https://FOUNDRY_ACCOUNT.services.ai.azure.com/anthropic/v1 `
  --api-key-env CLAUDE_FOUNDRY_API_KEY `
  --model DEPLOYMENT_NAME `
  --catalog-model claude-haiku-5-5 `
  --catalog-version 2 `
  --region eastus2 `
  --deployment-type GlobalStandard `
  --attempts 1 `
  --seed 183 `
  --suite-budget-usd 0.04 `
  --max-input-tokens 100000 `
  --max-output-tokens 5000 `
  --max-tool-calls 30 `
  --request-timeout-ms 60000 `
  --min-request-interval-ms 61000 `
  --input-price-usd-per-million 0.10 `
  --output-price-usd-per-million 0.50 `
  --price-effective-date 2026-10-07 `
  --price-source 'Anthropic Claude Haiku 5.5 standard token pricing, 2026-10-07'
Remove-Item Env:CLAUDE_FOUNDRY_API_KEY
```

The token ceilings yield a worst-case estimate of **$0.0375** at Anthropic's published rates; the $0.04 suite cap leaves a small margin. The 61-second request interval is recorded in the manifest to stay below this subscription's observed input-token rate limit. Earlier interrupted attempts used about $0.008 in estimated tokens, so the total estimated exposure across this test remains under **$0.05**. Foundry converts usage to Claude Consumption Units, bills those hourly through Azure Marketplace, and may apply private-offer discounts. Check Foundry Monitor and Azure Cost Management for the invoiced amount. Deleting the temporary Foundry account prevents further inference from it, but already-metered usage remains billable.

## DeepSeek V4 Pro in Foundry

The official suite used the Azure OpenAI-compatible endpoint and verified a tool-call round trip before evaluation. DeepSeek returned a function call; the runner passed that request to the real MCP stdio session, executed the tool, and returned its result to the model. The model does not connect to the MCP server itself; the runner bridges Foundry function calling to MCP. This configuration averaged **13 MCP tool calls per run**.

DeepSeek completed the pressure-leak and blackout missions, then stopped before a terminal outcome in the oxygen emergency. The resulting suite score is **86.33/100** from two successful missions out of three, with **US$0.169 estimated** API cost. The oxygen result is a mission failure, not a tool-protocol failure. The temporary Foundry deployment was deleted after evaluation; the [manifest and three recordings](../../benchmarks/innovain-arena/evaluations/deepseek-v4-pro-20261023/evaluation.json) remain available for offline replay and score verification. Re-running the model requires a new Foundry deployment.

`pnpm innovain:leaderboard` replays all saved official records against the canonical v2 scenarios, recalculates scores and costs, and writes both the source artifact and the static site copy. CI performs this rebuild and checks that the generated files are committed. The browser's **Watch Run** plays the saved replay and makes no provider request.

An official entry comes from the trusted Innovain evaluation runner and its saved files. Replay verification proves the simulation actions and score reproduce; it cannot independently prove Azure model identity from a JSON file. The manifest records the deployment label and response-reported model when Azure supplies it. Community submissions remain self-reported and cannot enter this board.
