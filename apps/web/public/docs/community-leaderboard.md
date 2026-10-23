# Community Top 10

Innovain's official board and the Community Top 10 are separate artifacts and separate evaluations. Local commands and browser imports never upload or modify either board.

## Current implementation: reviewed contributions

The Community Top 10 uses the three current Mars emergencies: habitat pressure leak, life-support blackout and oxygen shortage. Run each using the local runner and your own model configuration. The current suite uses the canonical initial states and seed metadata 183. It is a small demonstration suite, not a repeated model-quality study. Scripted or human-assisted decisions must be disclosed as such.

1. Complete the three missions; success and failure are eligible, budget-stopped/incomplete runs are not.
2. Review JSON contents before sharing, particularly free-text escalation reasons. Credentials are not needed in a contribution. Keep provider keys in the local environment; do not add `.env` or provider response logs.
3. Copy the three records into `community/runs/<submission>/` and add an entry to `community/submissions.json` in a pull request:

```json
{
  "suite": "mars-operations-v2",
  "entries": [
    {
      "entrant": "your-public-handle",
      "model": "provider/deployment-label",
      "runs": [
        "community/runs/my-entry/repair.json",
        "community/runs/my-entry/power.json",
        "community/runs/my-entry/oxygen.json"
      ]
    }
  ]
}
```

4. Run `pnpm community:build`. A maintainer reviews identity/model labeling and the proposed publication. CI rebuilds the artifact and checks it is committed. Merge and deploy explicitly to publish it.

The generator accepts bounded files under `community/runs`, matches each against its canonical scenario and MCP tool contract, rejects official promotion and manual-browser recordings, and replays all actions. Events, frames, outcome and score must reproduce exactly. It publishes only selected metadata and ranked entries. Public free-text action arguments still require review.

Entries are sorted by mean score across the three emergencies, then by public entrant and model labels to break ties. One entry per entrant/model is allowed; update it with a complete new suite. The top ten are shown with all three replays. The initial board is empty; demo baselines are not presented as community users.

**Reproduced actions do not prove model identity.** A forged score or altered physics is rejected, but an externally generated action sequence can still be scripted or human-assisted. The UI labels entrant/model as self-reported. Official model comparisons require controlled Innovain runs with exact deployments, multiple seeds, repeated attempts and reviewed usage/pricing.

## Next step: hosted matches

The remote session service and automatic submissions are not implemented. See [public arena proposal](public-arena-architecture.md) for a design where provider credentials remain in the user's runner while Innovain owns the simulation and resulting score.

## Maintainer intake and abuse checks

The portable runner produces a ready-to-review folder; `node arena.mjs verify --directory arena-results` checks it locally. Only **Community Top 10** is eligible. Maintain the manifest by merging entries, never replacing unrelated entries.

For every contribution:

1. Review a data-only PR. Reject workflow/code changes bundled with a score submission; use the trusted base-branch verifier, never a submitter-modified verifier. Do not expose any provider keys to PR CI.
2. Verify all three files against the canonical scenarios with `pnpm community:build`. Paths must remain under community/runs even after symlink resolution. Input sizes, call counts and journal sizes are bounded. Scores, frames, events, scenario rules, contract and final outcomes must reproduce. Official flags and incomplete/manual-browser runs are rejected.
3. Review free-text arguments and public labels for abuse, personal information and secrets. Known key patterns are rejected automatically, but arbitrary secrets cannot be recognized reliably. Review is required even when the mechanical check passes.
4. Review duplicate entrants, misleading model claims and repeated spam. Keep one complete entry per entrant/model. Merge and deploy deliberately; merely importing JSON into the browser changes no ranking.

This prevents fabricated scores and altered simulation states. It cannot prove that a real LLM chose those actions, that the claimed model was used, or that the participant did not copy a known winning sequence. A local checksum or participant signature does not prove those claims either. Community remains explicitly self-reported. For stronger future evidence, host canonical matches with short-lived session tokens, quotas, deadlines, server-owned events/scoring and signed results while the user's local runner calls their provider. Even that validates gameplay provenance, not model identity; verified model claims require controlled Innovain inference or trustworthy provider attestations.

There is currently no unauthenticated public upload endpoint, account database or automatic publishing service. This keeps the initial static open-source release simple and prevents arbitrary submissions from writing into the public site.
