import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireInventory } from '../src/platform/runtime-asset-closure.mts';
import { resolvePreparedAssetUrl, type PreparedAssetOrigin } from '../src/renderers/css/dist/index.js';
import type { ObjectDescriptor } from '@cssearth/objects';
export type { PreparedAssetOrigin };

/** Build-time-only asset origin: unset in local dev and CI, so `pnpm build` reproduces
 * today's same-origin `/scenes/` output. Set (in deploys) it points every consumption
 * point listed in the R2-textures plan at the published bucket. */
export function assetOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env.ASSET_ORIGIN?.trim();
  if (!value) return null;
  // https for a real host; http only for a loopback test origin (mirrors r2-cors.json's own local rules).
  if (!/^(?:https:\/\/[a-z0-9.-]+|http:\/\/127\.0\.0\.1:\d+)$/u.test(value)) {
    throw new TypeError('ASSET_ORIGIN must be an https URL (or a loopback http URL for local testing) with no path.');
  }
  return value;
}

const manifestCache = new Map<string, Promise<Readonly<Record<string, string>>>>();

/** The `filename -> sha256` map published for one object's `public/scenes/<id>/*`
 * assets (the public entries of its tracked `inventory.json`), cached per build process. */
export function assetShaMap(id: string, root = process.cwd()): Promise<Readonly<Record<string, string>>> {
  let cached = manifestCache.get(id);
  if (!cached) {
    cached = (async () => {
      let bytes: string;
      try { bytes = await readFile(resolve(root, 'src/objects', id, 'inventory.json'), 'utf8'); }
      catch (error) {
        // An object that ships nothing baked has nothing to resolve against the asset origin.
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return Object.freeze({});
        throw error;
      }
      const inventory = requireInventory(id, JSON.parse(bytes) as unknown);
      return Object.freeze(Object.fromEntries(inventory.assets.filter(asset => asset.location === 'public').map(asset => [asset.filename, asset.sha256])));
    })();
    manifestCache.set(id, cached);
  }
  return cached;
}

/** The descriptor field consumed by `decodePreparedCssObject`: unset when `ASSET_ORIGIN`
 * is unset, so a build without it embeds nothing new in the descriptor. */
export async function preparedAssetOriginFor(id: string, root = process.cwd()): Promise<PreparedAssetOrigin | undefined> {
  const origin = assetOrigin();
  if (!origin) return undefined;
  return { origin, assets: await assetShaMap(id, root) };
}

/** Attach the build-time asset origin to the descriptor consumed by the browser loader. */
export async function withPreparedAssetOrigin(descriptor: ObjectDescriptor, root = process.cwd()): Promise<ObjectDescriptor> {
  const preparedAssetOrigin = await preparedAssetOriginFor(descriptor.id, root);
  return preparedAssetOrigin
    ? { ...descriptor, properties: { ...descriptor.properties, assetOrigin: {
      origin: preparedAssetOrigin.origin,
      ...(preparedAssetOrigin.assets ? { assets: preparedAssetOrigin.assets } : {}),
    } } }
    : descriptor;
}

/** Node-side counterpart of `resolvePreparedAssetUrl`, for build-time (Astro) rewrites:
 * preload links and inlined authored CSS. Looks the object's own hash up by filename. */
export async function resolveBuildSceneAddress(address: string, root = process.cwd()): Promise<string> {
  const origin = assetOrigin();
  if (!origin) return address;
  const match = /^\/scenes\/([a-z][a-z0-9-]*)\/(.+)$/u.exec(address);
  if (!match) return address;
  const [, id] = match;
  const assets = await assetShaMap(id!, root);
  return resolvePreparedAssetUrl(address, { origin, assets });
}

const SCENE_ADDRESS = /^\/scenes\/[a-z][a-z0-9-]*\/.+$/u;

/** Deep-rewrites every `/scenes/<id>/<file>` string found anywhere in a prepared-page JSON
 * value (`page.json`'s `controls`/`content`: lens thumbnails, dataset preview textures, and
 * anything else shaped like a bare scene address) — the same values `DatasetLenses.astro` and
 * friends read directly, outside the runtime `resources.url()` chokepoint. No-op when unset. */
export async function resolveSceneAddressesDeep<T>(value: T, root = process.cwd()): Promise<T> {
  if (!assetOrigin()) return value;
  const walk = async (input: unknown): Promise<unknown> => {
    if (typeof input === 'string') return SCENE_ADDRESS.test(input) ? resolveBuildSceneAddress(input, root) : input;
    if (Array.isArray(input)) return Promise.all(input.map(walk));
    if (input && typeof input === 'object') {
      const entries = await Promise.all(Object.entries(input).map(async ([key, item]) => [key, await walk(item)] as const));
      return Object.fromEntries(entries);
    }
    return input;
  };
  return walk(value) as Promise<T>;
}

// `url(` and its closing `)` may wrap the quoted address across lines (saturn-surfaces.css
// does this for several rows), so whitespace is allowed around the address but excluded from it.
const CSS_SCENE_URL = /url\(\s*(["']?)(\/scenes\/[a-z][a-z0-9-]*\/[^\s"')]+)\1\s*\)/gu;

/** Rewrites literal `url(/scenes/<id>/<file>)` references in authored CSS text (loaded
 * `?inline` and inlined verbatim into the page) into their published origin form. */
export async function rewriteSceneCss(css: string, root = process.cwd()): Promise<string> {
  if (!assetOrigin()) return css;
  const matches = [...css.matchAll(CSS_SCENE_URL)];
  if (!matches.length) return css;
  const resolved = await Promise.all(matches.map(match => resolveBuildSceneAddress(match[2]!, root)));
  let index = 0;
  return css.replace(CSS_SCENE_URL, (_match, quote: string) => `url(${quote}${resolved[index++]}${quote})`);
}
