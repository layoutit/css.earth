import sharp from 'sharp';

/**
 * Every image a prepared runtime names states its pixel width and height on its entry.
 *
 * The renderer draws a leaf's image at its own size, one texel per device pixel, and sizes the leaf's box to it
 * (packages/renderer/src/rendering/culling/prepared-leaf-box-direct.ts). It reads the size here: it never measures an image
 * or works one out from a byte count. This is the last step of every bake (`finalizeObjectJson`), so each generator's
 * entries are stated the same way, from the file the bake published.
 */
interface Entry { key: string; url: string; decodedBytes?: number; width?: number; height?: number }

export async function withImageSizes<D extends { id: string; assets: { entries: readonly Entry[] } }>(definition: D, file: (url: string) => string): Promise<D> {
  const sizes = new Map<string, Promise<readonly [number, number]>>();
  const size = (entry: Entry) => {
    let found = sizes.get(entry.url);
    if (!found) sizes.set(entry.url, found = sharp(file(entry.url)).metadata().then(({ width, height }) => {
      if (!(width > 0) || !(height > 0)) throw new TypeError(`${definition.id}: image ${entry.key} (${entry.url}) at ${file(entry.url)} has no size.`);
      return [width, height] as const;
    }, error => { throw new Error(`${definition.id}: image ${entry.key} (${entry.url}) could not be read at ${file(entry.url)}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }); }));
    return found;
  };
  const entries = await Promise.all(definition.assets.entries.map(async entry => {
    const [width, height] = await size(entry);
    if (entry.decodedBytes !== undefined && entry.decodedBytes !== width * height * 4)
      throw new TypeError(`${definition.id}: image ${entry.key} (${entry.url}) is ${width} x ${height}, ${width * height * 4} decoded bytes, and its entry states ${entry.decodedBytes}.`);
    return { ...entry, width, height };
  }));
  return { ...definition, assets: { ...definition.assets, entries } };
}
