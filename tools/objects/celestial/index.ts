import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadCelestialAdapters, type MarkerPlan, type SolarSource, type StarfieldPlan, type SunPlan } from './adapters.js';

export interface CelestialConfig { readonly schema: 'cssearth-celestial-preparation@1'; readonly catalogueSchema: string; readonly sources: readonly string[]; }
export interface CelestialContext { readonly sourceDirectory: string; readonly publicDirectory: string; readonly outputDirectory: string; readonly config: unknown; }
export interface CelestialAssets { readonly sky: StarfieldPlan; readonly sun: SunPlan; readonly markers: MarkerPlan; }
const schema = 'cssearth-celestial-preparation@1';
const sourceDigest = /^[a-f0-9]{64}$/;
type Input = Record<string, unknown>;

function record(value: unknown, at: string): Input { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${at} must be an object.`); return value as Input; }
function json<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function relativePath(value: unknown, at: string): string { if (typeof value !== 'string' || !value || value.startsWith('/') || value.split('/').includes('..')) throw new TypeError(`${at} must be a relative path.`); return value; }
function profile(value: unknown): CelestialConfig {
  const input = record(value, 'celestial profile');
  if (input.schema !== schema || typeof input.catalogueSchema !== 'string' || !input.catalogueSchema || !Array.isArray(input.sources) || !input.sources.length || Object.keys(input).some(key => !['schema', 'catalogueSchema', 'sources'].includes(key))) throw new TypeError('Celestial profile is invalid.');
  return Object.freeze({ schema, catalogueSchema: input.catalogueSchema, sources: Object.freeze(input.sources.map((source, index) => relativePath(source, `celestial profile.sources[${index}]`))) });
}
async function verifySources(sourceDirectory: string, paths: readonly string[]): Promise<void> {
  const manifest = record(JSON.parse(await readFile(resolve(sourceDirectory, 'manifest.json'), 'utf8')), 'source manifest');
  if (!Array.isArray(manifest.inputs)) throw new TypeError('Source manifest inputs are invalid.');
  const known = new Map(manifest.inputs.map(item => { const input = record(item, 'source manifest input'); return [input.path, input.expectedSha256]; }));
  for (const path of paths) { const expected = known.get(path); if (typeof expected !== 'string' || !sourceDigest.test(expected)) throw new TypeError(`Celestial source ${path} is not pinned in the source manifest.`); const bytes = await readFile(resolve(sourceDirectory, path)); if (createHash('sha256').update(bytes).digest('hex') !== expected) throw new TypeError(`Celestial source ${path} changed from its pinned digest.`); }
}
function solarSource(value: unknown): SolarSource { const source = record(value, 'solar-system source'); if (typeof source.bodyId !== 'string' || typeof source.displayName !== 'string' || source.markerStrip === undefined) throw new TypeError('Solar-system source is invalid.'); return Object.freeze({ bodyId: source.bodyId, displayName: source.displayName, markerStrip: source.markerStrip }); }

/** Prepare starfield, directional Sun, and marker-strip data into renderer-neutral JSON. */
export async function prepareCelestialAssets({ sourceDirectory, publicDirectory, outputDirectory, config }: CelestialContext): Promise<CelestialAssets> {
  if (typeof sourceDirectory !== 'string' || typeof publicDirectory !== 'string' || typeof outputDirectory !== 'string') throw new TypeError('Celestial preparation needs source, public, and output directories.');
  const options = profile(config); await verifySources(sourceDirectory, options.sources);
  const solar = solarSource(JSON.parse(await readFile(resolve(sourceDirectory, 'presentation/solar-system.json'), 'utf8'))); const api = await loadCelestialAdapters(); const body = api.requireObject(solar.bodyId);
  await Promise.all([mkdir(publicDirectory, { recursive: true }), mkdir(outputDirectory, { recursive: true })]);
  {
    const sky = json(await api.preparePlanetCubicSky({ objectId: solar.bodyId, sourceRoot: sourceDirectory, publicRoot: publicDirectory, ensureDirectories: () => mkdir(publicDirectory, { recursive: true }), validateSourceGroup: async () => undefined, includeSun: false, cameraContract: api.cubicSkyCamera, pointSourceContract: api.cubicSkyPoints, astrometricSampling: api.prepareAstrometricCubeSampling(), catalogueStars: await api.prepareCatalogueStars({ fovDegrees: api.cubicSkyCamera.horizontalFovDegrees }), sourceSchema: options.catalogueSchema, writeModule: false }));
    const sun = json(await api.preparePlanetDirectionalSun({ objectId: solar.bodyId, publicRoot: publicDirectory, ensureDirectories: () => mkdir(publicDirectory, { recursive: true }), meanHeliocentricDistanceAu: body.distanceAu, presentation: api.prepareSolarSystemSunPresentation(solar), writeModule: false }));
    const preparedMarkers = await api.prepareSolarSystemMarkerStrip(solar.markerStrip), markers = json(preparedMarkers.plan), assets = preparedMarkers.assets; for (const asset of assets) await writeFile(resolve(publicDirectory, asset.url.split('/').at(-1) ?? ''), asset.bytes);
    await Promise.all([writeFile(resolve(outputDirectory, 'sky.json'), `${JSON.stringify(sky)}\n`), writeFile(resolve(outputDirectory, 'sun.json'), `${JSON.stringify(sun)}\n`), writeFile(resolve(outputDirectory, 'markers.json'), `${JSON.stringify(markers)}\n`)]);
    return Object.freeze({ sky, sun, markers });
  }
}
