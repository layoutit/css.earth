// Recompile the retained presentation of an already prepared object without re-preparing its surfaces: read the
// authored presentation profile and the prepared inputs the compiler consumes, compile the retained tree, variants,
// resource pools and prepared layer levels again, and rewrite the runtime plan, its shared twin, the page metadata and
// the object descriptor pin. The surface rasters, their manifest and the provenance record are left as prepared.
// Usage: node tools/objects/dist/refresh-presentation.js <objectId> [...]
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parsePresentationProfile, prepareCssPresentation, type PresentationInputs } from '../../src/renderers/css/preparation/presentation/index.js';

const record = (value: unknown, label: string): Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new TypeError(`${label} must be an object.`);
  return value as Record<string, unknown>;
};
async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}
async function readOptionalJson(path: string): Promise<unknown> {
  try { return await readJson(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}

export async function refreshObjectPresentation(id: string): Promise<{ mode: string | null }> {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object id.');
  const objectDirectory = resolve('src/planets', id), preparedDirectory = resolve(objectDirectory, 'prepared');
  const profileValue = await readOptionalJson(resolve(objectDirectory, 'source/preparation/presentation.json'));
  // Only the bodies the in-renderer compiler owns carry this profile.
  if (profileValue === undefined) return { mode: null };
  const profile = parsePresentationProfile(profileValue);
  const [scene, assets, lenses, sun, markers, controls, solarSource] = await Promise.all([
    readJson(resolve(preparedDirectory, 'scene.json')),
    readJson(resolve(preparedDirectory, 'assets.json')),
    readJson(resolve(preparedDirectory, 'lenses.json')),
    readOptionalJson(resolve(preparedDirectory, 'sun.json')),
    readOptionalJson(resolve(preparedDirectory, 'markers.json')),
    readJson(resolve(preparedDirectory, 'controls.json')),
    readJson(resolve(objectDirectory, 'source/presentation/solar-system.json')),
  ]);
  const compiled = await prepareCssPresentation({
    namespace: profile.namespace, mode: profile.mode,
    ...(profile.lensFocus ? { lensFocus: profile.lensFocus } : {}),
    ...(profile.textureLevels === undefined ? {} : { textureLevels: profile.textureLevels }),
    scene: scene as PresentationInputs['scene'], assets: assets as PresentationInputs['assets'],
    lenses: lenses as PresentationInputs['lenses'], sun: (sun ?? null) as PresentationInputs['sun'],
    ...(markers === undefined ? {} : { markers: markers as PresentationInputs['markers'] }),
    controls: controls as PresentationInputs['controls'], solarSource: solarSource as PresentationInputs['solarSource'],
  });
  // The lane attaches named features and world motion to the plan after the
  // compiler runs; keep those and replace only what the compiler owns.
  const prepared = record(await readJson(resolve(preparedDirectory, 'runtime.json')), 'prepared runtime');
  const definition = { ...prepared, ...(compiled as unknown as Record<string, unknown>) };
  const writer = record(await import(pathToFileURL(resolve(process.cwd(), 'tools/prepare-object-json.mts')).href), 'prepared object writer');
  if (typeof writer.writeObjectJson !== 'function') throw new TypeError('Prepared object writer is missing.');
  await (writer.writeObjectJson as (objectId: string, runtime: Record<string, unknown>) => Promise<unknown>)(id, definition);
  return { mode: profile.mode };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  for (const id of process.argv.slice(2)) {
    const result = await refreshObjectPresentation(id);
    console.log(JSON.stringify({ id, ...result }));
  }
}
