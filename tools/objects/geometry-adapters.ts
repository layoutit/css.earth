import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { PhysicalScene, ScenePreparationAdapters, SolarSceneSource } from '../../src/renderers/css/preparation/scene/index.js';

type Module = Record<string, unknown>;
function record(value: unknown, at: string): Module { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${at} is invalid.`); return value as Module; }
function callable<T>(value: unknown, at: string): T { if (typeof value !== 'function') throw new TypeError(`${at} is missing.`); return value as T; }
async function load(path: string): Promise<Module> { return record(await import(path), path); }
function direction(value: unknown, at: string): [number, number, number] { if (!Array.isArray(value) || value.length !== 3 || value.some(item => typeof item !== 'number' || !Number.isFinite(item))) throw new TypeError(`${at} must be a finite vector.`); return [value[0], value[1], value[2]]; }

/** Typed bridge to physical preparation until its shared helpers are TypeScript. */
export async function loadGeometryAdapters(): Promise<ScenePreparationAdapters> {
  const root = process.cwd(), path = (value: string): string => pathToFileURL(resolve(root, value)).href;
  const [scene, geometry] = await Promise.all([load(path('tools/objects/solar-system-scene.mjs')), load(path('src/platform/solar-geometry.mjs'))]);
  const preparePhysical = callable<(input: SolarSceneSource & { readonly starfield: Record<string, unknown>; readonly sun: Record<string, unknown> }) => Promise<PhysicalScene>>(scene.prepareSolarSystemScene, 'prepareSolarSystemScene');
  const bodyFixedSun = callable<(id: string) => unknown>(geometry.requireBodyFixedSunDirection, 'requireBodyFixedSunDirection');
  const sunPresentation = callable<(source: SolarSceneSource) => unknown>(scene.prepareSolarSystemSunPresentation, 'prepareSolarSystemSunPresentation');
  return { preparePhysicalScene: preparePhysical, bodyFixedSunDirection: id => direction(bodyFixedSun(id), 'body-fixed Sun direction'), sunReferenceViewDirection: source => direction(record(sunPresentation(source), 'Sun presentation').referenceViewDirection, 'Sun reference view direction') };
}
