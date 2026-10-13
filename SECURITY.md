# Security policy

Agent Arena 0.1 is an experimental fictional simulator. Provider requests run locally; the public viewer only plays recorded JSON.

## Reporting

Once the public GitHub repository is configured, use its Security → Report a vulnerability facility if private vulnerability reporting is enabled. Until a private reporting channel is configured, do not publish credentials or exploit details in public issues. Maintainers must configure that channel before the first public release.

Reports should identify the affected version, reproduction steps with placeholder credentials, impact, and suggested mitigation. Routine UI bugs belong in ordinary issues.

## Boundaries

- MCP uses local stdio and fictional infrastructure only.
- The MCP child does not inherit provider credential environment variables.
- Provider errors are redacted. API keys must never be submitted to the public viewer.
- Run files include complete observer-visible state. Never provide them as evaluated model context.
- Local provider artifacts must be reviewed before redistribution. Generated demo fixtures are explicitly whitelisted for publication.
- Token estimates and USD estimates are conservative local guards, not provider billing guarantees.

## Maintenance

Run `pnpm audit`, update vulnerable dependencies, and validate with `pnpm check` and `pnpm runs:verify`. Dependabot configuration is included for dependency and GitHub Actions updates.
