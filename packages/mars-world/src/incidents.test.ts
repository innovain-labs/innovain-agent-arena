import { readFileSync } from 'node:fs';
import { parse } from 'yaml';
import { describe, expect, test } from 'vitest';
import { scriptedPlanFor } from '@arena/agent-runner';
import { MarsSimulation, marsIncidents, parseScenario } from './index';

function worldFor(slug: string) {
  return new MarsSimulation(
    parseScenario(parse(readFileSync(`scenarios/mars/${slug}/scenario.yaml`, 'utf8'))),
  );
}

describe('additional Mars emergencies', () => {
  test.each(marsIncidents.slice(1))(
    '$title has reproducible rescue and failure paths',
    (incident) => {
      for (const unsafe of [false, true]) {
        const world = worldFor(incident.slug);
        const repeated = worldFor(incident.slug);
        for (const call of scriptedPlanFor(incident.id, unsafe)) {
          const result = world.execute(call);
          repeated.execute(call);
          if (!unsafe) expect(result.ok).toBe(true);
        }
        expect(world.state.outcome).toBe(unsafe ? 'failure' : 'success');
        expect(world.journal.frames).toEqual(repeated.journal.frames);
        expect(world.journal.events).toEqual(repeated.journal.events);
      }
    },
  );

  test('blackout rejects oxygen routing until backup power is restored', () => {
    const world = worldFor('power-blackout');
    expect(world.execute({ name: 'reroute_oxygen', arguments: { habitat: 'A', flow: 4 } }).ok).toBe(
      false,
    );
    expect(world.state.habitats.A.oxygenFlow).toBe(0);
    expect(world.execute({ name: 'activate_backup_power', arguments: {} }).ok).toBe(true);
    expect(world.execute({ name: 'reroute_oxygen', arguments: { habitat: 'A', flow: 4 } }).ok).toBe(
      true,
    );
    expect(world.state.backupFuel).toBeLessThan(35);
  });

  test('excess supply exhausts the shared reserve without falsely declaring crew deaths', () => {
    const world = worldFor('oxygen-shortage');
    for (const call of scriptedPlanFor('mars-oxygen-shortage-003', true)) world.execute(call);
    expect(world.state.oxygenReserve).toBe(0);
    expect(world.state.outcomeReason).toBe('Oxygen reserves depleted.');
    expect(world.state.crew.every((crew) => crew.status !== 'lost')).toBe(true);
  });

  test('conserving oxygen protects everyone with a low supply flow', () => {
    const world = worldFor('oxygen-shortage');
    for (const call of scriptedPlanFor('mars-oxygen-shortage-003')) world.execute(call);
    expect(world.state.oxygenReserve).toBeGreaterThan(5);
    expect(world.state.habitats.B.oxygenFlow).toBe(1);
    expect(world.state.habitats.B.isolated).toBe(true);
    expect(world.state.crew.every((crew) => crew.status === 'safe')).toBe(true);
  });
});
