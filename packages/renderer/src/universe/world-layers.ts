/**
 * The world's layers, as one switch each: what a host that embeds the scene (the nebula lab, through
 * site/scene/embed-bridge.mts) may turn off. The website itself never turns one off; with every layer shown the world
 * publishes exactly as it does without this module.
 *
 * `subject` is the bank the page's own dataset shows (the object the page is about); every other layer leaves it alone,
 * so hiding Nebulae on a nebula's page keeps that nebula.
 */
export const WORLD_LAYERS = ['subject', 'sky', 'stars', 'galaxies', 'nebulae', 'planets', 'orbits', 'labels'] as const;
export type WorldLayer = typeof WORLD_LAYERS[number];
export type WorldLayerVisibility = Readonly<Record<WorldLayer, boolean>>;

export const isWorldLayer = (value: unknown): value is WorldLayer => typeof value === 'string' && (WORLD_LAYERS as readonly string[]).includes(value);

export const ALL_WORLD_LAYERS_SHOWN: WorldLayerVisibility = Object.freeze(Object.fromEntries(WORLD_LAYERS.map(layer => [layer, true])) as Record<WorldLayer, boolean>);

/** Every layer shown except `hidden`. */
export function worldLayerVisibility(hidden: Iterable<WorldLayer>): WorldLayerVisibility {
  const off = new Set(hidden);
  for (const layer of off) if (!isWorldLayer(layer)) throw new TypeError(`Unknown world layer: ${String(layer)}.`);
  return Object.freeze(Object.fromEntries(WORLD_LAYERS.map(layer => [layer, !off.has(layer)])) as Record<WorldLayer, boolean>);
}

/** The layers a visibility hides, in `WORLD_LAYERS` order. */
export const hiddenWorldLayers = (visibility: WorldLayerVisibility): WorldLayer[] => WORLD_LAYERS.filter(layer => !visibility[layer]);

/** The layer an object of this classification belongs to; null for one no layer names (it stays shown). */
export function worldLayerOfClassification(classification: string | undefined): Exclude<WorldLayer, 'subject' | 'sky' | 'orbits' | 'labels'> | null {
  switch (classification) {
    case 'star': case 'black-hole': case 'star-system': case 'open-cluster': case 'globular-cluster': return 'stars';
    case 'planet': case 'satellite': case 'dwarf-planet': case 'asteroid': case 'comet': case 'trans-neptunian': case 'interstellar':
    case 'exoplanet': case 'planetary-system': case 'satellite-system': return 'planets';
    case 'galaxy': case 'galaxy-cluster': return 'galaxies';
    case 'nebula': return 'nebulae';
    default: return null;
  }
}

/** One rule for banks, meshes and body markers: the page's selected object and dataset bank belong to Subject. */
export function worldLayerHidden(visibility: WorldLayerVisibility, id: string, subjectIds: readonly (string | null)[], layer: WorldLayer | null): boolean {
  if (subjectIds.includes(id)) return !visibility.subject;
  return layer !== null && !visibility[layer];
}
