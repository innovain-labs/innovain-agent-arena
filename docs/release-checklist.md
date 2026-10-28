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

Review the existing private repository, confirm its organization remote and branch protections, then publish only as part of the owner's launch decision. Confirm the Linux CI workflow passes. Ensure `info@innovain.com` is monitored for confidential vulnerability reports; after the repository is public, enable GitHub private vulnerability reporting. Configure a conduct contact, Dependabot, and suitable default-branch protections. Add the real remote URL to the public viewer only when the source repository is public.

## Innovain launch gate

- Keep the GitHub repository private until the owner authorizes the public-source launch.
- Before launch, verify that `arena.innovain.ai` is bound to the Azure App Service, HTTPS is healthy, the canonical and social metadata use the custom hostname, the social image loads, and the site works in a clean browser. The custom hostname, HTTPS, and metadata have already been deployed and smoke-checked; repeat the concise check against the exact release build.
- Confirm `info@innovain.com` is monitored for confidential vulnerability reports before public release. Immediately after changing repository visibility to public, enable GitHub private vulnerability reporting and verify the Report a vulnerability channel; GitHub currently offers this feature for public repositories.
- Confirm the exact `main` commit has a green CI run before public release.
- Protect `main` by requiring the `CI / validate` check and blocking force-pushes and branch deletion. GitHub currently warns that classic protection rules will not be enforced for this private repository unless the organization upgrades to Team or Enterprise; decide whether to upgrade or apply and verify protection immediately after the repository becomes public.
- Keep `VITE_PUBLIC_REPOSITORY_URL` unset while the GitHub repository is private. Set it to the real repository URL only for the public-source release build.
- Publish the site's Privacy page and social preview metadata/card with the demo. Keep the canonical URL and social image host on `arena.innovain.ai`.
- Stage only reviewed files. Keep incomplete local model evaluation directories out of the release.

## Optional public demo

The viewer is static and makes no model calls. GitHub Pages needs a deployment workflow, `VITE_BASE_PATH=/<repository-name>/` for a project site, and a production build. The viewer's bundled resources use the Vite base URL. `vite preview` is a local verification server, not production hosting.

## Azure Linux App Service option

The current site is a React/Vite static viewer; the model runner and MCP stdio server remain local tools, not part of a hosted backend. `pnpm build` creates `apps/web/dist`, and `apps/web/server.mjs` serves the static build on App Service's `PORT` without adding runtime dependencies. `pnpm preview` remains for local review. A Linux App Service deployment uses the Node 24 LTS runtime, the `node server.mjs` startup command, and a ZIP containing the server and built `dist/` folder, followed by a smoke test of assets, replay files, and hash-based routes. An existing Linux App Service plan can host the app if it has capacity; confirm the target app, domain, and TLS before deployment.

## Release wording

Describe 0.1.0 as an experimental agent research simulator. Disclose the current Foundry evaluations, their estimated costs, and the limits of replay-based model provenance. Scripted demos are not LLM results. Do not claim calibrated physical behavior, universal model superiority, or an independently audited benchmark.
