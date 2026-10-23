import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, test } from 'vitest';
import { MarsSimulation, parseScenario } from './index';
const scenario = (slug = 'habitat-b-leak-v2') =>
  parseScenario(parse(readFileSync(`scenarios/mars/${slug}/scenario.yaml`, 'utf8')));
describe('Mars operations v2', () => {
  test('repair requires evacuation, isolation and power; sealing does not refill pressure', () => {
    const world = new MarsSimulation(scenario());
    expect(world.execute({ name: 'repair_leak', arguments: { habitat: 'B' } }).ok).toBe(false);
    world.execute({ name: 'move_crew', arguments: { from: 'B', to: 'Hub' } });
    expect(world.execute({ name: 'repair_leak', arguments: { habitat: 'B' } }).ok).toBe(false);
    world.execute({ name: 'isolate_habitat', arguments: { habitat: 'B' } });
    const pressure = world.state.habitats.B.pressure;
    expect(world.execute({ name: 'repair_leak', arguments: { habitat: 'B' } }).ok).toBe(true);
    expect(world.state.habitats.B.leakRate).toBe(0);
    expect(world.state.habitats.B.pressure).toBe(pressure);
    expect(world.state.outcome).not.toBe('success');
  });
  test('power rerouting restores support once, without burning backup fuel', () => {
    const world = new MarsSimulation(scenario('power-blackout-v2'));
    expect(world.execute({ name: 'reroute_power', arguments: {} }).ok).toBe(true);
    expect(world.state.power).toBe(22);
    expect(world.state.backupFuel).toBe(35);
    expect(world.execute({ name: 'reroute_power', arguments: {} }).ok).toBe(false);
    expect(world.state.power).toBe(22);
    expect(world.execute({ name: 'reroute_oxygen', arguments: { habitat: 'A', flow: 4 } }).ok).toBe(
      true,
    );
  });
  test('conservation reduces only baseline consumption, is observable and reversible', () => {
    const a = new MarsSimulation(scenario('oxygen-shortage-v2'));
    const b = new MarsSimulation(scenario('oxygen-shortage-v2'));
    a.execute({ name: 'set_consumption_mode', arguments: { mode: 'emergency' } });
    b.advance(2);
    expect(a.state.oxygenReserve - b.state.oxygenReserve).toBeCloseTo(0.9);
    expect(a.state.habitats.B.pressure).toBe(b.state.habitats.B.pressure);
    const result = a.execute({ name: 'inspect_life_support', arguments: {} });
    expect(result.observation?.consumptionMode).toBe('emergency');
    expect(a.execute({ name: 'set_consumption_mode', arguments: { mode: 'invalid' } }).ok).toBe(
      false,
    );
    expect(a.execute({ name: 'set_consumption_mode', arguments: { mode: 'normal' } }).ok).toBe(
      true,
    );
  });
  test('v1 cannot execute v2 interventions or declare extended objectives', () => {
    const legacy = scenario('habitat-b-leak');
    const world = new MarsSimulation(legacy);
    expect(world.execute({ name: 'reroute_power', arguments: {} }).ok).toBe(false);
    expect(world.state.power).toBe(84);
    expect(world.state.time).toBe(0);
    expect(() =>
      parseScenario({ ...legacy, objectives: { ...legacy.objectives, requireRepair: true } }),
    ).toThrow('Extended objectives');
  });
});
