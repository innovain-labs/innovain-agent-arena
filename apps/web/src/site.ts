import { currentMarsIncidents, marsIncidents } from '@arena/mars-world';
export type SiteRoute =
  'arena' | 'leaderboard' | 'research' | 'scenarios' | 'try-your-model' | 'about';

export const siteNavigation: Array<{ route: SiteRoute; label: string }> = [
  { route: 'arena', label: 'Arena' },
  { route: 'leaderboard', label: 'Leaderboard' },
  { route: 'research', label: 'Research' },
  { route: 'scenarios', label: 'Scenarios' },
  { route: 'try-your-model', label: 'Try Your Model' },
  { route: 'about', label: 'About' },
];

export function routeHref(route: SiteRoute): string {
  return `#/${route === 'arena' ? '' : route}`;
}

export function resolveRoute(hash: string): SiteRoute {
  const route = hash.replace(/^#\/?/, '').split('?')[0]?.split('/')[0];
  if (
    route === 'leaderboard' ||
    route === 'research' ||
    route === 'scenarios' ||
    route === 'try-your-model' ||
    route === 'about'
  )
    return route;
  return 'arena';
}
export function resolveIncident(hash: string): (typeof marsIncidents)[number] {
  const slug = new URLSearchParams(hash.split('?')[1] ?? '').get('incident');
  return (
    marsIncidents.find((incident) => incident.slug === slug) ??
    currentMarsIncidents[0] ??
    marsIncidents[0]
  );
}

export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;
