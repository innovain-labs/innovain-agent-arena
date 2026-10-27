# Public site

The web app is organized around hash routes so the static Vite preview works without a server rewrite:

- `#/` — the recorded 3D Arena and replay controls
- `#/leaderboard` — Innovain model evaluations and Community Top 10
- `#/research` — model evaluation methodology and adaptive research metrics
- `#/scenarios` — the three playable Mars emergencies and community ideas
- `#/try-your-model` — local runner command and local replay import
- `#/about` — project identity and contribution boundaries

All public copy is English. The viewer never calls a model provider. It fetches bundled artifacts and reads a user-selected `run.json` through the browser File API. Imported files remain on the user's machine.

The header links to Innovain, the configured project repository, and the general contact address. The About page repeats the company website and email so visitors can identify the project steward and reach the team.

## Azure App Service deployment

The viewer is a static Vite build. `pnpm build` creates `apps/web/dist`; `apps/web/server.mjs` serves that directory using Node's built-in HTTP and filesystem modules, binds to `0.0.0.0`, and honors the platform-provided `PORT`. It needs no model credentials, database, or runtime dependencies. For Linux App Service, deploy a ZIP whose root contains `server.mjs` and the built `dist/` directory, select the Node 24 LTS stack, and set the startup command to `node server.mjs`. Require HTTPS at the App Service layer. Keep the deployment ZIP and build output out of Git.

The Azure default hostname works without custom DNS. To use `arena.innovain.ai`, first map the subdomain to the app's `azurewebsites.net` hostname and add App Service's `asuid` verification TXT record at the DNS provider; then bind the hostname and issue an App Service managed certificate. DNS and certificate binding are separate from the GitHub repository's visibility.
