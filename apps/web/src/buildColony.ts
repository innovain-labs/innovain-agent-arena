import * as THREE from 'three';
import type { HabitatId } from '@arena/arena-core';
export const locations: Record<string, THREE.Vector3> = {
  A: new THREE.Vector3(-10, 0, 1),
  B: new THREE.Vector3(10, 0, 3),
  Hub: new THREE.Vector3(0, 0, -5),
  support: new THREE.Vector3(-9, 0, -12),
  power: new THREE.Vector3(11, 0, -12),
  solar: new THREE.Vector3(-14, 0, 13),
};
export const labelNames: Record<string, string> = {
  A: 'HABITAT A',
  B: 'HABITAT B',
  Hub: 'CENTRAL HUB',
  support: 'LIFE SUPPORT',
  power: 'REACTOR',
  solar: 'SOLAR ARRAY',
};
const paint = (color: THREE.ColorRepresentation, metalness = 0.25) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness });
const random = (index: number) => {
  const value = Math.sin(index * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
};
function mesh(
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  parent: THREE.Object3D,
  position: [number, number, number] = [0, 0, 0],
) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
function cylinder(
  radius: number,
  height: number,
  material: THREE.Material,
  parent: THREE.Object3D,
  y = 0,
  sides = 24,
) {
  return mesh(new THREE.CylinderGeometry(radius, radius, height, sides), material, parent, [
    0,
    y,
    0,
  ]);
}

function buildHabitat(id: HabitatId, scene: THREE.Scene, lights: THREE.Mesh[]) {
  const group = new THREE.Group();
  group.position.copy(locations[id]!);
  scene.add(group);
  const hull = paint('#d3c6ae');
  const trim = paint('#4e5555');
  const orange = paint('#d16435');
  const radius = id === 'Hub' ? 4.5 : 3.7;
  cylinder(radius + 0.6, 0.35, paint('#595a50'), group, 0.2, 6);
  cylinder(radius, 1.65, hull, group, 1.1);
  cylinder(radius + 0.12, 0.15, orange, group, 1.55);
  const glass = new THREE.MeshStandardMaterial({
    color: '#9cbdc2',
    roughness: 0.2,
    metalness: 0.55,
    transparent: true,
    opacity: 0.65,
  });
  mesh(
    new THREE.SphereGeometry(radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    glass,
    group,
    [0, 1.85, 0],
  );
  for (let rib = 0; rib < 8; rib++) {
    const ring = mesh(
      new THREE.TorusGeometry(radius + 0.035, 0.075, 6, 32, Math.PI),
      hull,
      group,
      [0, 1.85, 0],
    );
    ring.rotation.z = Math.PI / 2;
    ring.rotation.y = (rib * Math.PI) / 8;
  }
  cylinder(1.05, 0.4, trim, group, radius + 1.9);
  cylinder(0.72, 0.2, hull, group, radius + 2.2);
  for (let index = 0; index < 12; index++) {
    const angle = (index * Math.PI) / 6;
    const window = mesh(
      new THREE.BoxGeometry(0.6, 0.58, 0.15),
      new THREE.MeshStandardMaterial({
        color: '#b9e5dc',
        emissive: '#5baab6',
        emissiveIntensity: 0.6,
      }),
      group,
      [Math.sin(angle) * radius, 1.05, Math.cos(angle) * radius],
    );
    window.rotation.y = angle;
    lights.push(window);
  }
  mesh(new THREE.BoxGeometry(2, 1.9, 2.7), hull, group, [0, 1, radius]);
  mesh(new THREE.BoxGeometry(1.45, 1.4, 0.15), orange, group, [0, 1, radius + 1.38]);
  const beacon = mesh(
    new THREE.SphereGeometry(0.2, 12, 8),
    new THREE.MeshStandardMaterial({
      color: '#71bfb4',
      emissive: '#71bfb4',
      emissiveIntensity: 1.2,
    }),
    group,
    [0, radius + 2.45, 0],
  );
  const warningRing = mesh(
    new THREE.TorusGeometry(radius + 0.8, 0.04, 6, 64),
    new THREE.MeshBasicMaterial({ color: '#ee704b', transparent: true, opacity: 0.6 }),
    group,
    [0, 0.44, 0],
  );
  warningRing.rotation.x = -Math.PI / 2;
  return { group, beacon, warningRing };
}

function connect(from: string, to: string, scene: THREE.Scene) {
  const start = locations[from]!.clone().setY(0.8);
  const end = locations[to]!.clone().setY(0.8);
  const direction = end.clone().sub(start);
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const tube = mesh(
    new THREE.CylinderGeometry(0.6, 0.6, direction.length(), 12),
    paint('#bac0b4'),
    scene,
  );
  tube.position.copy(midpoint);
  tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(tube.geometry),
    new THREE.LineBasicMaterial({ color: '#5f665e', transparent: true, opacity: 0.3 }),
  );
  tube.add(edges);
  const gates: THREE.Mesh[] = [];
  for (const fraction of [0.35, 0.65]) {
    const gate = mesh(new THREE.BoxGeometry(1.7, 1.8, 0.35), paint('#6a827d'), scene);
    gate.position.copy(start.clone().lerp(end, fraction));
    gate.rotation.y = Math.atan2(direction.x, direction.z);
    gates.push(gate);
  }
  return gates;
}

export function buildColony(scene: THREE.Scene) {
  const terrain = new THREE.PlaneGeometry(180, 180, 90, 90);
  terrain.rotateX(-Math.PI / 2);
  const vertices = terrain.attributes.position!;
  const colors = [];
  for (let index = 0; index < vertices.count; index++) {
    const x = vertices.getX(index);
    const z = vertices.getZ(index);
    const radial = Math.sqrt(x * x + z * z);
    const height =
      radial < 26
        ? Math.sin(x * 0.35) * 0.08
        : Math.max(0, radial - 26) * 0.03 +
          Math.sin(x * 0.09) * Math.cos(z * 0.12) * 3 +
          random(index) * 1.2;
    vertices.setY(index, height - 0.1);
    const color = new THREE.Color().setHSL(
      0.035 + random(index) * 0.017,
      0.42,
      0.32 + random(index + 9) * 0.1,
    );
    colors.push(color.r, color.g, color.b);
  }
  terrain.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  terrain.computeVertexNormals();
  mesh(
    terrain,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true }),
    scene,
  );
  for (let index = 0; index < 170; index++) {
    const angle = random(index + 21) * Math.PI * 2;
    const radius = 24 + random(index + 16) * 52;
    const rock = mesh(
      new THREE.DodecahedronGeometry(0.3 + random(index + 3) * 1.15, 0),
      paint(index % 3 ? '#8d4e35' : '#b87852'),
      scene,
      [Math.cos(angle) * radius, 0.2, Math.sin(angle) * radius],
    );
    rock.scale.set(1.4, 0.7, 1);
    rock.rotation.set(random(index) * 3, random(index + 2) * 3, 0);
  }
  for (let index = 0; index < 16; index++) {
    const angle = (index / 16) * Math.PI * 2;
    const ridge = mesh(
      new THREE.ConeGeometry(10 + random(index + 80) * 15, 12 + random(index + 90) * 18, 5),
      paint('#9c5f43'),
      scene,
      [Math.cos(angle) * 80, 4, Math.sin(angle) * 80],
    );
    ridge.rotation.y = angle;
  }
  const pad = mesh(
    new THREE.CylinderGeometry(24, 24, 0.18, 6),
    new THREE.MeshStandardMaterial({ color: '#a97b5d', roughness: 1 }),
    scene,
    [0, 0.1, 0],
  );
  pad.rotation.y = Math.PI / 6;
  const padEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(pad.geometry),
    new THREE.LineBasicMaterial({ color: '#d3a67b', transparent: true, opacity: 0.35 }),
  );
  pad.add(padEdges);
  // Ground road marks and landing rings are procedural geometry.
  for (let index = 0; index < 28; index++)
    mesh(new THREE.BoxGeometry(0.12, 0.025, 0.7), paint('#cfa17b'), scene, [
      index * 1.5 - 20,
      0.23,
      8,
    ]);
  const landing = mesh(
    new THREE.RingGeometry(3.1, 3.2, 48),
    new THREE.MeshBasicMaterial({ color: '#d9aa80', side: THREE.DoubleSide }),
    scene,
    [16, 0.24, 13],
  );
  landing.rotation.x = -Math.PI / 2;
  mesh(new THREE.BoxGeometry(2.5, 0.04, 0.15), paint('#d9aa80'), scene, [16, 0.26, 13]);
  const windows: THREE.Mesh[] = [];
  const habitats = {
    A: buildHabitat('A', scene, windows),
    B: buildHabitat('B', scene, windows),
    Hub: buildHabitat('Hub', scene, windows),
  };
  const gateA = connect('A', 'Hub', scene);
  const gateB = connect('B', 'Hub', scene);
  connect('Hub', 'support', scene);
  connect('Hub', 'power', scene);
  const support = new THREE.Group();
  support.position.copy(locations.support!);
  scene.add(support);
  mesh(new THREE.BoxGeometry(4, 2.1, 4), paint('#c9cbbb'), support, [0, 1.2, 0]);
  for (const x of [-1.25, 1.25]) {
    const tank = mesh(new THREE.CylinderGeometry(0.8, 0.8, 3, 16), paint('#b4c5bd'), support, [
      x,
      2.2,
      -0.4,
    ]);
    tank.add(mesh(new THREE.TorusGeometry(0.82, 0.08, 6, 24), paint('#df8052'), new THREE.Group()));
    cylinder(0.45, 0.3, paint('#596a65'), tank, 1.5);
  }
  const power = new THREE.Group();
  power.position.copy(locations.power!);
  scene.add(power);
  cylinder(3.1, 0.4, paint('#58615e'), power, 0.3, 6);
  cylinder(2, 3.5, paint('#b6b8a9'), power, 2.15, 12);
  cylinder(2.1, 0.5, paint('#bd633c'), power, 2.4, 12);
  cylinder(1.25, 1.8, paint('#6b7770'), power, 4.75, 12);
  cylinder(0.45, 2.5, paint('#cbd0b7'), power, 6.6, 12);
  const reactorBeacon = mesh(
    new THREE.SphereGeometry(0.18, 12, 8),
    new THREE.MeshStandardMaterial({
      color: '#b5d8c7',
      emissive: '#b5d8c7',
      emissiveIntensity: 1,
    }),
    power,
    [0, 8.1, 0],
  );
  for (let index = 0; index < 8; index++) {
    const fin = mesh(new THREE.BoxGeometry(0.25, 2.2, 1.8), paint('#788882'), power, [
      Math.sin((index * Math.PI) / 4) * 2.1,
      2,
      Math.cos((index * Math.PI) / 4) * 2.1,
    ]);
    fin.rotation.y = (index * Math.PI) / 4;
  }
  const solar = new THREE.Group();
  solar.position.copy(locations.solar!);
  scene.add(solar);
  const solarCanvas = document.createElement('canvas');
  solarCanvas.width = 128;
  solarCanvas.height = 128;
  const context = solarCanvas.getContext('2d')!;
  context.fillStyle = '#253847';
  context.fillRect(0, 0, 128, 128);
  context.strokeStyle = '#6a8d9a';
  context.lineWidth = 1;
  for (let index = 0; index <= 128; index += 16) {
    context.beginPath();
    context.moveTo(index, 0);
    context.lineTo(index, 128);
    context.moveTo(0, index);
    context.lineTo(128, index);
    context.stroke();
  }
  const solarTexture = new THREE.CanvasTexture(solarCanvas);
  solarTexture.colorSpace = THREE.SRGBColorSpace;
  for (let index = 0; index < 6; index++) {
    const x = (index % 3) * 3.4;
    const z = Math.floor(index / 3) * 5;
    mesh(new THREE.BoxGeometry(0.15, 1.6, 0.15), paint('#bbc1ad'), solar, [x, 0.95, z]);
    const panel = mesh(
      new THREE.BoxGeometry(2.9, 0.12, 3.8),
      new THREE.MeshStandardMaterial({
        map: solarTexture,
        metalness: 0.5,
        roughness: 0.4,
        color: '#a2bace',
      }),
      solar,
      [x, 1.8, z],
    );
    panel.rotation.x = -0.3;
  }
  // Cargo, antenna, and rover add readable scale without downloaded assets.
  for (let index = 0; index < 6; index++) {
    const crate = mesh(
      new THREE.BoxGeometry(1.4, 0.8, 0.9),
      paint(index % 2 ? '#b9b3a2' : '#b96938'),
      scene,
      [-5 + (index % 3) * 1.7, 0.7, -17 + Math.floor(index / 3) * 1.2],
    );
    crate.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(crate.geometry),
        new THREE.LineBasicMaterial({ color: '#5f5b51' }),
      ),
    );
  }
  const antenna = new THREE.Group();
  antenna.position.set(-1, 0, -16);
  scene.add(antenna);
  cylinder(0.12, 5, paint('#c9cbbb'), antenna, 2.5);
  const dish = mesh(
    new THREE.SphereGeometry(1.3, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2),
    paint('#ddcfb7'),
    antenna,
    [0, 5, 0],
  );
  dish.rotation.z = 0.7;
  const rover = new THREE.Group();
  rover.position.set(9, 0.4, 14);
  rover.rotation.y = 0.5;
  scene.add(rover);
  mesh(new THREE.BoxGeometry(2.7, 0.9, 1.7), paint('#d5c7ad'), rover, [0, 0.6, 0]);
  mesh(new THREE.BoxGeometry(1.3, 0.65, 1.5), paint('#738d91'), rover, [0.2, 1.3, 0]);
  for (const x of [-0.9, 0.9])
    for (const z of [-1, 1]) {
      const wheel = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.25, 12), paint('#363c3b'), rover, [
        x,
        0.2,
        z,
      ]);
      wheel.rotation.x = Math.PI / 2;
    }
  const dustPositions = new Float32Array(600 * 3);
  for (let index = 0; index < 600; index++) {
    dustPositions[index * 3] = (random(index + 430) - 0.5) * 90;
    dustPositions[index * 3 + 1] = random(index + 900) * 12 + 0.3;
    dustPositions[index * 3 + 2] = (random(index + 204) - 0.5) * 90;
  }
  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dust = new THREE.Points(
    dustGeometry,
    new THREE.PointsMaterial({
      color: '#e8b084',
      size: 0.09,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
  );
  scene.add(dust);
  const leakGeometry = new THREE.BufferGeometry();
  const leakPositions = new Float32Array(240 * 3);
  leakGeometry.setAttribute('position', new THREE.BufferAttribute(leakPositions, 3));
  const leak = new THREE.Points(
    leakGeometry,
    new THREE.PointsMaterial({
      color: '#d4efdc',
      size: 0.13,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
    }),
  );
  leak.position.copy(locations.B!).add(new THREE.Vector3(3.2, 1, 0));
  scene.add(leak);
  const crewMarkers = Array.from({ length: 24 }, (_, index) =>
    mesh(
      new THREE.SphereGeometry(0.15, 8, 6),
      new THREE.MeshBasicMaterial({ color: '#b8ebd7' }),
      scene,
      [index, 0.8, 0],
    ),
  );
  return {
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
  };
}
