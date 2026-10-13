# Recording and replay

Run format 1 stores metadata, the scenario definition, public briefing, deterministic seed, provenance timestamp, MCP protocol/agent label, ordered events, complete frames, final outcome, and scoring. The canonical example timestamp is fixed so regeneration has no wall-clock diff. The seed is reserved metadata; v1 rules do not use randomness.

Six recordings (`example-incident-001/002/003.json` and `unsafe-incident-001/002/003.json`) are generated through real MCP stdio sessions. They are copied to `apps/web/public/runs/`. CI checks byte-for-byte regeneration and matching viewer copies.

Events carry sequence, simulation time, type, English explanation, and structured data. Tool-call events contain names/arguments; result events contain authoritative results and permitted observations. World events cover resource changes, warnings, movement, isolation, power hazards, danger, and outcomes.

Frames capture state after every tick and atomic action phase. Multiple frames can share a time. `frameAt` uses binary search to return the last frame at or before the requested time, with a clone to prevent viewer mutation. The event feed uses the frame's event sequence to avoid exposing future events at the same time. Float playback time is cosmetic; state changes remain discrete snapshots.

The browser can play, pause, restart, seek, select speeds, compare recordings, or import JSON locally (10 MB limit). Schema and ordering checks reject malformed recordings. Uploads are read entirely inside the browser; no server receives the file. A recording is observer-visible data, not an agent input or cryptographically authenticated research artifact.

Camera focus follows relevant MCP calls, oxygen leak particles respond to containment, gates close on isolation, and crew markers interpolate movement during recorded latency. Rendering animation never changes simulation state. Full score and outcome appear only at the terminal frame.

Compatibility: format version 1 is explicit. Engine evolution can preserve historical playback because frames contain full state. New world contracts require a format/version migration or a dedicated decoder, not silent reinterpretation.

Catastrophic visuals follow actual recorded consequences: external airlocks intensify vent particles, emergency rings, red lights, and subtle camera shake; power loss darkens the colony; reserve depletion triggers oxygen alerts. Generic failures do not invent explosions or crew deaths. Terminal outcomes freeze domain time while ambient effects continue. Reduced-motion preferences disable shake and screen glow. Seeking/restarting restores visuals from the selected snapshot.
