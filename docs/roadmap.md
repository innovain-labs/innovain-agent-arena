# Initial release roadmap

## Prepared locally for 0.1.0

- Three Mars emergency types: pressure leak, life-support blackout, and critical oxygen shortage.
- Six real MCP stdio demo recordings, each with rescue and failure paths.
- Incident selection, public briefings, replay, and state-driven catastrophic visual effects.
- Local scripted, Ollama, OpenAI, and compatible-provider runs; optional local pricing.
- Per-request token/cost preflight checks, bounded request timeouts, and budget-stop replays.
- Clearly disclosed scripted benchmark baselines; no published real LLM comparisons yet.
- Apache-2.0, contributor guidance, security guidance, issue/PR templates, dependency updates, and CI.

## Before public release

1. Create an Innovain GitHub organization using individual personal accounts; choose the available organization/repository name.
2. Review the first commit contents and the use/distribution of Innovain brand assets.
3. Run a controlled real-model experiment with owner-supplied local credentials. Record the exact deployment/configuration, repeated attempts, and limitations; do not expose credentials.
4. Run CI from a clean Linux checkout, configure private security/conduct reporting, and enable appropriate repository protections.
5. Enable the real GitHub URL in the viewer after a remote exists. Validate the optional static demo deployment.
6. Publish an experimental 0.1.0 release with known limitations and reproducibility commands.

## Next milestones

- A controlled real-provider adapter for the official benchmark, with repeated runs and reviewed artifacts.
- More incident families in a separately versioned benchmark. Existing `mars-standard-v1` remains the Incident 001 suite.
- A concrete second world, such as a datacenter, to identify reusable contracts without speculative abstractions.
- Community scenario templates and clearer authoring ergonomics.
- Automated browser regression checks and low-end GPU performance work.
