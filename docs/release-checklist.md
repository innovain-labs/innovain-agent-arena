# Preparing the public repository

The local repository has no public remote. This checklist does not publish anything automatically.

## Owner choices

Use your personal GitHub account to administer an Innovain organization, and create the project repository under that organization. An organization owns the shared code; each collaborator authenticates with their own account. Use an Innovain-controlled contact email for organization communication if available.

## First commit

- Review source, licenses, logo notices, public fixtures, and lockfile.
- Exclude `.env`, credentials, `node_modules`, `dist`, `work`, and unreviewed local model runs.
- Run a secret scan on the actual staged contents before pushing.
- Keep Apache-2.0 and the bundled font notices with the distribution.
- Run `pnpm install --frozen-lockfile`, `pnpm scenario:validate`, `pnpm check`, `pnpm runs:verify`, and `pnpm audit`.
- Test all three emergencies, six recordings, catalog links, imported runs, and narrow screens.

## GitHub setup

Create the repository, configure the remote, make the reviewed initial commit, and push only after owner authorization. Confirm the Linux CI workflow passes. Configure private vulnerability reporting, a conduct contact, Dependabot, and suitable default-branch protections. Add the real remote URL to the public viewer.

## Optional public demo

The viewer is static and makes no model calls. GitHub Pages needs a deployment workflow, `VITE_BASE_PATH=/<repository-name>/` for a project site, and a production build. The viewer's bundled resources use the Vite base URL. `vite preview` is a local verification server, not production hosting.

## Release wording

Describe 0.1.0 as an experimental agent research simulator. Disclose scripted demo agents and the Incident 001 benchmark scope. Real MCP transport does not mean an LLM generated a given recording. Do not claim calibrated physical behavior, universal model superiority, or an independently audited benchmark.
