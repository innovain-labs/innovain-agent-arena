import { useRef, useState } from 'react';
import type { Run, ToolCall } from '@arena/arena-core';
import { MarsSimulation, type MarsScenario } from '@arena/mars-world';
import { calculateScore } from '@arena/scoring';

const core = [
  'get_colony_status',
  'inspect_habitat',
  'inspect_life_support',
  'isolate_habitat',
  'reroute_oxygen',
  'activate_backup_power',
  'move_crew',
  'open_external_airlock',
  'request_human_assistance',
];
export function PracticePanel({
  scenario,
  source,
  onRun,
}: {
  scenario: MarsScenario;
  source: Run;
  onRun: (run: Run) => void;
}) {
  const simulation = useRef<MarsSimulation | null>(null);
  const [tool, setTool] = useState('get_colony_status');
  const [habitat, setHabitat] = useState('B');
  const [destination, setDestination] = useState('Hub');
  const [flow, setFlow] = useState(1);
  const [mode, setMode] = useState('emergency');
  const [feedback, setFeedback] = useState(
    'Start a practice mission, then execute a tool. Every action advances the incident clock.',
  );
  const [ended, setEnded] = useState(false);
  const tools =
    scenario.rulesVersion === 2
      ? [...core, 'repair_leak', 'reroute_power', 'set_consumption_mode']
      : core;
  const publish = (world: MarsSimulation) => {
    const run: Run = {
      formatVersion: 1,
      metadata: {
        ...source.metadata,
        id: 'manual-practice',
        agent: 'You / manual practice',
        model: undefined,
        usage: undefined,
        cost: undefined,
        benchmarkId: undefined,
        benchmarkVersion: undefined,
        official: false,
        protocol: 'browser/manual',
        scenario,
        toolContractVersion: world.toolContractVersion,
      },
      events: world.journal.events,
      frames: world.journal.frames,
      finalOutcome: world.state.outcome,
      score: calculateScore(
        world.state,
        world.journal.events,
        scenario.initialState.oxygenReserve,
        scenario.modifiers.maximumTime,
        scenario.scoring,
      ),
    };
    setEnded(world.state.outcome !== 'running');
    onRun(run);
  };
  return (
    <details className="practice-panel">
      <summary>
        Take the controls <span>MANUAL PRACTICE · NO KEY REQUIRED</span>
      </summary>
      <p>
        Try the same simulation rules in your browser and watch the colony respond in 3D. This is
        human practice, with no MCP connection or AI inference, and is ineligible for either
        leaderboard.
      </p>
      <div className="practice-controls">
        <button
          className="watch-button"
          onClick={() => {
            const world = new MarsSimulation(scenario);
            simulation.current = world;
            setFeedback('Mission started. Inspect before intervening.');
            publish(world);
          }}
        >
          Start / reset practice
        </button>
        <label>
          Tool
          <select aria-label="Practice tool" value={tool} onChange={(e) => setTool(e.target.value)}>
            {tools.map((name) => (
              <option key={name}>{name}</option>
            ))}
          </select>
        </label>
        {[
          'inspect_habitat',
          'isolate_habitat',
          'reroute_oxygen',
          'repair_leak',
          'open_external_airlock',
          'move_crew',
        ].includes(tool) && (
          <label>
            {tool === 'move_crew' ? 'From' : 'Habitat'}
            <select value={habitat} onChange={(e) => setHabitat(e.target.value)}>
              {['A', 'B', 'Hub'].map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
        )}
        {tool === 'move_crew' && (
          <label>
            To
            <select value={destination} onChange={(e) => setDestination(e.target.value)}>
              {['A', 'B', 'Hub'].map((id) => (
                <option key={id}>{id}</option>
              ))}
            </select>
          </label>
        )}
        {tool === 'reroute_oxygen' && (
          <label>
            Flow
            <input
              type="number"
              min="0.1"
              max="6"
              step="0.1"
              value={flow}
              onChange={(e) => setFlow(Number(e.target.value))}
            />
          </label>
        )}
        {tool === 'set_consumption_mode' && (
          <label>
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option>emergency</option>
              <option>normal</option>
            </select>
          </label>
        )}
        <button
          className="watch-button"
          disabled={
            source.metadata.protocol !== 'browser/manual' ||
            !simulation.current ||
            ended ||
            (tool === 'reroute_oxygen' && (!Number.isFinite(flow) || flow <= 0 || flow > 6))
          }
          onClick={() => {
            const world = simulation.current;
            if (!world) return;
            const args: ToolCall['arguments'] =
              tool === 'move_crew'
                ? { from: habitat, to: destination }
                : tool === 'set_consumption_mode'
                  ? { mode }
                  : tool === 'request_human_assistance'
                    ? { reason: 'Manual practice escalation' }
                    : [
                          'inspect_habitat',
                          'isolate_habitat',
                          'repair_leak',
                          'open_external_airlock',
                        ].includes(tool)
                      ? { habitat }
                      : tool === 'reroute_oxygen'
                        ? { habitat, flow }
                        : {};
            const result = world.execute({ name: tool, arguments: args });
            setFeedback(JSON.stringify(result, null, 2));
            publish(world);
          }}
        >
          Execute action
        </button>
      </div>
      {tool === 'open_external_airlock' && (
        <p className="red">
          Opening an external airlock immediately vents pressure and can kill occupants.
        </p>
      )}
      <pre className="practice-feedback" role="status">
        {feedback}
      </pre>
    </details>
  );
}
