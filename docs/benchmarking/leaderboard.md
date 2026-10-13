# Official leaderboard

`benchmarks/mars-standard-v1/leaderboard.json` is a reproducible artifact generated from verified official model summaries. Ranking is calculated from documented weights for mission success, crew survival, safety, and efficiency. Positions are derived at generation time; they are never hardcoded.

Only results marked `official: true`, `verified: true`, and `source: "official"` are eligible. Community runs can keep their own artifacts and replays, but they cannot alter the official board.

Each entry includes the exact model/version id, provider, benchmark version, evaluation date, completed runs, success, survival, safety, efficiency, dangerous and unnecessary actions, average tool calls, token usage, total cost, average run cost, cost per successful mission when defined, overall score, and a representative replay reference.

The web viewer consumes this static artifact. Visitors watch stored replays and cause no new model inference, so visitor inference cost remains `$0.00`.

The board means performance on the specified benchmark version. It is not a universal claim about the best AI model.
