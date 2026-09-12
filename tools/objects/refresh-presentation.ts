// Recompile the retained presentation of an already prepared object without re-preparing its surfaces: read the
// authored presentation profile and the prepared inputs the compiler consumes, compile the retained tree, variants,
// resource pools and prepared layer levels again, and rewrite the runtime plan, its shared twin, the page metadata and
// the object descriptor pin. The surface rasters, their manifest and the provenance record are left as prepared.
// Usage: node tools/objects/dist/refresh-presentation.js <objectId> [...]
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parsePresentationProfile, prepareCssPresentation, type PresentationInputs } from '../../src/renderers/css/preparation/presentation/index.js';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const record = (value: unknown, label: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new TypeError(`${label} must be an object.`);
  return value;
};
/** The shared writer owns the runtime plan, its twin, the page and the pin. */
async function writePrepared(id: string, definition: Record<string, unknown>): Promise<void> {
  const writer = record(await import(pathToFileURL(resolve(process.cwd(), 'tools/prepare-object-json.mts')).href), 'prepared object writer');
  if (typeof writer.writeObjectJson !== 'function') throw new TypeError('Prepared object writer is missing.');
  await (writer.writeObjectJson as (objectId: string, runtime: Record<string, unknown>) => Promise<unknown>)(id, definition);
}
async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown;
}
async function readOptionalJson(path: string): Promise<unknown> {
  try { return await readJson(path); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; }
}

/** The layered lane keeps its own compiler; its inputs are checked in too. It is
 * loaded by runtime URL, as the authored lane loads it: its declaration reads run
 * through a browser, which does not belong in this tool's bundle. */
async function compileLayered(objectDirectory: string, id: string, profileValue: unknown): Promise<Record<string, unknown>> {
  const lane = async <T>(path: string): Promise<T> =>
    await import(pathToFileURL(resolve(process.cwd(), path)).href) as T;
  const { prepareBandedEllipsoid } = await lane<typeof import('./giant-layers/geometry.mts')>('tools/objects/giant-layers/geometry.mts');
  const { prepareLayeredSurfacePresentation } = await lane<typeof import('./giant-layers/presentation.mts')>('tools/objects/giant-layers/presentation.mts');
  const { validatePreparedCubicSky } = await lane<typeof import('../../src/platform/cubic-sky-contract.mts')>('src/platform/cubic-sky-contract.mts');
  const { validateDirectionalSunPlan } = await lane<typeof import('../../src/platform/directional-sun-contract.mts')>('src/platform/directional-sun-contract.mts');
  const read = (path: string) => readJson(resolve(objectDirectory, path));
  const geometryConfig = await read('source/preparation/geometry.json');
  const [observationConfig, materialConfig, sky, sun] = await Promise.all([
    read('source/preparation/observations.json'), read('source/preparation/materials.json'),
    read('prepared/sky.json'), read('prepared/sun.json'),
  ]);
  const checkedSky = validatePreparedCubicSky(sky, { requireSun: false }), checkedSun = validateDirectionalSunPlan(sun);
  const raw = await prepareLayeredSurfacePresentation({ config: profileValue, geometryConfig,
    geometry: prepareBandedEllipsoid(geometryConfig), observationConfig, materialConfig,
    sky: checkedSky, sun: checkedSun });
  // The lane appends the focused heliocentric view after its compiler. That step
  // reads the prepared sky and Sun and writes one deterministic marker atlas, so
  // it runs here too rather than leaving the view without its resources.
  const { prepareFocusedHeliocentricPresentation, appendFocusedHeliocentricPresentation } =
    await lane<typeof import('./focused-heliocentric.mts')>('tools/objects/focused-heliocentric.mts');
  const { parseAuthoredObjectDescriptor } = await import('@cssearth/objects');
  const descriptor = parseAuthoredObjectDescriptor(await readJson(resolve(objectDirectory, 'object.json')));
  const shape = record(geometryConfig, 'banded geometry').shape;
  const focus = await prepareFocusedHeliocentricPresentation({ bodyId: id,
    publicDirectory: resolve('public/scenes', id), publicBase: `/scenes/${id}/`,
    bodyRadiusUnits: Number(record(shape, 'geometry shape').equatorialRadius),
    bodyRadiusKilometers: descriptor.recipe.shape.radiusKm, sky: checkedSky, sun: checkedSun });
  const compiled = appendFocusedHeliocentricPresentation(raw, focus);
  return { ...(compiled as unknown as Record<string, unknown>), id,
    controls: await read('prepared/controls.json') };
}

export async function refreshObjectPresentation(id: string): Promise<{ mode: string | null }> {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object id.');
  const objectDirectory = resolve('src/planets', id), preparedDirectory = resolve(objectDirectory, 'prepared');
  const profileValue = await readOptionalJson(resolve(objectDirectory, 'source/preparation/presentation.json'));
  // Only a body whose presentation a compiler owns carries this profile.
  if (profileValue === undefined) return { mode: null };
  if (isRecord(profileValue) && profileValue.schema === 'cssearth-layered-surface-presentation@1') {
    const prepared = record(await readJson(resolve(preparedDirectory, 'runtime.json')), 'prepared runtime');
    const compiled = await compileLayered(objectDirectory, id, profileValue);
    // This lane's checked-in camera projection and heliocentric view no longer
    // reproduce from its own source (its parity test fails on an unmodified
    // checkout), so keep the prepared ones and replace only what a level moves.
    await writePrepared(id, { ...prepared, ...compiled, schema: prepared.schema,
      camera: prepared.camera, heliocentricView: prepared.heliocentricView });
    return { mode: 'layered-surface' };
  }
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
  await writePrepared(id, { ...prepared, ...(compiled as unknown as Record<string, unknown>) });
  return { mode: profile.mode };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  for (const id of process.argv.slice(2)) {
    const result = await refreshObjectPresentation(id);
    console.log(JSON.stringify({ id, ...result }));
  }
}
