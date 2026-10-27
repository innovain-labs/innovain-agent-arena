# Public site

The web app is organized around hash routes so the static Vite preview works without a server rewrite:

- `#/` — the recorded 3D Arena and replay controls
- `#/leaderboard` — Innovain model evaluations and Community Top 10
- `#/research` — model evaluation methodology and adaptive research metrics
- `#/scenarios` — the three playable Mars emergencies and community ideas
- `#/try-your-model` — local runner command and local replay import
- `#/about` — project identity and contribution boundaries
- `#/privacy` — viewer data and privacy practices

All public copy is English. The viewer never calls a model provider. It fetches bundled artifacts and reads a user-selected `run.json` through the browser File API. Imported files remain on the user's machine.

The header links to Innovain and the general contact address. The GitHub source link is injected only through `VITE_PUBLIC_REPOSITORY_URL` after the repository is public; until then, the About page says the source release is in preparation. Do not point the public viewer at a private repository.

The Privacy page explains that the viewer plays bundled replays, does not accept provider keys, and reads user-selected replay files locally. The site does not send those files to Innovain. Azure may process technical request/security information needed to deliver and protect the site. GitHub and model providers have separate data practices.

The Azure default hostname can serve the public demo before a custom domain is available. Innovain's launch order requires `arena.innovain.ai` to be configured and HTTPS verified before the GitHub source repository becomes public. Only then should the public repository URL be added to the viewer build.
