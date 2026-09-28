/** A lens whose map covers mostly one side of its body turns the camera toward that side when a reader picks it, with the
 * rule the default camera uses (`prepareDefaultCameraAngles`): the design tilt, turned to face the centre of the data. Where
 * the data lies comes from the minimap step, which records each lens's coverage direction before its lossy encoding. A lens
 * whose recipe authors a focus keeps it: a focus chooses one region of scattered data and the zoom it needs (Europa's
 * Agenor terrain model), which coverage alone cannot. */
import { preparedControlPitch } from '@cssearth/engine';
import { isRecord } from '@cssearth/core';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SURFACE_FLY_TO } from '@cssearth/renderer/navigation/surface-fly-to.ts';
import type { Vector3 } from '@cssearth/renderer/solar-system/types.ts';
import { LOPSIDED_COVERAGE, prepareDefaultCameraAngles, type SolarGeometry } from '../scene/index.ts';

/** Each lens's recorded coverage direction in the surface map's frame (longitude 0 at the map's left edge). */
export async function readLensCoverages(objectDirectory: string): Promise<ReadonlyMap<string, Vector3>> {
  const path = resolve(objectDirectory, 'prepared/minimaps.json');
  let value: unknown;
  try { value = JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (isRecord(error) && error.code === 'ENOENT') return new Map(); throw error; }
  if (!isRecord(value) || !Array.isArray(value.images)) throw new TypeError(`${path}: minimaps.json lists no images.`);
  const coverages = new Map<string, Vector3>();
  for (const image of value.images) {
    if (!isRecord(image) || typeof image.id !== 'string') throw new TypeError(`${path}: a minimap has no id.`);
    if (image.coverage === undefined) continue;
    const coverage = image.coverage;
    if (!Array.isArray(coverage) || coverage.length !== 3 || !coverage.every(Number.isFinite) || Math.hypot(...coverage) > 1)
      throw new TypeError(`${path}: minimap ${image.id} coverage is ${JSON.stringify(coverage)}, not a direction of length at most 1.`);
    coverages.set(image.id, coverage as unknown as Vector3);
  }
  return coverages;
}

interface FacingCamera { readonly maximumZoom: number; readonly defaultZoom: number; readonly maximumControlPitchDegrees: number; readonly maximumScenePitchDegrees: number }

/** The lenses whose camera a recipe authors: a terrestrial lens's `focus` and a composite presentation's `lensFocus`. */
export function authoredFocusLenses(terrestrial: unknown, presentation: unknown): ReadonlySet<string> {
  const lenses = new Set<string>();
  const raster = isRecord(terrestrial) && isRecord(terrestrial.raster) ? terrestrial.raster : {};
  for (const kind of ['observations', 'scientific', 'observedColors', 'surfaceObservations'])
    for (const lens of Array.isArray(raster[kind]) ? raster[kind] : []) if (isRecord(lens) && lens.focus !== undefined && typeof lens.id === 'string') lenses.add(lens.id);
  if (isRecord(presentation) && isRecord(presentation.lensFocus)) for (const lens of Object.keys(presentation.lensFocus)) lenses.add(lens);
  return lenses;
}

/** The definition with every lens camera that no recipe authors set from the lens's coverage: a turn toward a lopsided map's
 * data at the reader's current zoom, and none for a map that covers its body evenly. Recomputed on every run, so a camera
 * this stage wrote before never outlives a change of coverage. An authored camera and every zoom limit are kept. */
export function faceLensData<T extends object>(definition: T, { geometry, bodyId, mapLeftEdgeLongitudeDeg, camera, coverages, authored }:
  { geometry: SolarGeometry; bodyId: string; mapLeftEdgeLongitudeDeg: number; camera: FacingCamera; coverages: ReadonlyMap<string, Vector3>; authored: ReadonlySet<string> }): T {
  if (!('variants' in definition) || !Array.isArray(definition.variants)) return definition;
  const turn = mapLeftEdgeLongitudeDeg * Math.PI / 180, cos = Math.cos(turn), sin = Math.sin(turn);
  const facings = new Map([...coverages].filter(([, coverage]) => Math.hypot(...coverage) >= LOPSIDED_COVERAGE).map(([lens, [x, y, z]]) => {
    const angles = prepareDefaultCameraAngles(geometry, bodyId, { coverage: [x * cos - y * sin, x * sin + y * cos, z] as unknown as Vector3 });
    return [lens, { controlPitch: preparedControlPitch(angles.initialScenePitchDegrees, camera), controlYaw: angles.defaultControlYawDegrees,
      zoom: camera.defaultZoom, transition: { durationMilliseconds: SURFACE_FLY_TO.durationMilliseconds, preserveZoom: true } }] as const;
  }));
  const variants = definition.variants.map((variant: unknown) => {
    if (!isRecord(variant) || !isRecord(variant.when)) throw new TypeError(`${bodyId}: a presentation variant has no selection.`);
    const lens = variant.when.lensId, facing = typeof lens === 'string' ? facings.get(lens) : undefined;
    const navigation = isRecord(variant.navigation) ? variant.navigation : undefined;
    if (typeof lens === 'string' && authored.has(lens) || !facing && !navigation?.camera) return variant;
    const maximumZoom = typeof navigation?.maximumZoom === 'number' ? navigation.maximumZoom : camera.maximumZoom;
    return { ...variant, navigation: { ...navigation, maximumZoom, camera: facing ?? null } };
  });
  return Object.assign({}, definition, { variants });
}

