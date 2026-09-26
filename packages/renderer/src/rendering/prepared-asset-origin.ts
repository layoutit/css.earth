/** Runtime resolution of a prepared `/scenes/<id>/<file>` address to a published
 * `<origin>/runtime-assets/<sha256>/<file>` URL, mirroring `paging/city-index.ts`'s
 * `new URL(ref.url, plan.geometryOrigin)`: prepared data keeps its `/scenes/` address
 * unchanged, and only the value handed to a network read or a CSS `url()` is resolved. */
export interface PreparedAssetOrigin {
  readonly origin: string;
  /** The hashes a page's first view reads. A hash is 64 characters that do not compress, so the rest stay out. */
  readonly assets?: Readonly<Record<string, string>>;
  /** Same-origin directory holding every other hash, one JSON per resource group (`preparedAssetGroupFile`). */
  readonly groups?: string;
}

const INDEX_SEGMENT = /:\d+(?=:|$)/u;

/** Resources whose keys differ only in their first index are demanded together (one dataset's pages at one level), so
 * their hashes share a group; keys without an index share the object's one unindexed group, `''`. */
export function preparedAssetGroup(key: string): string {
  return INDEX_SEGMENT.test(key) ? key.replace(INDEX_SEGMENT, '') : '';
}

export function preparedAssetGroupFile(group: string): string {
  if (group && !/^[a-z0-9-]+(?::[a-z0-9-]+)*$/u.test(group)) throw new TypeError(`Prepared asset group ${JSON.stringify(group)} is not a key path.`);
  return `${group ? group.replaceAll(':', '.') : 'unindexed'}.json`;
}

const SCENE_ADDRESS = /^\/scenes\/[a-z][a-z0-9-]*\/(.+)$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

/** `sha256`, when the caller already carries a pin beside this address (a JSON
 * catalogue's own `sha256` field), is used ahead of the object's asset map and
 * verified against it if both are present. */
export function resolvePreparedAssetUrl(address: string, assetOrigin: PreparedAssetOrigin | null | undefined, sha256?: string): string {
  if (!assetOrigin) return address;
  const match = SCENE_ADDRESS.exec(address);
  if (!match) return address;
  const filename = match[1]!;
  const fromMap = assetOrigin.assets?.[filename];
  if (sha256 !== undefined && fromMap !== undefined && sha256 !== fromMap) {
    throw new Error(`Prepared asset hash disagreement for ${address}.`);
  }
  const digest = sha256 ?? fromMap;
  if (!digest || !SHA256.test(digest)) throw new Error(`No published asset hash for ${address}.`);
  return `${assetOrigin.origin}/runtime-assets/${digest}/${filename}`;
}

// Matches `site/asset-origin.mts`'s `CSS_SCENE_URL`: `url(` and its closing `)` may wrap
// the quoted address across lines, so whitespace is allowed around it but excluded from it.
const STYLE_SCENE_URL = /url\(\s*(["']?)(\/scenes\/[a-z][a-z0-9-]*\/[^\s"')]+)\1\s*\)/gu;

/** Rewrites every literal `url(/scenes/<id>/<file>)` reference baked into a prepared node's
 * CSS declaration-list string (`projector.ts` bakes `background-image` this way) against the
 * published asset origin. Reuses `resolvePreparedAssetUrl` per address, so a filename missing
 * from the object's asset map still throws rather than serving a same-origin `/scenes/` URL. */
export function rewritePreparedStyleUrls(style: string, assetOrigin: PreparedAssetOrigin | null | undefined): string {
  if (!assetOrigin || !style) return style;
  return style.replace(STYLE_SCENE_URL, (_match, quote: string, address: string) =>
    `url(${quote}${resolvePreparedAssetUrl(address, assetOrigin)}${quote})`);
}

export function parsePreparedAssetOrigin(value: unknown): PreparedAssetOrigin | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Prepared asset origin must be an object.');
  const { origin, assets, groups, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length) throw new TypeError('Prepared asset origin has unsupported fields.');
  // https for a real host; http only for a loopback test origin (mirrors r2-cors.json's own local rules).
  if (typeof origin !== 'string' || !/^(?:https:\/\/[a-z0-9.-]+|http:\/\/127\.0\.0\.1:\d+)$/u.test(origin)) {
    throw new TypeError('Prepared asset origin must be an https URL (or a loopback http URL for local testing) with no path.');
  }
  if (groups !== undefined && (typeof groups !== 'string' || !/^\/objects\/[a-z][a-z0-9-]*\/asset-hashes\/$/u.test(groups)))
    throw new TypeError(`Prepared asset hash groups must be an /objects/<id>/asset-hashes/ directory, not ${JSON.stringify(groups)}.`);
  const withGroups = groups === undefined ? {} : { groups };
  if (assets === undefined) return Object.freeze({ origin, ...withGroups });
  return Object.freeze({ origin, assets: parseHashes(assets, 'Prepared asset origin map'), ...withGroups });
}

function parseHashes(value: unknown, owner: string): Readonly<Record<string, string>> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${owner} must be an object.`);
  const entries = Object.entries(value as Record<string, unknown>);
  for (const [filename, digest] of entries) {
    if (!filename || typeof digest !== 'string' || !SHA256.test(digest)) throw new TypeError(`${owner} has an invalid hash for ${filename}.`);
  }
  return Object.freeze(Object.fromEntries(entries)) as Readonly<Record<string, string>>;
}

export interface PreparedAssetResolver {
  /** The published URL of an address whose hash is present; throws otherwise. */
  url(address: string): string;
  /** Whether the address resolves now: it is not published, or its hash is present. */
  has(address: string): boolean;
  /** Makes the hash of a resource's address present, fetching its group once when the page did not embed it. */
  ensure(key: string, address: string): Promise<void>;
}

export function createPreparedAssetResolver(assetOrigin: PreparedAssetOrigin | null | undefined,
  readJson: (url: string) => Promise<unknown> = async url => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Prepared asset hash group ${url} answered ${response.status}.`);
    return response.json();
  }): PreparedAssetResolver {
  const hashes = new Map(Object.entries(assetOrigin?.assets ?? {})), loads = new Map<string, Promise<void>>();
  const filenameOf = (address: string) => SCENE_ADDRESS.exec(address)?.[1];
  return Object.freeze({
    url(address: string) {
      const filename = filenameOf(address);
      if (!assetOrigin || !filename) return address;
      const digest = hashes.get(filename);
      if (!digest) throw new Error(`No published asset hash for ${address}.`);
      return `${assetOrigin.origin}/runtime-assets/${digest}/${filename}`;
    },
    has(address: string) {
      const filename = filenameOf(address);
      return !assetOrigin || !filename || hashes.has(filename);
    },
    async ensure(key: string, address: string) {
      const filename = filenameOf(address);
      if (!assetOrigin || !filename || hashes.has(filename)) return;
      if (!assetOrigin.groups) throw new Error(`No published asset hash for ${address} (${key}), and the page names no hash groups.`);
      const group = preparedAssetGroup(key), url = `${assetOrigin.groups}${preparedAssetGroupFile(group)}`;
      let load = loads.get(url);
      if (!load) {
        load = readJson(url).then(value => { for (const [name, digest] of Object.entries(parseHashes(value, `Prepared asset hash group ${url}`))) hashes.set(name, digest); });
        loads.set(url, load);
        // A failed read is retried by the next demand rather than cached.
        load.catch(() => loads.delete(url));
      }
      await load;
      if (!hashes.has(filename)) throw new Error(`Prepared asset hash group ${url} does not list ${filename} (${key}).`);
    },
  });
}
