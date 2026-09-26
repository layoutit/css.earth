import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { requireInventory } from '../src/platform/runtime-asset-closure.mts';
import { preparedAssetGroup, preparedAssetGroupFile, resolvePreparedAssetUrl, type PreparedAssetOrigin } from '@cssearth/renderer';
import { isRecord } from '@cssearth/core';
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
  const key = `${resolve(root)}\0${id}`;
  let cached = manifestCache.get(key);
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
    manifestCache.set(key, cached);
  }
  return cached;
}

const splitCache = new Map<string, Promise<AssetHashSplit>>();
export interface AssetHashSplit { readonly embedded: Readonly<Record<string, string>>; readonly groups: ReadonlyMap<string, Readonly<Record<string, string>>>; }
const SCENE_FILE = /\/scenes\/[a-z][a-z0-9-]*\/([^\s"'\\)]+)/gu;

/** A page embeds the hashes its first view reads: every file the prepared object names outside its resource entries
 * (markup the runtime builds, material styles) and the startup resources with their groups. Each other resource's hash
 * waits in its group (`preparedAssetGroup`) until a demand reads it. A hash is 64 characters that do not compress:
 * Earth's 56-page surface embedded 1,754 of them, 60 KB of every cold page. */
export function assetHashSplit(id: string, root = process.cwd()): Promise<AssetHashSplit> {
  const key = `${resolve(root)}\0${id}`;
  let cached = splitCache.get(key);
  if (!cached) {
    cached = (async () => {
      const map = await assetShaMap(id, root);
      const text = await readFile(resolve(root, 'src/objects', id, 'prepared/object.json'), 'utf8').catch((error: unknown) => {
        // An object without a prepared scene has no resource demands: every hash stays embedded.
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return null;
        throw error;
      });
      if (text === null) return Object.freeze({ embedded: map, groups: new Map() });
      const document: unknown = JSON.parse(text);
      const data = isRecord(document) && isRecord(document.data) ? document.data : null, assets = data && isRecord(data.assets) ? data.assets : null;
      const entries = assets && Array.isArray(assets.entries) ? assets.entries : [], startup = assets && Array.isArray(assets.startup) ? assets.startup : [];
      const embedded = new Map<string, string>(), groups = new Map<string, Record<string, string>>();
      const embed = (filename: string, owner: string) => {
        const digest = map[filename];
        if (!digest) throw new Error(`${id}: ${owner} names ${filename}, which inventory.json does not publish.`);
        embedded.set(filename, digest);
      };
      const walk = (value: unknown): void => {
        if (typeof value === 'string') { for (const match of value.matchAll(SCENE_FILE)) if (map[match[1]!]) embedded.set(match[1]!, map[match[1]!]!); return; }
        if (Array.isArray(value)) { value.forEach(walk); return; }
        if (isRecord(value)) for (const [field, item] of Object.entries(value)) if (!(item === entries && field === 'entries')) walk(item);
      };
      walk(document);
      const startKeys = new Set(startup.filter((item): item is string => typeof item === 'string'));
      const startGroups = new Set([...startKeys].map(preparedAssetGroup).filter(Boolean));
      for (const entry of entries) {
        if (!isRecord(entry) || typeof entry.key !== 'string' || typeof entry.url !== 'string') throw new TypeError(`${id}: prepared resource entry is invalid.`);
        const filename = /^\/scenes\/[a-z][a-z0-9-]*\/(.+)$/u.exec(entry.url)?.[1];
        if (!filename) continue;
        const group = preparedAssetGroup(entry.key);
        if (startKeys.has(entry.key) || startGroups.has(group)) { embed(filename, `resource ${entry.key}`); continue; }
        if (!map[filename]) throw new Error(`${id}: resource ${entry.key} names ${filename}, which inventory.json does not publish.`);
        if (embedded.has(filename)) continue;
        preparedAssetGroupFile(group);
        groups.set(group, { ...groups.get(group), [filename]: map[filename]! });
      }
      return Object.freeze({ embedded: Object.freeze(Object.fromEntries(embedded)), groups });
    })();
    splitCache.set(key, cached);
  }
  return cached;
}

/** The descriptor field consumed by `decodePreparedCssObject`: unset when `ASSET_ORIGIN`
 * is unset, so a build without it embeds nothing new in the descriptor. */
export interface EmbeddedHashes {
  /** Build-time resolution: every published hash, never embedded in a page. */
  every?: boolean;
  /** Further addresses the page's first view reads, such as the textures its server markup writes. */
  addresses?: readonly string[];
}
export async function preparedAssetOriginFor(id: string, root = process.cwd(), { every = false, addresses = [] }: EmbeddedHashes = {}): Promise<PreparedAssetOrigin | undefined> {
  const origin = assetOrigin();
  if (!origin) return undefined;
  if (every) return { origin, assets: await assetShaMap(id, root) };
  const { embedded, groups } = await assetHashSplit(id, root), map = await assetShaMap(id, root), assets = { ...embedded };
  for (const address of addresses) {
    const filename = /^\/scenes\/[a-z][a-z0-9-]*\/(.+)$/u.exec(address)?.[1];
    if (filename && map[filename]) assets[filename] = map[filename]!;
  }
  return { origin, assets, ...(groups.size ? { groups: `/objects/${id}/asset-hashes/` } : {}) };
}

/** Attach the build-time asset origin to the descriptor consumed by the browser loader. */
export async function withPreparedAssetOrigin(descriptor: ObjectDescriptor, root = process.cwd(), embedded: EmbeddedHashes = {}): Promise<ObjectDescriptor> {
  const preparedAssetOrigin = await preparedAssetOriginFor(descriptor.id, root, embedded);
  return preparedAssetOrigin
    ? { ...descriptor, properties: { ...descriptor.properties, assetOrigin: {
      origin: preparedAssetOrigin.origin,
      ...(preparedAssetOrigin.assets ? { assets: preparedAssetOrigin.assets } : {}),
      ...(preparedAssetOrigin.groups ? { groups: preparedAssetOrigin.groups } : {}),
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
