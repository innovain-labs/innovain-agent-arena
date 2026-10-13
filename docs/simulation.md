# Mars simulation semantics

This is a stylized incident model, not calibrated physics. Pressure is expressed as normalized kPa in a 0–100 range; reserves and power use percentage-like units. State is serialized without class instances.

## Step order

1. Record `tool_called`.
2. Validate domain preconditions and apply the atomic action or record rejection.
3. Record an action snapshot. Catastrophic airlocks update crew/outcome immediately.
4. Advance the tool's integer-second latency, stopping at a terminal outcome.
5. At each tick: apply timed hazards, consume backup fuel, update pressure and oxygen, update crew, evaluate failure before success, capture a snapshot.
6. Build observations from resulting telemetry, record `tool_result`, capture a final action snapshot.

Status/inspection take 1 second; isolation and assistance 2; oxygen routing and movement 3; backup 2; external airlock 1. Valid protocol calls rejected by domain rules still take latency. SDK schema validation failures never enter the simulator. Mission completion freezes simulation time; later calls return an error without mutating state.

## Systems

- Pressure falls by scenario leak rate. Isolation multiplies the internal leak rate by a scenario factor; it does not repair it.
- Open external airlocks set pressure to zero immediately and keep it there.
- Life support requires power of at least 20 and remaining oxygen. Rerouting supplies up to 6 pressure units per second and consumes shared reserves.
- Shared oxygen consumption includes baseline use, supplied oxygen, and non-isolated leaks. Isolation eliminates shared leak draw while local pressure can still fall.
- Crew below safe pressure become at risk; crew at or below lethal pressure are irreversibly lost.
- Transit requires a declared undirected path, open isolation gates, closed external airlocks, and safe current and forecast pressure at both ends. All surviving crew at the source move atomically; the viewer animates the recorded three-second transfer. This is not a continuous transit hazard model.
- Backup increases available power, consumes fuel every tick, and loses its boost when fuel is exhausted. Activating it with healthy primary power is recorded as unnecessary danger.
- Human assistance records a request; no human operator responds in v1. Time continues. This is an observable escalation outcome, not a free rescue tool.

## Objectives and failures

Scenario objectives require protected crew, target pressure, containment if configured, closed external airlock, operational support, and enough routed flow to offset the remaining leak. Success means **stabilized at this instant**, not a repaired habitat or indefinite survival. Post-mission simulation freezes.

Failure checks can include any crew lost, empty oxygen reserves, and a configured deadline; all crew lost always fails. Failure takes precedence over success on the same tick.

## Scoring

Weights total 100: crew survival 40, success 25, safety 15, oxygen efficiency 10, and stabilization speed 10. Safety loses configured points per dangerous action and two points per crew death. Efficiency compares final oxygen with initial oxygen. Speed decays linearly with simulation time relative to the deadline. Score is computed by the trusted host from state/events only and shown to spectators at mission end.

## Determinism

No wall clock, RNG, or provider calls enter rules. Tick order and iteration order are fixed; values are rounded to three decimals. Identical declarative scenarios and tool calls produce identical state, event journal, snapshots, outcome, and score. Cosmetic particles do not feed back into rules.
