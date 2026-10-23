# Public arena with user-owned model credentials

Status: architecture recommendation, not a deployed API. The current website offers replay and manual browser practice; the local runner still starts a local MCP stdio child. No remote session service or public result-upload endpoint is included in this change.

## Recommended first public AI mode

Use a local runner plus a hosted game service. This avoids requiring visitors to trust website JavaScript with long-lived model keys and works with provider endpoints that do not allow browser CORS. A browser-only no-key experience can offer human practice and recordings today; actual model inference still needs a local model, provider authentication, or inference paid for by Innovain.

```mermaid
sequenceDiagram
    participant Browser as arena.innovain.ai
    participant Runner as User local runner
    participant Provider as User AI provider
    participant Game as Innovain game service / MCP
    Browser->>Game: Sign in, create private match, display pairing code
    Runner->>Game: Redeem pairing code; get scoped Arena credential
    Runner->>Provider: Model request using provider key kept locally
    Provider-->>Runner: Selected tool call
    Runner->>Game: MCP tool call using Arena credential
    Game-->>Runner: Public observation
    Game-->>Browser: Sanitized live telemetry and action events
    Game->>Game: Finish match, compute score, store authoritative log
    Browser->>Game: Explicit consent to publish community result
```

The provider API key travels only from the local runner to its configured provider via HTTPS. It is not given to the browser, Innovain, a remote MCP server, an Arena token issuer, replays or pairing codes. The separate Arena credential authorizes a game session; it cannot call the AI provider. Do not proxy arbitrary provider URLs or pass a provider key through MCP headers. Keep provider credentials out of model prompts and SDK child environments as in the current local runner.

## Concrete service boundary

- Host a narrow Streamable HTTP MCP endpoint such as `https://api.arena.innovain.ai/mcp`, behind HTTPS and per-request authentication. Use the installed SDK's supported protocol revision and test negotiation, rather than implementing JSON-RPC ad hoc.
- Use GitHub sign-in or another identity provider, then short-lived, audience-bound Arena access tokens. Bind every match/tool call/stream to its owner. Pair the browser and CLI with single-use, expiring codes; authorize them after sign-in, never use an unscoped match ID as a credential.
- Keep one isolated simulation per match and a serialized action queue. The host selects suite/version/seed from an allowlist; callers cannot supply executable code, file paths, evaluator settings or private world state.
- Expose the same public tools and observations used locally. The website subscribes to sanitized observation events over SSE or WebSocket. Keep true leak rates, future hazards, hidden evaluator state, other users' sessions and unfinished full replays private.
- Persist authoritative action logs and snapshots server-side. Final scores are computed by the host and can be signed. Publish the full replay only after completion and explicit user consent. Never accept a client-provided score as authoritative.
- Enforce per-user/IP quotas, concurrent-match limits, body and action limits, idle expiry, and simulation resource limits. Validate Origin/Host, authentication audience and ownership; restrict allowed origins and do not trust CORS as authorization. Retain bounded operational logs without tokens or request authorization headers.
- Keep API-key input fields out of the hosted web app. A later desktop companion could use OS credential storage; the CLI can retain environment-only credentials today. A generic no-key provider OAuth flow should not be promised unless that provider supports the required delegated inference access.

MCP's published guidance requires protection of HTTP endpoints and forbids token passthrough. Primary references: [Streamable HTTP transport](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/draft/basic/transports/streamable-http.mdx), [authorization security considerations](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/authorization/security-considerations.mdx). Pin and review the exact protocol revision used during implementation; draft documentation can change.

## Two public ranking surfaces

**Innovain / controlled evaluations:** known provider deployments and configurations, controlled budgets, fixed suite/tool/evaluator versions, repeated seeds/attempts, usage evidence, reviewed artifacts. This is the appropriate place for claims about measured models.

**Community / user-controlled agents:** hosted simulation verifies action consequences and score. Provider/model identity, inference usage, and whether a human helped remain self-reported unless independently attested. Label that limitation even when the game service signs its score. Rank only within the same world, suite, tool contract and evaluator. Use a complete suite with a documented aggregate rather than the highest single lucky run.

The existing reviewed-file Community Top 10 is an intermediate stage. A hosted service can replace manual PR intake while preserving these distinctions. Local-only imports remain private and ineligible until explicitly submitted and verified.

## Practical delivery order

1. Release the shared MCP tools, three emergencies with rescue and failure runs, manual practice, docs and reviewed-file community board now available in this checkout.
2. Provision a backend host and persistent store; add sign-in, match creation and one-use CLI pairing.
3. Add remote transport to the runner, ownership checks, quotas, disconnect handling and sanitized live spectating; test with adversarial cross-user requests and credential-canary tests.
4. Add opt-in publication, generated Top 10 and signed authoritative replays. Keep Innovain controlled evaluations separate.
5. Run repeated real models before claiming measured superiority; share short replay comparisons and a reproducibility guide for international contributors.

Deployment needs a selected hosting environment, application registration/callbacks, domain/TLS configuration, storage and operational budget. Exposing the current stdio process directly to the internet is not this architecture.
