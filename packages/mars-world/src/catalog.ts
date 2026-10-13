/** Public catalog metadata only; no hidden hazards, evaluator state, or scripted solutions. */
export const marsIncidents = [
  {
    slug: 'habitat-b-leak',
    id: 'mars-habitat-b-leak-001',
    number: '001',
    title: 'Habitat B Pressure Leak',
    summary:
      'Protect eight occupants, restore pressure, and contain the leak before oxygen runs out.',
    rescueRecording: 'example-incident-001.json',
    failureRecording: 'unsafe-incident-001.json',
  },
  {
    slug: 'power-blackout',
    id: 'mars-power-blackout-002',
    number: '002',
    title: 'Life Support Blackout',
    summary:
      'Restore power before supplying Habitat A. Isolating occupied rooms can trap the crew.',
    rescueRecording: 'example-incident-002.json',
    failureRecording: 'unsafe-incident-002.json',
  },
  {
    slug: 'oxygen-shortage',
    id: 'mars-oxygen-shortage-003',
    number: '003',
    title: 'Critical Oxygen Shortage',
    summary:
      'Evacuate and contain the leak, then supply only what is needed. Excess flow drains the colony reserve.',
    rescueRecording: 'example-incident-003.json',
    failureRecording: 'unsafe-incident-003.json',
  },
] as const;
