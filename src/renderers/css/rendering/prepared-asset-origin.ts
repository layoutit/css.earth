/** Runtime resolution of a prepared `/scenes/<id>/<file>` address to a published
 * `<origin>/runtime-assets/<sha256>/<file>` URL, mirroring `paging/city-index.ts`'s
 * `new URL(ref.url, plan.geometryOrigin)`: prepared data keeps its `/scenes/` address
 * unchanged, and only the value handed to a network read or a CSS `url()` is resolved. */
export interface PreparedAssetOrigin {
  readonly origin: string;
  readonly assets?: Readonly<Record<string, string>>;
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

export function parsePreparedAssetOrigin(value: unknown): PreparedAssetOrigin | undefined {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Prepared asset origin must be an object.');
  const { origin, assets, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length) throw new TypeError('Prepared asset origin has unsupported fields.');
  // https for a real host; http only for a loopback test origin (mirrors r2-cors.json's own local rules).
  if (typeof origin !== 'string' || !/^(?:https:\/\/[a-z0-9.-]+|http:\/\/127\.0\.0\.1:\d+)$/u.test(origin)) {
    throw new TypeError('Prepared asset origin must be an https URL (or a loopback http URL for local testing) with no path.');
  }
  if (assets === undefined) return Object.freeze({ origin });
  if (!assets || typeof assets !== 'object' || Array.isArray(assets)) throw new TypeError('Prepared asset origin map must be an object.');
  const entries = Object.entries(assets as Record<string, unknown>);
  for (const [filename, digest] of entries) {
    if (!filename || typeof digest !== 'string' || !SHA256.test(digest)) throw new TypeError(`Prepared asset origin map has an invalid hash for ${filename}.`);
  }
  return Object.freeze({ origin, assets: Object.freeze(Object.fromEntries(entries)) as Readonly<Record<string, string>> });
}
