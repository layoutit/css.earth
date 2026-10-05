import moonCatalogues from './source/moon-catalogues.json' with { type: 'json' };
import { sourceArray, sourceId, sourceObject, sourceText, sourceUnique } from '@cssearth/objects/sources';

/** Read names from the source catalogue without creating scene objects or invented positions. */
export function parseMoonCatalogue(input: unknown) {
  const catalogue = sourceObject(input);
  const moons = sourceArray(catalogue.moons, value => {
    const moon = sourceObject(value);
    return { id: sourceId(moon.id), name: sourceText(moon.name) };
  });
  sourceUnique(moons.map(moon => moon.id), 'moon identities');
  const count = catalogue.count;
  if (!Number.isInteger(count) || count !== moons.length) throw new TypeError('Moon catalogue count does not match its entries.');
  return { moons };
}

const catalogues: Readonly<Record<string, ReturnType<typeof parseMoonCatalogue>>> = Object.fromEntries(
  moonCatalogues.systems.map(system => [sourceId(system.id), parseMoonCatalogue(system)]));

/** The moons a host's source catalogue names, in the catalogue's order; none for a host without one. */
export const catalogueMoons = (hostId: string): readonly { readonly id: string; readonly name: string }[] => catalogues[hostId]?.moons ?? [];

export { catalogues };
