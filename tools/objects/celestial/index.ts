import { sha256 } from '../../../src/platform/sha256.mts';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadCelestialAdapters, type SolarSource, type StarfieldPlan, type SunPlan } from './adapters.js';

export interface CelestialConfig {
  readonly schema: 'cssearth-celestial-preparation@2'; readonly sources: readonly string[];
  /** False for a star: no directional Sun is prepared and sun.json is written as null. */
  readonly directionalSun: boolean;
}
export interface CelestialContext { readonly sourceDirectory: string; readonly publicDirectory: string; readonly outputDirectory: string; readonly config: unknown; }
export interface CelestialAssets { readonly sky: StarfieldPlan; readonly sun: SunPlan | null; }
const schema = 'cssearth-celestial-preparation@2';
const sourceDigest = /^[a-f0-9]{64}$/;
type Input = Record<string, unknown>;

function record(value: unknown, at: string): Input { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${at} must be an object.`); return value as Input; }
function json<T>(value: T): T { return JSON.parse(JSON.stringify(value)) as T; }
function relativePath(value: unknown, at: string): string { if (typeof value !== 'string' || !value || value.startsWith('/') || value.split('/').includes('..')) throw new TypeError(`${at} must be a relative path.`); return value; }
function profile(value: unknown): CelestialConfig {
  const input = record(value, 'celestial profile');
  if (input.schema !== schema || !Array.isArray(input.sources) || !input.sources.length || Object.keys(input).some(key => !['schema', 'sources', 'directionalSun'].includes(key))) throw new TypeError('Celestial profile is invalid.');
  if (input.directionalSun !== undefined && typeof input.directionalSun !== 'boolean') throw new TypeError('Celestial profile directionalSun must be boolean.');
  return Object.freeze({ schema, sources: Object.freeze(input.sources.map((source, index) => relativePath(source, `celestial profile.sources[${index}]`))),
    directionalSun: input.directionalSun ?? true });
}
async function verifySources(sourceDirectory: string, paths: readonly string[]): Promise<void> {
  const manifest = record(JSON.parse(await readFile(resolve(sourceDirectory, 'manifest.json'), 'utf8')), 'source manifest');
  if (!Array.isArray(manifest.inputs)) throw new TypeError('Source manifest inputs are invalid.');
  const known = new Set(manifest.inputs.map(item => record(item, 'source manifest input').path));
  for (const path of paths) {
    if (!known.has(path)) throw new TypeError(`Celestial source ${path} is not declared in the source manifest.`);
    await readFile(resolve(sourceDirectory, path));
  }
}
function solarSource(value: unknown): SolarSource { const source = record(value, 'solar-system source'); if (typeof source.bodyId !== 'string' || typeof source.displayName !== 'string') throw new TypeError('Solar-system source is invalid.'); return Object.freeze({ bodyId: source.bodyId, displayName: source.displayName }); }

/** Prepare the sky orientation and directional Sun into renderer-neutral JSON. The shared universe draws both. */
export async function prepareCelestialAssets({ sourceDirectory, publicDirectory, outputDirectory, config }: CelestialContext): Promise<CelestialAssets> {
  if (typeof sourceDirectory !== 'string' || typeof publicDirectory !== 'string' || typeof outputDirectory !== 'string') throw new TypeError('Celestial preparation needs source, public, and output directories.');
  const options = profile(config); await verifySources(sourceDirectory, options.sources);
  const solar = solarSource(JSON.parse(await readFile(resolve(sourceDirectory, 'presentation/solar-system.json'), 'utf8'))); const api = await loadCelestialAdapters(); api.requireSceneObject(solar.bodyId);
  await mkdir(outputDirectory, { recursive: true });
  const sky = json(api.prepareCubicSky({ objectId: solar.bodyId, cameraContract: api.cubicSkyCamera }));
  // A star has no directional Sun; sun.json records null so the runtime contract sees the absence explicitly.
  const sun = options.directionalSun ? json(api.prepareDirectionalSun({ presentation: api.prepareSolarSystemSunPresentation(solar) })) : null;
  await Promise.all([writeFile(resolve(outputDirectory, 'sky.json'), `${JSON.stringify(sky)}\n`), writeFile(resolve(outputDirectory, 'sun.json'), `${JSON.stringify(sun)}\n`)]);
  return Object.freeze({ sky, sun });
}
