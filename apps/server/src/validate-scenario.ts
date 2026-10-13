import { loadScenario } from './scenario-loader';
import { marsIncidents } from '@arena/mars-world';
const paths = process.argv[2]
  ? [process.argv[2]]
  : marsIncidents.map((incident) => `scenarios/mars/${incident.slug}/scenario.yaml`);
for (const path of paths) {
  const scenario = await loadScenario(path);
  console.log(`Valid scenario: ${scenario.metadata.name}`);
}
