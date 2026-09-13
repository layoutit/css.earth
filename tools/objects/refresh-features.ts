// Refresh the named-feature catalogue of an already prepared object without re-preparing its surfaces: verify the
// authored source pins, re-run the shared feature attachment against the prepared runtime definition, and rewrite the
// catalogue, the runtime plan, the content document, the runtime asset manifest, the prepared provenance and the
// object descriptor. Usage: node tools/objects/dist/refresh-features.js <objectId> [...]
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseAuthoredObjectDescriptor } from '@cssearth/objects';
import { attachSurfaceFeatures, writeFeatureContent } from './surface-features/attach.js';
import { parseRuntimeManifest } from './operations.js';

/** Verify one authored source pin (path and SHA-256) and read its JSON value, as the preparation lanes do. */
async function verifiedSource(root: string, reference: { readonly id: string; readonly path: string; readonly sha256: string }) {
  const path = resolve(root, reference.path), bytes = await readFile(path);
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== reference.sha256) throw new TypeError(`Source ${reference.path} does not match its descriptor digest.`);
  return { reference, path, value: JSON.parse(bytes.toString('utf8')) as unknown };
}
const record = (value: unknown, label: string): Record<string, unknown> => { if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${label} must be an object.`); return value as Record<string, unknown>; };

export async function refreshObjectFeatures(id: string): Promise<{ count: number | null }> {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object id.');
  const objectDirectory = resolve('src/objects', id), sourceDirectory = resolve(objectDirectory, 'source'), outputDirectory = resolve(objectDirectory, 'prepared'), publicDirectory = resolve('public/scenes', id);
  const descriptor = parseAuthoredObjectDescriptor(JSON.parse(await readFile(resolve(objectDirectory, 'object.json'), 'utf8')) as unknown);
  if (!descriptor.recipe.features) return { count: null };
  const entries = await Promise.all(descriptor.recipe.sources.map(reference => verifiedSource(objectDirectory, reference)));
  const sources = new Map(entries.map(entry => [entry.reference.id, entry]));
  const definition = record(JSON.parse(await readFile(resolve(outputDirectory, 'runtime.json'), 'utf8')), 'prepared runtime');
  const attached = await attachSurfaceFeatures({ descriptor, sources, sourceDirectory, publicDirectory, outputDirectory, definition });
  if (!attached.features) throw new TypeError(`${id} declares features but attached none.`);
  await writeFeatureContent(outputDirectory, attached.features);
  await writeFile(resolve(outputDirectory, 'runtime.json'), `${JSON.stringify(attached.definition)}\n`);
  // Only the catalogue changed among the delivered assets: replace its entry in the existing runtime manifest.
  const manifestPath = resolve(objectDirectory, 'runtime-assets.json');
  const manifest = parseRuntimeManifest(JSON.parse(await readFile(manifestPath, 'utf8')), id);
  const catalogName = String(record(record(record(attached.definition, 'definition').features, 'features plan').catalog, 'catalog').url).split('/').at(-1)!;
  const bytes = await readFile(resolve(publicDirectory, catalogName));
  const entry = { filename: catalogName, bytes: bytes.byteLength, sha256: createHash('sha256').update(bytes).digest('hex') };
  const assets = manifest.assets.some(asset => asset.filename === catalogName) ? manifest.assets.map(asset => asset.filename === catalogName ? entry : asset) : [...manifest.assets, entry].sort((a, b) => a.filename.localeCompare(b.filename));
  const manifestText = `${JSON.stringify({ ...manifest, assets }, null, 2)}\n`;
  await writeFile(manifestPath, manifestText);
  // The prepared directory keeps the staged copy the provenance compiler reads first.
  await writeFile(resolve(outputDirectory, 'runtime-assets.json'), manifestText);
  const { prepareObjectProvenance } = await import(pathToFileURL(resolve(process.cwd(), 'tools/objects/provenance.mts')).href) as typeof import('./provenance.mts');
  // Feature preparation verified its own inputs above. The unchanged surfaces are reused from
  // their delivery pins, not rebaked: record recovered lineage instead of claiming a fresh
  // verification of every photographic source and terrain input in the object package.
  await prepareObjectProvenance({ objectDirectory, publicDirectory, outputDirectory, basis: 'recovered' });
  const writer = record(await import(pathToFileURL(resolve(process.cwd(), 'tools/prepare-object-json.mts')).href), 'prepared object writer');
  if (typeof writer.writeObjectJson !== 'function') throw new TypeError('Prepared object writer is missing.');
  await (writer.writeObjectJson as (objectId: string, runtime: Record<string, unknown>) => Promise<unknown>)(id, attached.definition as Record<string, unknown>);
  const plan = record(record(attached.definition, 'definition').features, 'features plan');
  return { count: Number(record(plan.catalog, 'catalog').count) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  for (const id of process.argv.slice(2)) {
    const result = await refreshObjectFeatures(id);
    console.log(JSON.stringify({ id, ...result }));
  }
}
