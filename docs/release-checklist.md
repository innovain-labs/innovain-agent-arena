# Preparing the public repository

The repository is maintained under Innovain's GitHub organization and remains private until its public launch. This checklist does not publish anything automatically.

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

Review the existing private repository, confirm its organization remote and branch protections, then publish only as part of the owner's launch decision. Confirm the Linux CI workflow passes. Configure private vulnerability reporting, a conduct contact, Dependabot, and suitable default-branch protections. Add the real remote URL to the public viewer.

## Optional public demo

The viewer is static and makes no model calls. GitHub Pages needs a deployment workflow, `VITE_BASE_PATH=/<repository-name>/` for a project site, and a production build. The viewer's bundled resources use the Vite base URL. `vite preview` is a local verification server, not production hosting.

## Release wording

Describe 0.1.0 as an experimental agent research simulator. Disclose the initial one-model, six-run GPT-5.6 Luna evaluation, its estimated cost, and the limits of replay-based model provenance. Scripted demos are not LLM results. Do not claim calibrated physical behavior, universal model superiority, or an independently audited benchmark.
