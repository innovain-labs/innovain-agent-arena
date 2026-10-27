# Local runner

The local runner starts the existing Mars MCP server as a child process, gives an agent a public briefing and the scenario's MCP tool contract, and writes the same versioned `Run` recording consumed by the replay viewer.

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

The selected YAML loads its adjacent `briefing.md`; model instructions are not hardcoded to Habitat B. Scripted fixtures cover all three incidents. Providers must report input/output usage. Requests are not retried automatically. Budget stops write a replay with a host-side `stopReason` and CLI exit code 2, preserving the last real state without inventing a mission failure. Timeout/provider failures preserve a partial replay with a redacted host stop reason and exit with an error. Priced costs use the `estimated` status because token prices do not establish actual provider billing.

Credentials are read only in the local process. They are not passed to the MCP child, serialized into `run.json`, included in errors, or sent to Innovain. The browser's **Open local run.json** action uses the File API and performs no upload.

Pricing is optional for local connectivity and behavior tests because prices and deployments change. Official or cost-comparison workflows still require an explicit dated pricing snapshot. A local run is always `official: false`; only verified benchmark artifacts can enter the official leaderboard. Reviewed community contributions can enter the separate [Community Top 10](community-leaderboard.md). See the [tool catalog](mcp-tools.md).

## Portable runner and complete Community suite

The downloadable ZIP at **Try Your Model** is built from this repository with `pnpm runner:package`. It contains bundled JavaScript, the three current canonical scenarios, licenses, documentation and checksums. Node.js 24 is recommended (22.13+ supported). No pnpm, repository checkout, telemetry or automatic upload is required. Extract it and run commands inside the extracted folder. Keep it separate from older runner versions.

`node arena.mjs --help` explains all options; `node arena.mjs list` describes the emergencies. A free connectivity test:

```sh
node arena.mjs suite --provider scripted --entrant my-handle
node arena.mjs verify --directory arena-results
```

Source checkout equivalent: `pnpm arena -- suite --provider scripted --entrant my-handle`.

Choose an available model or deployment explicitly. Presets:

| Provider                         | Flag                                                                      | Local credential variable |
| -------------------------------- | ------------------------------------------------------------------------- | ------------------------- |
| OpenAI Chat Completions          | --provider openai                                                         | OPENAI_API_KEY            |
| Claude native Messages           | --provider anthropic                                                      | ANTHROPIC_API_KEY         |
| DeepSeek Chat Completions        | --provider deepseek                                                       | DEEPSEEK_API_KEY          |
| Azure Foundry OpenAI v1          | --provider foundry --base-url https://RESOURCE.openai.azure.com/openai/v1 | AZURE_OPENAI_API_KEY      |
| Other Chat Completions endpoints | --provider openai-compatible --base-url https://HOST/v1                   | OPENAI_COMPATIBLE_API_KEY |
| Ollama                           | --provider ollama                                                         | No key                    |

An endpoint must support tool calls and report token usage. Compatible does not mean every API or model supports these features. Foundry project/hosted-agent APIs, Responses-only models, Entra sign-in, Gemini native APIs and arbitrary custom headers are not implemented. Gemini and other services may be used through their documented OpenAI-compatible endpoints where supported. Claude uses native tool-use blocks; DeepSeek thinking is disabled in this adapter. No automatic fallback to a different model or paid retry occurs.

PowerShell: read a credential without putting its value into shell history:

```powershell
$credential = Read-Host 'Provider API key' -AsSecureString
$env:OPENAI_API_KEY = [System.Net.NetworkCredential]::new('', $credential).Password
node arena.mjs suite --provider openai --model YOUR_MODEL --entrant your-handle
Remove-Item Env:OPENAI_API_KEY
$credential.Dispose()
$credential = $null
```

On macOS/Linux (Bash):

```bash
read -rsp 'Provider API key: ' OPENAI_API_KEY; echo
export OPENAI_API_KEY
node arena.mjs suite --provider openai --model YOUR_MODEL --entrant your-handle
unset OPENAI_API_KEY
```

Use the corresponding variable for other providers. `--api-key-env` selects a custom environment variable; there is deliberately no key argument or web key form. Remote URLs require HTTPS and reject embedded credentials, query strings, fragments and redirects; loopback HTTP supports local servers. API keys are sent directly to the endpoint you configure, so choose a trusted provider. A custom base URL overrides the provider preset.

The suite executes independent missions in catalog order. Default limits are 60 tools, 20,000 cumulative input tokens, 2,000 cumulative output tokens and a 30-second request timeout **per mission**. A full suite can consume three times the per-mission budget. Costs without explicit prices are unknown; provider-side account spending limits remain useful. Set both price flags to enforce an estimated USD budget. Errors preserve partial replays; incomplete missions cannot generate a valid submission. Fix configuration or limits and use a new output directory for another attempt. No automatic resume or retry spends money unexpectedly.

Successful completion writes `arena-results/submission.json` plus three replays under `arena-results/community/runs/HANDLE/`. Both successful and failed completed missions count. Run `verify` before sharing; it checks current canonical physics and recalculates scores through MCP. The browser opens individual replay JSON files locally. Community pull-request intake is closed while the source repository is private. When the public source release opens, copy the generated `community/runs/HANDLE` folder into the repository and merge the entry from `submission.json` into `community/submissions.json` in a data-only pull request. Never replace other people's manifest entries. See [Community verification](community-leaderboard.md). A generated manifest is not an automatic leaderboard entry.

For development maintainers: `pnpm leaderboard:demo` restores two clearly labeled scripted examples to Innovain Top 10 after regenerating runs. `pnpm leaderboard:clear-demo` removes them before launch. Community submissions cannot invoke either command remotely or change Innovain's board.
