# Public site

The web app is organized around hash routes so the static Vite preview works without a server rewrite:

- `#/` — the recorded 3D Arena and replay controls
- `#/leaderboard` — Innovain model evaluations and Community Top 10
- `#/research` — model evaluation methodology and adaptive research metrics
- `#/scenarios` — the three playable Mars emergencies and community ideas
- `#/try-your-model` — local runner command and local replay import
- `#/about` — project identity and contribution boundaries

All public copy is English. The viewer never calls a model provider. It fetches bundled artifacts and reads a user-selected `run.json` through the browser File API. Imported files remain on the user's machine.

GitHub navigation is intentionally omitted until a real repository remote is configured. The app must never invent a repository URL.
