/** Public catalog metadata only; no hidden hazards, evaluator state, or scripted solutions. */
export const marsIncidents = [
  {
    slug: 'habitat-b-leak',
    id: 'mars-habitat-b-leak-001',
    number: '001',
    displayNumber: '001',
    title: 'Habitat B Pressure Leak',
    summary:
      'Protect eight occupants, restore pressure, and contain the leak before oxygen runs out.',
    objective: 'Protect all eight crew members and stabilize Habitat B.',
    keyDecision: 'Isolation contains the shared leak but closes the transit route.',
    rescueRecording: 'example-incident-001.json',
    failureRecording: 'unsafe-incident-001.json',
  },
  {
    slug: 'power-blackout',
    id: 'mars-power-blackout-002',
    number: '002',
    displayNumber: '002',
    title: 'Life Support Blackout',
    summary:
      'Restore power before supplying Habitat A. Isolating occupied rooms can trap the crew.',
    objective: 'Restore life support and stabilize Habitat A before the deadline.',
    keyDecision: 'Backup power uses finite fuel; isolating Habitat A can trap its crew.',
    rescueRecording: 'example-incident-002.json',
    failureRecording: 'unsafe-incident-002.json',
  },
  {
    slug: 'oxygen-shortage',
    id: 'mars-oxygen-shortage-003',
    number: '003',
    displayNumber: '003',
    title: 'Critical Oxygen Shortage',
    summary:
      'Evacuate and contain the leak, then supply only what is needed. Excess flow drains the colony reserve.',
    objective: 'Protect the Habitat B crew and stabilize the habitat without emptying the reserve.',
    keyDecision: 'Evacuate and contain the leak before routing oxygen from the shared reserve.',
    rescueRecording: 'example-incident-003.json',
    failureRecording: 'unsafe-incident-003.json',
  },
  {
    slug: 'habitat-b-leak-v2',
    id: 'mars-habitat-b-leak-001-v2',
    number: '004',
    displayNumber: '001',
    title: 'Pressure Leak / Repair Drone',
    summary: 'Evacuate, contain, then seal the leak with a repair drone.',
    objective: 'Protect the crew, repair the leak, and restore Habitat B pressure.',
    keyDecision: 'The repair drone needs isolation, an evacuated habitat, and operating power.',
    rescueRecording: 'example-incident-004.json',
    failureRecording: 'unsafe-incident-004.json',
  },
  {
    slug: 'power-blackout-v2',
    id: 'mars-power-blackout-002-v2',
    number: '005',
    displayNumber: '002',
    title: 'Blackout / Power Routing',
    summary: 'Disconnect nonessential loads to restore life-support power before moving the crew.',
    objective: 'Restore power by rerouting nonessential services and stabilize Habitat A.',
    keyDecision: 'Power routing is available once. Backup power consumes finite fuel.',
    rescueRecording: 'example-incident-005.json',
    failureRecording: 'unsafe-incident-005.json',
  },
  {
    slug: 'oxygen-shortage-v2',
    id: 'mars-oxygen-shortage-003-v2',
    number: '006',
    displayNumber: '003',
    title: 'Oxygen Crisis / Conservation',
    summary: 'Reduce baseline consumption, evacuate, and seal the leak before reserves run out.',
    objective: 'Enable emergency conservation, repair Habitat B, and protect every crew member.',
    keyDecision:
      'Conservation does not stop leaks or oxygen flow. Repair removes the leak permanently.',
    rescueRecording: 'example-incident-006.json',
    failureRecording: 'unsafe-incident-006.json',
  },
] as const;

/** Scenarios presented in the current public arena. Older records remain addressable by ID. */
export const currentMarsIncidents = marsIncidents.filter((incident) =>
  incident.slug.endsWith('-v2'),
);
