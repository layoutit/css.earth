/** Published plates edit and bake an image-layer object where the site keeps it (`src/objects/<id>`). Only a draft,
 * a coarser bake to preview an edit, is lab scratch. The browser and the bake route read the same rule. */
const OBJECT = /^src\/objects\/([a-z0-9][a-z0-9-]*)$/;
/** A draft previews an edit, a full bake runs the site's preparation in place, a publish uploads the inventory. */
export type PlateQuality = 'draft' | 'full' | 'publish';
export function plateObjectId(object: string): string {
  const match = OBJECT.exec(object);
  if (!match) throw new TypeError(`A published-plates object is a src/objects directory; got ${JSON.stringify(object)}.`);
  return match[1]!;
}
/** The one lab-only place: an object's latest draft, in its ignored scratch. */
export const platesDirectory = (object: string) => `src/objects/${plateObjectId(object)}/.local/lab/draft`;
/** A draft bakes the same recipe through the same bake with smaller faces and half the slices through a shape or
 * body: the plates, depths and star removal are the recipe's, the sampling is coarser. Measured on this machine
 * (2026-10-07) through the lab's route: the Helix 1.5 s against 25 s for the full bake, the Ring Nebula 4.3 s
 * against 17 s. */
export function draftBake<T extends Record<string, unknown>>(bake: T): T {
  const draft: Record<string, unknown> = { ...bake };
  const cap = (key: string, most: number) => { if (typeof draft[key] === 'number') draft[key] = Math.min(draft[key] as number, most); };
  const halve = (key: string) => { if (typeof draft[key] === 'number') draft[key] = Math.max(8, Math.ceil((draft[key] as number) / 2)); };
  cap('maxFacePixels', 512); cap('bulgeFacePixels', 96); halve('bulgeSlices'); halve('bulgeCrossSlices');
  return draft as T;
}
