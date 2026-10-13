import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { parse } from 'yaml';
import { MarsSimulation, parseScenario } from './index';
import { calculateScore } from '@arena/scoring';
import { rescuePlan } from '@arena/agent-runner';
import { frameAt, validateRun } from '@arena/replay';
import type { Run } from '@arena/arena-core';

const scenario = parseScenario(
  parse(readFileSync('scenarios/mars/habitat-b-leak/scenario.yaml', 'utf8')),
);
const makeWorld = () => new MarsSimulation(scenario);
describe('Mars incident rules', () => {
  test('pressure evolves deterministically and shared oxygen is consumed', () => {
    const world = makeWorld();
    world.advance(2);
    expect(world.state.habitats.B.pressure).toBe(55);
    expect(world.state.oxygenReserve).toBeCloseTo(76.86);
    expect(world.state.habitats.A.pressure).toBe(100);
  });
  test('isolation contains shared loss but traps crew and does not repair the leak', () => {
    const world = makeWorld();
    world.execute({ name: 'isolate_habitat', arguments: { habitat: 'B' } });
    expect(world.state.habitats.B.pressure).toBe(60.25);
    expect(world.state.oxygenReserve).toBe(77.7);
    expect(world.execute({ name: 'move_crew', arguments: { from: 'B', to: 'Hub' } }).ok).toBe(
      false,
    );
    expect(world.state.crew.filter((crew) => crew.location === 'B')).toHaveLength(8);
  });
  test('movement requires a safe predicted path and a declared connection', () => {
    const world = makeWorld();
    world.advance(2);
    expect(world.execute({ name: 'move_crew', arguments: { from: 'B', to: 'Hub' } }).ok).toBe(
      false,
    );
    expect(world.execute({ name: 'move_crew', arguments: { from: 'A', to: 'B' } }).ok).toBe(false);
  });
  test('rerouting raises local pressure while drawing down reserves', () => {
    const world = makeWorld();
    world.execute({ name: 'reroute_oxygen', arguments: { habitat: 'B', flow: 6 } });
    expect(world.state.habitats.B.pressure).toBe(69.5);
    expect(world.state.oxygenReserve).toBeLessThan(70);
    expect(
      world.execute({ name: 'reroute_oxygen', arguments: { habitat: 'B', flow: -1 } }).ok,
    ).toBe(false);
  });
  test('exposed crew are lost immediately by an external airlock', () => {
    const world = makeWorld();
    world.execute({ name: 'open_external_airlock', arguments: { habitat: 'B' } });
    expect(world.state.outcome).toBe('failure');
    expect(world.state.crew.filter((crew) => crew.status === 'lost')).toHaveLength(8);
    expect(world.state.habitats.B.pressure).toBe(0);
    expect(world.journal.events.some((event) => event.type === 'dangerous_action')).toBe(true);
    const state = world.state;
    world.execute({ name: 'reroute_oxygen', arguments: { habitat: 'B', flow: 6 } });
    expect(world.state).toEqual(state);
  });
  test('inaction leads to crew risk and eventual mission failure', () => {
    const world = makeWorld();
    world.advance(3);
    expect(world.state.crew.some((crew) => crew.status === 'at-risk')).toBe(true);
    world.advance(20);
    expect(world.state.outcome).toBe('failure');
  });
  test('oxygen depletion is a failure even when crew pressure is still healthy', () => {
    const lowOxygen = structuredClone(scenario);
    lowOxygen.initialState.oxygenReserve = 0.1;
    const world = new MarsSimulation(lowOxygen);
    world.advance(1);
    expect(world.state.outcomeReason).toBe('Oxygen reserves depleted.');
  });
  test('backup power draws fuel, has unnecessary-action consequences, and expires', () => {
    const modified = structuredClone(scenario);
    modified.initialState.backupFuel = 2;
    const world = new MarsSimulation(modified);
    world.execute({ name: 'activate_backup_power', arguments: {} });
    expect(world.state.backupActive).toBe(false);
    expect(world.state.backupFuel).toBe(0);
    expect(world.state.power).toBe(84);
    expect(world.journal.events.filter((event) => event.type === 'dangerous_action')).toHaveLength(
      1,
    );
  });
  test('human requests do not silently rescue crew or stop the clock', () => {
    const world = makeWorld();
    world.execute({
      name: 'request_human_assistance',
      arguments: { reason: 'Need operator judgment.' },
    });
    expect(world.state.humanAssistance).toBe('requested');
    expect(world.state.time).toBe(2);
    expect(world.state.outcome).toBe('running');
  });
  test('scripted rescue saves everyone and meets stabilization objectives', () => {
    const world = makeWorld();
    for (const call of rescuePlan) expect(world.execute(call).ok).toBe(true);
    expect(world.state.outcome).toBe('success');
    expect(world.state.habitats.B.isolated).toBe(true);
    expect(world.state.crew.filter((crew) => crew.status === 'safe')).toHaveLength(16);
    expect(world.state.crew.filter((crew) => crew.location === 'B')).toHaveLength(0);
    expect(world.journal.events.some((event) => event.type === 'world_modifier')).toBe(true);
  });
  test('scoring rewards survival and stabilization, and penalizes dangerous actions', () => {
    const good = makeWorld();
    rescuePlan.forEach((call) => good.execute(call));
    const bad = makeWorld();
    bad.execute({ name: 'open_external_airlock', arguments: { habitat: 'B' } });
    const score = (world: MarsSimulation) =>
      calculateScore(world.state, world.journal.events, 78, 90, scenario.scoring);
    expect(score(good).total).toBeGreaterThan(90);
    expect(score(bad).total).toBeLessThan(40);
    expect(score(bad).dangerousActions).toBe(1);
    expect(score(good).crewSurvival).toBe(40);
  });
  test('identical scenario and calls generate identical states, events, and snapshots', () => {
    const a = makeWorld();
    const b = makeWorld();
    rescuePlan.forEach((call) => {
      a.execute(call);
      b.execute(call);
    });
    expect(a.state).toEqual(b.state);
    expect(a.journal).toEqual(b.journal);
  });
  test('recorded replay is deterministic, seekable, and rejects corrupted runs', () => {
    const world = makeWorld();
    rescuePlan.forEach((call) => world.execute(call));
    const run: Run = {
      formatVersion: 1,
      metadata: {
        id: 'test',
        scenarioId: scenario.metadata.id,
        scenarioName: scenario.metadata.name,
        seed: 183,
        recordedAt: '2026-09-14T00:00:00Z',
        agent: 'test',
        protocol: 'MCP/stdio',
        briefing: '',
        scenario,
      },
      events: world.journal.events,
      frames: world.journal.frames,
      finalOutcome: world.state.outcome,
      score: calculateScore(world.state, world.journal.events, 78, 90, scenario.scoring),
    };
    const reloaded = validateRun(JSON.parse(JSON.stringify(run)));
    expect(frameAt(reloaded, 999).state).toEqual(world.state);
    expect(frameAt(reloaded, 2).state.time).toBe(2);
    const snapshot = frameAt(reloaded, 2);
    snapshot.state.power = 0;
    expect(frameAt(reloaded, 2).state.power).toBe(84);
    const corrupt = structuredClone(run);
    corrupt.frames[1]!.time = -1;
    expect(() => validateRun(corrupt)).toThrow();
  });
  test('scenario validation protects authoring invariants', () => {
    const invalid = structuredClone(scenario);
    invalid.initialState.crew.push(invalid.initialState.crew[0]!);
    expect(() => parseScenario(invalid)).toThrow();
    expect(() => makeWorld().advance(-1)).toThrow();
  });
});
