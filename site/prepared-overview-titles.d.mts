import type { PlanetTitle } from './planet-shell-types';
export const OVERVIEW_TITLES: Readonly<Record<'milky-way' | 'local-group' | 'nearby-universe', PlanetTitle>>;
/** Planetary system overview titles, keyed by each system's star. */
export const SYSTEM_TITLES: Readonly<Record<string, PlanetTitle>>;
