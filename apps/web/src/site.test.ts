import { describe, expect, it } from 'vitest';
import { resolveIncident, resolveRoute, routeHref, siteNavigation } from './site';

describe('public site routing', () => {
  it('keeps static-preview routes stable', () => {
    expect(resolveRoute('#/leaderboard')).toBe('leaderboard');
    expect(resolveRoute('#/try-your-model')).toBe('try-your-model');
    expect(resolveRoute('#/unknown')).toBe('arena');
    expect(routeHref('arena')).toBe('#/');
  });

  it('exposes the public navigation contract', () => {
    expect(siteNavigation.map((item) => item.route)).toEqual([
      'arena',
      'leaderboard',
      'research',
      'scenarios',
      'try-your-model',
      'about',
    ]);
  });
  it('opens a catalog incident from a shareable arena link', () => {
    expect(resolveRoute('#/?incident=power-blackout')).toBe('arena');
    expect(resolveIncident('#/?incident=power-blackout').number).toBe('002');
    expect(resolveIncident('#/?incident=unknown').displayNumber).toBe('001');
  });
});
