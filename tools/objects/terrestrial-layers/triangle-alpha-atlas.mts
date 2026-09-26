import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { writeLossyWebp } from '../../../src/preparation/raster/lossy-lane.ts';

/** A `<u>` face is the triangle its two bevelled top corners cut from its atlas slice with `corner-shape`: apex at the
 * top centre, base along the bottom. Safari 26 has no `corner-shape` and rounds those corners into an ellipse, so every
 * atlas a face reads also gets a copy whose slices are transparent outside the triangle, and the runtime reads the copy
 * where the capability is missing (packages/renderer/src/rendering/prepared-resource-fallbacks.ts). */
interface Slice { x: number; y: number; width: number; height: number; atlasWidth: number; atlasHeight: number }
interface Entry { key: string; url: string; pool: string; decodedBytes?: number }
interface Write { kind: string; target?: number; name?: string; resource?: string | null; value?: string }
interface Definition { tree: { nodes: { parent: number; tag: string; className?: string; style: string | null }[] }; variants: { writes: Write[] }[];
  assets: { entries: Entry[]; fallbacks?: { unsupported: string; resources: Record<string, string> }[] } }

/** The mask ends at the triangle's edges, antialiased over one atlas pixel. Raster-sized leaves are scaled about 60×
 * onto their faces, so growing the triangle by even one pixel pushed spikes out of every narrow apex. */
const EDGE_BLEED = 0;

const pixels = (style: string, pattern: RegExp, label: string) => {
  const match = pattern.exec(style);
  if (!match) throw new TypeError(`A triangle face has no ${label}: ${style.slice(0, 160)}.`);
  return match.slice(1).map(Number);
};

/** The atlas slices of the faces each texture resource paints. Every lens can carry its own mesh, shown by its display
 * variable and packed into its own atlas at its own size, and polar faces read the poles image, so a resource's mask is
 * the union of just the faces that read it in some variant. */
export function triangleSlices(definition: Definition, namespace: string): Map<string, Slice[]> {
  const { nodes } = definition.tree;
  const ancestors = (index: number) => { const chain = new Set<number>([-1]); for (let at = index; at >= 0; at = nodes[at]!.parent) chain.add(at); return chain; };
  const faces = nodes.flatMap((node, index) => {
    if (node.tag !== 'u' || !node.style) return [];
    const style = node.style;
    const [x, y] = pixels(style, /background-position:\s*(-?[\d.]+)px\s+(-?[\d.]+)px/u, 'background position');
    const [atlasWidth, atlasHeight] = pixels(style, /background-size:\s*([\d.]+)px\s+([\d.]+)px/u, 'background size');
    const display = /display:\s*var\((--[\w-]+)\s*,\s*([\w-]+)\s*\)/u.exec(style);
    return [{ index, ancestors: ancestors(node.parent), display: display ? { name: display[1]!, fallback: display[2]! } : null,
      image: (node.className ?? '').split(/\s+/u).includes(`${namespace}-polar`) ? `--${namespace}-poles-image` : `--${namespace}-surface-image`,
      slice: { x: -x!, y: -y!, width: pixels(style, /--polycss-atlas-width:\s*([\d.]+)px/u, 'atlas width')[0]!,
        height: pixels(style, /--polycss-atlas-height:\s*([\d.]+)px/u, 'atlas height')[0]!, atlasWidth: atlasWidth!, atlasHeight: atlasHeight! } }];
  });
  const byResource = new Map<string, Set<number>>();
  for (const { writes } of definition.variants) {
    const value = (kind: string, name: string, chain: Set<number>) => writes.find(write => write.kind === kind && write.name === name && chain.has(write.target ?? -1));
    for (const face of faces) {
      if (face.display && (value('style', face.display.name, face.ancestors)?.value ?? face.display.fallback) === 'none') continue;
      const resource = value('texture', face.image, face.ancestors)?.resource;
      if (typeof resource !== 'string') continue;
      if (!byResource.has(resource)) byResource.set(resource, new Set());
      byResource.get(resource)!.add(face.index);
    }
  }
  const slice = new Map(faces.map(face => [face.index, face.slice]));
  return new Map([...byResource].map(([resource, indices]) => [resource, [...indices].map(index => slice.get(index)!)]));
}

