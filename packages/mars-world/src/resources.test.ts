import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { expect, test } from 'vitest';
import { MarsSimulation, parseScenario } from './index';

const scenario = () =>
  parseScenario(parse(readFileSync('scenarios/mars/habitat-b-leak/scenario.yaml', 'utf8')));
test('a scenario beginning with lethal crew pressure is terminal immediately', () => {
  const config = scenario();
  config.initialState.habitats.B.pressure = 20;
  const world = new MarsSimulation(config);
  expect(world.state.outcome).toBe('failure');
  expect(world.journal.events[0]!.type).toBe('incident_started');
  expect(world.execute({ name: 'reroute_oxygen', arguments: { habitat: 'B', flow: 6 } }).ok).toBe(
    false,
  );
  expect(world.state.time).toBe(0);
});
test('simultaneous supplies cannot create oxygen after reserves are spent', () => {
  const config = scenario();
  config.initialState.oxygenReserve = 1;
  for (const habitat of Object.values(config.initialState.habitats)) {
    habitat.pressure = 50;
    habitat.oxygenFlow = 6;
    habitat.leakRate = 0;
  }
  const world = new MarsSimulation(config);
  world.advance(1);
  const gain = Object.values(world.state.habitats).reduce(
    (total, habitat) => total + habitat.pressure - 50,
    0,
  );
  expect(gain * 0.45).toBeLessThanOrEqual(0.851);
  expect(world.state.oxygenReserve).toBe(0);
  expect(world.state.outcome).toBe('failure');
});
test('transit does not depend on oxygen that will be unavailable during latency', () => {
  const config = scenario();
  config.initialState.oxygenReserve = 4;
  config.initialState.habitats.B.pressure = 55;
  config.initialState.habitats.B.oxygenFlow = 6;
  const world = new MarsSimulation(config);
  expect(world.execute({ name: 'move_crew', arguments: { from: 'B', to: 'Hub' } }).ok).toBe(false);
});
test('declared time limit fails when pressure remains safe but containment is unfinished', () => {
  const config = scenario();
  config.modifiers.maximumTime = 2;
  config.initialState.habitats.B.leakRate = 0;
  const world = new MarsSimulation(config);
  world.advance(2);
  expect(world.state.outcomeReason).toBe('Stabilization deadline exceeded.');
});
