# Local runner

The local runner starts the existing Mars MCP server as a child process, gives an agent a public briefing and the nine registered tools, and writes the same versioned `Run` recording consumed by the replay viewer.

```sh
pnpm arena:run -- --provider scripted --model scripted-rescue --output runs/my-run.json
```

Supported providers:

- `scripted`: deterministic smoke test with no network and no billing.
- `ollama`: local OpenAI-compatible endpoint at `http://127.0.0.1:11434/v1/chat/completions`.
- `openai`: OpenAI Chat Completions called directly from the user's machine. Set `OPENAI_API_KEY` in the process environment. Pricing is optional for local tests.
- `openai-compatible`: any provider exposing the OpenAI Chat Completions contract. Set `--base-url` (or `OPENAI_COMPATIBLE_BASE_URL`), choose the deployment with `--model`, and provide the credential through the environment variable named by `--api-key-env` (default `OPENAI_COMPATIBLE_API_KEY`). Use `--auth-mode api-key` for Azure Foundry's `api-key` header; the default `bearer` mode is suitable for most compatible services.

For an Azure Foundry Models v1 deployment, provide the key through the environment only (never as a runner argument) and run the local runner from PowerShell:

```powershell
$env:AZURE_OPENAI_API_KEY = '<your-key>'
$env:OPENAI_COMPATIBLE_BASE_URL = 'https://<resource>.openai.azure.com/openai/v1'
pnpm arena:run -- --provider openai-compatible --model <deployment-name> --api-key-env AZURE_OPENAI_API_KEY --auth-mode api-key --max-tool-calls 20 --output runs/azure-foundry.json
```

The compatible provider uses Chat Completions and keeps the MCP server local. It does not turn the browser into a live inference client; open `runs/azure-foundry.json` in the viewer after the run finishes. For a Foundry project endpoint that requires the Responses API or a hosted agent toolbox, a separate Foundry adapter is needed.

Useful limits include `--max-input-tokens`, `--max-output-tokens`, `--max-tool-calls`, `--request-timeout-ms` (default 30000), `--scenario`, and `--seed`. Each request checks a conservative UTF-8 input estimate and caps response tokens to the remaining cumulative allowance. Reported usage is checked afterward; provider accounting can differ from the estimate. With both price flags, cost is estimated before each call and `--budget-usd` is enforced. Without prices, usage is recorded without claiming a dollar cost.

The selected YAML loads its adjacent `briefing.md`; model instructions are not hardcoded to Habitat B. Scripted fixtures cover all three incidents. Providers must report input/output usage. Requests are not retried automatically. Budget stops write a replay with a host-side `stopReason` and CLI exit code 2, preserving the last real state without inventing a mission failure. Timeout/provider failures exit with an error. Priced costs use the `estimated` status because token prices do not establish actual provider billing.

Credentials are read only in the local process. They are not passed to the MCP child, serialized into `run.json`, included in errors, or sent to Innovain. The browser's **Open local run.json** action uses the File API and performs no upload.

Pricing is optional for local connectivity and behavior tests because prices and deployments change. Official or cost-comparison workflows still require an explicit dated pricing snapshot. A local run is always `official: false`; only verified benchmark artifacts can enter the official leaderboard.