/** Multiply each pixel's alpha by its coverage of the union of the faces' triangles, edges antialiased. */
export async function maskTriangleAtlas(input: string, slices: readonly Slice[]) {
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const coverage = new Float32Array(info.width * info.height);
  const distance = (px: number, py: number, x0: number, y0: number, x1: number, y1: number) => {
    const dx = x1 - x0, dy = y1 - y0; return ((px - x0) * dy - (py - y0) * dx) / Math.hypot(dx, dy);
  };
  for (const slice of slices) {
    const scaleX = info.width / slice.atlasWidth, scaleY = info.height / slice.atlasHeight;
    const left = slice.x * scaleX, top = slice.y * scaleY, width = slice.width * scaleX, height = slice.height * scaleY;
    const [ax, ay, bx, by, cx, cy] = [left + width / 2, top, left, top + height, left + width, top + height];
    for (let y = Math.max(0, Math.floor(top) - 2); y < Math.min(info.height, Math.ceil(top + height) + 2); y++) {
      for (let x = Math.max(0, Math.floor(left) - 2); x < Math.min(info.width, Math.ceil(left + width) + 2); x++) {
        const px = x + 0.5, py = y + 0.5;
        const inside = Math.min(distance(px, py, ax, ay, bx, by), distance(px, py, bx, by, cx, cy), distance(px, py, cx, cy, ax, ay));
        const value = Math.max(0, Math.min(1, inside + EDGE_BLEED + 0.5)), index = y * info.width + x;
        if (value > coverage[index]!) coverage[index] = value;
      }
    }
  }
  for (let index = 0; index < coverage.length; index++) data[index * 4 + 3] = Math.round(data[index * 4 + 3]! * coverage[index]!);
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
}

/** Whether a WebP holds a lossless (VP8L) bitstream: numeric and categorical atlases are published lossless and their
 * masked copies must stay so; photographic ones went through the lossy lane. */
export function webpIsLossless(bytes: Uint8Array): boolean {
  const text = (at: number) => String.fromCharCode(...bytes.subarray(at, at + 4));
  if (text(0) !== 'RIFF' || text(8) !== 'WEBP') throw new TypeError('A triangle atlas is not a WebP file.');
  for (let at = 12; at + 8 <= bytes.length;) {
    const chunk = text(at), size = bytes[at + 4]! | bytes[at + 5]! << 8 | bytes[at + 6]! << 16 | bytes[at + 7]! << 24;
    if (chunk === 'VP8L') return true;
    if (chunk === 'VP8 ') return false;
    at += 8 + size + (size & 1);
  }
  throw new TypeError('A triangle atlas WebP has no image bitstream.');
}

export const alphaAtlasName = (url: string) => {
  const match = /^(.*?)(@2x)?\.webp$/u.exec(url);
  if (!match) throw new TypeError(`A triangle atlas must be WebP: ${url}.`);
  return `${match[1]}-alpha${match[2] ?? ''}.webp`;
};

/** Write the masked copy of every atlas a triangle face reads and declare it as that resource's corner-shape fallback. */
export async function prepareTriangleAlphaAtlases<T extends Definition>(definition: T, { namespace, publicDirectory, publicBase }: { namespace: string; publicDirectory: string; publicBase: string }): Promise<T> {
  const sliced = triangleSlices(definition, namespace);
  if (!sliced.size) return definition;
  const byUrl = new Map<string, Slice[]>();
  for (const [key, slices] of sliced) {
    const entry = definition.assets.entries.find(candidate => candidate.key === key);
    if (!entry) throw new TypeError(`${namespace}: a triangle face reads undeclared resource ${key}.`);
    if (!entry.url.startsWith(publicBase)) throw new TypeError(`${namespace}: ${key} (${entry.url}) is outside ${publicBase}.`);
    byUrl.set(entry.url, [...byUrl.get(entry.url) ?? [], ...slices]);
  }
  const written = new Map<string, string>(), entries: Entry[] = [], resources: Record<string, string> = {};
  for (const key of [...sliced.keys()].sort()) {
    const entry = definition.assets.entries.find(candidate => candidate.key === key)!;
    let url = written.get(entry.url);
    if (!url) {
      url = alphaAtlasName(entry.url);
      const input = resolve(publicDirectory, entry.url.slice(publicBase.length)), output = resolve(publicDirectory, url.slice(publicBase.length));
      const masked = await maskTriangleAtlas(input, byUrl.get(entry.url)!);
      // The copy keeps its atlas's encoding: a lossless atlas stays lossless, a photograph stays in the lossy lane. The
      // triangle edges live in the alpha plane, kept exact either way.
      if (webpIsLossless(await readFile(input))) await masked.webp({ lossless: true, effort: 4 }).toFile(output);
      else await writeLossyWebp(masked, output, { alphaQuality: 100, effort: 6 });
      written.set(entry.url, url);
    }
    entries.push({ ...entry, key: `${key}:alpha`, url });
    resources[key] = `${key}:alpha`;
  }
  // A key that names a masked atlas's file without a face reading it (poles:<lens> often names surface:<lens>'s atlas)
  // swaps with it: a pool counts files, and two keys that shared one must not become two.
  for (const entry of definition.assets.entries) {
    const url = written.get(entry.url);
    if (!url || resources[entry.key] || entry.key.endsWith(':alpha')) continue;
    entries.push({ ...entry, key: `${entry.key}:alpha`, url });
    resources[entry.key] = `${entry.key}:alpha`;
  }
  const fallbacks = (definition.assets.fallbacks ?? []).filter(fallback => fallback.unsupported !== 'corner-shape');
  return { ...definition, assets: { ...definition.assets, entries: [...definition.assets.entries.filter(entry => !entry.key.endsWith(':alpha')), ...entries],
    fallbacks: [...fallbacks, { unsupported: 'corner-shape', resources }] } };
}
