# Security policy

Agent Arena 0.1 is an experimental fictional simulator. Provider requests run locally; the public viewer only plays recorded JSON.

## Reporting

Report security vulnerabilities confidentially to [info@innovain.com](mailto:info@innovain.com), which is monitored by Innovain maintainers. Include the affected version, reproduction steps using placeholder credentials, impact, and suggested mitigation. Do not publish credentials or exploit details in public issues.

Before public launch, ensure the mailbox remains monitored. After the repository becomes public, enable GitHub's private vulnerability reporting and verify that the Security → Report a vulnerability channel is available. GitHub's private reporting is enabled for public repositories. Routine UI bugs belong in ordinary issues.

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
