import { buildColony, locations, labelNames } from './buildColony';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { ArenaEvent, WorldState } from '@arena/arena-core';

const random = (index: number) => {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};
export function ColonyScene({
  state,
  event,
  events,
  time,
  follow,
}: {
  state: WorldState;
  event?: ArenaEvent;
  events: ArenaEvent[];
  time: number;
  follow: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef({ state, event, events, time, follow });
  const [graphicsError, setGraphicsError] = useState('');
  useEffect(() => {
    latest.current = { state, event, events, time, follow };
  }, [state, event, events, time, follow]);
  useEffect(() => {
    const container = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setGraphicsError(
        'WebGL is unavailable. Enable hardware acceleration to view the 3D colony. Replay telemetry remains available.',
      );
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.prepend(renderer.domElement);
    renderer.domElement.setAttribute(
      'aria-label',
      'Interactive 3D Mars colony with habitats, reactor, solar arrays, and transit connections',
    );
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#a65d40');
    scene.fog = new THREE.FogExp2('#ad7251', 0.009);
    const camera = new THREE.PerspectiveCamera(39, 1, 0.1, 220);
    camera.position.set(39, 29, 42);
    const ambient = new THREE.HemisphereLight('#f4d0a2', '#553324', 2.1);
    scene.add(ambient);
    const sun = new THREE.DirectionalLight('#ffe0b8', 3.2);
    sun.position.set(-30, 42, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -36;
    sun.shadow.camera.right = 36;
    sun.shadow.camera.top = 36;
    sun.shadow.camera.bottom = -36;
    sun.shadow.normalBias = 0.05;
    scene.add(sun);
    const fill = new THREE.DirectionalLight('#99b6c2', 0.9);
    fill.position.set(20, 10, -30);
    scene.add(fill);
    const {
      windows,
      habitats,
      gateA,
      gateB,
      reactorBeacon,
      dust,
      leak,
      leakGeometry,
      leakPositions,
      crewMarkers,
      solarTexture,
    } = buildColony(scene);
    const emergencyLight = new THREE.PointLight('#ff4f2c', 0, 22, 2);
    emergencyLight.position.copy(locations.B!).add(new THREE.Vector3(0, 5, 0));
    scene.add(emergencyLight);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ventRings = (['A', 'B', 'Hub'] as const).map((id) => {
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(4.7, 0.09, 6, 64),
        new THREE.MeshBasicMaterial({
          color: '#ff6e47',
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.copy(locations[id]!).setY(0.5);
      scene.add(ring);
      return { id, ring };
    });
    const labels = Array.from(container.querySelectorAll<HTMLElement>('[data-location]'));
    const resize = new ResizeObserver(() => {
      const width = container.clientWidth;
      const height = container.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    });
    resize.observe(container);
    let animation = 0;
    let last = performance.now();
    let elapsed = 0;
    const target = new THREE.Vector3(0, 0, 0);
    const desiredTarget = new THREE.Vector3(0, 0, 0);
    let angle = 0;
    let dragStart: number | null = null;
    const down = (event: PointerEvent) => {
      dragStart = event.clientX;
      renderer.domElement.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (dragStart !== null) {
        angle += (event.clientX - dragStart) * 0.006;
        dragStart = event.clientX;
      }
    };
    const up = () => {
      dragStart = null;
    };
    renderer.domElement.addEventListener('pointerdown', down);
    renderer.domElement.addEventListener('pointermove', move);
    renderer.domElement.addEventListener('pointerup', up);
    renderer.domElement.addEventListener('pointercancel', up);
    const render = (now: number) => {
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      if (!reducedMotion) elapsed += delta;
      const {
        state: current,
        event: action,
        time: simulationTime,
        follow: cinematic,
        events: worldEvents,
      } = latest.current;
      const name = action?.data.name;
      const catastrophic = current.outcome === 'failure';
      const blackout = current.power < 20;
      const noOxygen = current.oxygenReserve <= 0;
      const ventedHabitat = (['A', 'B', 'Hub'] as const).find(
        (id) => current.habitats[id].externalAirlockOpen,
      );
      const pulse = reducedMotion ? 0.65 : 0.5 + Math.sin(elapsed * 3) * 0.5;
      scene.background = new THREE.Color(
        catastrophic ? '#38201d' : blackout ? '#493a37' : '#a65d40',
      );
      const fog = scene.fog as THREE.FogExp2;
      fog.color.set(catastrophic ? '#58312b' : blackout ? '#5e4941' : '#ad7251');
      fog.density = catastrophic ? 0.017 : 0.009;
      sun.intensity = catastrophic ? 1.0 : blackout ? 1.4 : 3.2;
      ambient.intensity = catastrophic ? 0.65 : blackout ? 0.9 : 2.1;
      fill.intensity = catastrophic ? 0.25 : 0.9;
      const args = action?.data.arguments as Record<string, unknown> | undefined;
      let focus: string = 'Hub';
      if (name === 'activate_backup_power' || name === 'inspect_life_support')
        focus = name === 'activate_backup_power' ? 'power' : 'support';
      else if (args?.habitat) focus = String(args.habitat);
      else if (args?.from) focus = String(args.from);
      desiredTarget
        .copy(
          cinematic && action ? (locations[focus] ?? locations.Hub!) : new THREE.Vector3(0, 0, 0),
        )
        .multiplyScalar(0.45);
      target.lerp(desiredTarget, 1 - Math.exp(-delta * 1.6));
      const orbit = angle + Math.sin(elapsed * 0.06) * 0.035;
      const base = new THREE.Vector3(
        39 * Math.cos(orbit) + 42 * Math.sin(orbit),
        29,
        42 * Math.cos(orbit) - 39 * Math.sin(orbit),
      );
      base.multiplyScalar(Math.max(1, 1.3 / camera.aspect));
      camera.position.lerp(base.add(target), 1 - Math.exp(-delta * 1.4));
      if (catastrophic && ventedHabitat && !reducedMotion) {
        camera.position.x += Math.sin(elapsed * 19) * 0.06;
        camera.position.y += Math.cos(elapsed * 23) * 0.035;
      }
      camera.lookAt(target.clone().add(new THREE.Vector3(0, 0.4, 0)));
      for (const id of ['A', 'B', 'Hub'] as const) {
        const model = habitats[id];
        const value = current.habitats[id];
        const critical = value.pressure < 35 || catastrophic || blackout || noOxygen;
        const warning = (value.pressure < 65 && value.leakRate > 0) || current.oxygenReserve < 15;
        const color = critical ? '#ff4d36' : warning ? '#ffa15a' : '#8cc8b4';
        const material = model.beacon.material as THREE.MeshStandardMaterial;
        material.color.set(color);
        material.emissive.set(color);
        material.emissiveIntensity = critical || warning ? 1.2 + pulse * 1.5 : 0.8;
        const ringMaterial = model.warningRing.material as THREE.MeshBasicMaterial;
        ringMaterial.color.set(color);
        ringMaterial.opacity = warning || critical ? 0.3 + pulse * 0.3 : 0.2;
      }
      for (const [gates, closed] of [
        [gateA, current.habitats.A.isolated || current.habitats.Hub.isolated],
        [gateB, current.habitats.B.isolated || current.habitats.Hub.isolated],
      ] as const)
        for (const gate of gates) {
          (gate.material as THREE.MeshStandardMaterial).color.set(closed ? '#dd5c35' : '#6c9b87');
          gate.scale.y = closed ? 1.1 : 0.35;
        }
      windows.forEach((window) => {
        (window.material as THREE.MeshStandardMaterial).emissiveIntensity = blackout
          ? 0
          : catastrophic
            ? 0.4 + pulse * 0.3
            : 0.75;
        (window.material as THREE.MeshStandardMaterial).color.set(
          blackout ? '#292d2d' : catastrophic ? '#ad4836' : '#b9e5dc',
        );
        (window.material as THREE.MeshStandardMaterial).emissive.set(
          catastrophic ? '#dd3825' : '#5baab6',
        );
      });
      (reactorBeacon.material as THREE.MeshStandardMaterial).emissiveIntensity =
        current.backupActive ? 2 : current.power >= 20 ? 0.7 : 0;
      dust.position.x = (elapsed * 0.22) % 12;
      const leakId =
        ventedHabitat ??
        (['A', 'B', 'Hub'] as const).find((id) => current.habitats[id].leakRate > 0) ??
        'B';
      const leakingHabitat = current.habitats[leakId];
      const leaking =
        leakingHabitat.externalAirlockOpen ||
        (leakingHabitat.leakRate > 0 && !leakingHabitat.isolated);
      leak.position.copy(locations[leakId]!).add(new THREE.Vector3(3.6, 1.1, 2));
      leak.scale.setScalar(leakingHabitat.externalAirlockOpen ? 2.6 : 1);
      (leak.material as THREE.PointsMaterial).size = leakingHabitat.externalAirlockOpen
        ? 0.42
        : 0.12;
      (leak.material as THREE.PointsMaterial).opacity = leakingHabitat.externalAirlockOpen
        ? 0.9
        : 0.45;
      emergencyLight.position
        .copy(locations[ventedHabitat ?? leakId]!)
        .add(new THREE.Vector3(0, 4, 0));
      emergencyLight.intensity =
        catastrophic || blackout || noOxygen || leakingHabitat.pressure < 35 ? 45 + pulse * 35 : 0;
      for (const { id, ring } of ventRings) {
        ring.visible = current.habitats[id].externalAirlockOpen;
        const expansion = reducedMotion ? 0.6 : (elapsed * 0.45) % 1;
        ring.scale.setScalar(0.85 + expansion * 1.5);
        (ring.material as THREE.MeshBasicMaterial).opacity = (1 - expansion) * 0.65;
      }
      leak.visible = leaking;
      for (let index = 0; index < leakPositions.length / 3; index++) {
        const progress =
          (elapsed * (leakingHabitat.externalAirlockOpen ? 1.4 : 0.6) + random(index)) % 1;
        leakPositions[index * 3] = progress * 5;
        leakPositions[index * 3 + 1] = progress * (random(index + 8) * 2 - 0.3);
        leakPositions[index * 3 + 2] = (random(index + 11) - 0.5) * progress * 2;
      }
      leakGeometry.attributes.position!.needsUpdate = true;
      const movement = worldEvents.findLast((event) => event.type === 'crew_moved');
      const progress = movement
        ? Math.min(1, Math.max(0, (simulationTime - movement.time) / 3))
        : 0;
      crewMarkers.forEach((marker, index) => {
        const crew = current.crew[index];
        marker.visible = !!crew && crew.status !== 'lost';
        const moving =
          !!movement &&
          !!crew &&
          crew.location === movement.data.to &&
          crew.id.startsWith(`${movement.data.from}-`);
        const origin =
          locations[moving ? String(movement.data.from) : (crew?.location ?? 'Hub')]!.clone();
        const destination =
          locations[moving ? String(movement.data.to) : (crew?.location ?? 'Hub')]!.clone();
        marker.position.copy(origin.lerp(destination, moving ? progress : 0));
        marker.position.y = 0.85;
        marker.position.x += ((index % 4) - 1.5) * 0.35;
        marker.position.z += Math.floor(index / 4) * 0.35;
      });
      for (const label of labels) {
        const id = label.dataset.location!;
        const point = locations[id]!.clone();
        point.y = id === 'power' ? 9 : id === 'solar' ? 3 : 6.6;
        point.project(camera);
        label.style.left = `${(point.x * 0.5 + 0.5) * container.clientWidth}px`;
        label.style.top = `${(-point.y * 0.5 + 0.5) * container.clientHeight}px`;
        label.style.opacity = point.z < 1 ? '1' : '0';
      }
      scene.fog = scene.fog ?? new THREE.FogExp2('#ad7251', 0.009);
      renderer.render(scene, camera);
      animation = requestAnimationFrame(render);
    };
    animation = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animation);
      resize.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down);
      renderer.domElement.removeEventListener('pointermove', move);
      renderer.domElement.removeEventListener('pointerup', up);
      renderer.domElement.removeEventListener('pointercancel', up);
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (
          object instanceof THREE.Mesh ||
          object instanceof THREE.Points ||
          object instanceof THREE.LineSegments
        ) {
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            materials.add(material);
        }
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      solarTexture.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);
  return (
    <div className="scene-host" ref={host}>
      {Object.entries(labelNames).map(([id, name]) => (
        <div
          key={id}
          data-location={id}
          className={`building-label ${id === 'A' || id === 'B' ? 'habitat-b' : ''} ${(id === 'A' || id === 'B') && state.habitats[id].isolated ? 'isolated' : ''}`}
        >
          <span className="label-pin" />
          {name}
          {(id === 'A' || id === 'B') && state.habitats[id].leakRate > 0 && (
            <small>
              {state.habitats[id].isolated
                ? 'ISOLATED'
                : state.habitats[id].pressure < 35
                  ? 'CRITICAL'
                  : 'PRESSURE LEAK'}
            </small>
          )}
        </div>
      ))}
      {graphicsError && (
        <div className="graphics-error" role="alert">
          {graphicsError}
        </div>
      )}
      <div className="scene-vignette" />
      {(state.outcome === 'failure' || state.power < 20 || state.oxygenReserve <= 0) && (
        <div
          className={`disaster-overlay ${state.outcome === 'failure' ? 'terminal' : ''}`}
          aria-label="Recorded emergency effects"
        >
          <span>
            {state.power < 20
              ? 'POWER GRID OFFLINE'
              : state.oxygenReserve <= 0
                ? 'OXYGEN RESERVE EXHAUSTED'
                : Object.values(state.habitats).some((habitat) => habitat.externalAirlockOpen)
                  ? 'CATASTROPHIC DECOMPRESSION'
                  : 'MISSION CRITICAL FAILURE'}
          </span>
        </div>
      )}
    </div>
  );
}
