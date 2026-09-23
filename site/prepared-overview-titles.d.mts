import type { ObjectTitle } from './object-shell-types';
export const OVERVIEW_TITLES: Readonly<Record<'milky-way' | 'local-group' | 'nearby-universe', ObjectTitle>>;
/** Planetary system overview titles, keyed by each system's star. */
export const SYSTEM_TITLES: Readonly<Record<string, ObjectTitle>>;
