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
