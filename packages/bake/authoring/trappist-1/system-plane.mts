/**
 * One prepared picture on the plane of a hosted system's orbits: what the system datasets of TRAPPIST-1 share. The plane
 * is the mean of the planets' orbit planes as the world draws them, through the star's world position, so the world step
 * runs first.
 */
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { hostedPlanetStateRelativeKm, type HostedPlanetId } from '@cssearth/astronomy';
import { GALAXY_BACKING_SCHEMA, OBJECT_SCHEMA, parseDensityVolumeFrame, parseGalaxyBacking, type VolumeSliceQuad } from '@cssearth/objects';
import { inventoryPreparedAssets } from '@cssearth/objects/node';
import { compilePlaneLeaf } from '@cssearth/bake/volume-leaves';

type Vector3 = [number, number, number];
export const AU_M = 149597870700;

export interface SystemOrbitPlane {
  readonly referenceFrame: string;
  readonly epochJdTt: number;
  /** The star's world position. */
  readonly originM: Vector3;
  /** The rotation whose columns are the plane's x, y and normal, as a unit quaternion (local to reference). */
  readonly localToReferenceXyzw: [number, number, number, number];
  /** How far the orbits' normals lie from the plane's, and the planets from the plane, at most. */
  readonly spreadDegrees: number;
  readonly offPlaneDegrees: number;
}

/** The mean plane of `planets`' orbits about `host`, each orbit's normal the cross product of its position and velocity. */
export async function systemOrbitPlane(root: string, host: string, planets: readonly string[]): Promise<SystemOrbitPlane> {
  // The world's frame and the star's place in it, as the world step prepared them.
  const world = requireRecord(JSON.parse(await readFile(resolve(root, 'src/objects/observable-universe/prepared/world-context.json'), 'utf8')));
  const worldFrame = requireRecord(world.frame), bodies = [requireRecord(world.focus), ...requireArray(world.bodies).map(body => requireRecord(body))];
  const placeOf = (body: string) => {
    const found = bodies.find(candidate => candidate.id === body);
    if (!found) throw new TypeError(`The prepared world holds no ${body}; run the world step first.`);
    return requireArray(found.positionM).map(value => requireFiniteNumber(value)) as Vector3;
  };
  const originM = placeOf(host), epochJdTt = requireFiniteNumber(worldFrame.epochJdTt);

  const cross = (a: Vector3, b: Vector3): Vector3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const unit = (v: Vector3): Vector3 => { const length = Math.hypot(...v); return [v[0] / length, v[1] / length, v[2] / length]; };
  const dot = (a: Vector3, b: Vector3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const normals = planets.map(planet => {
    const state = hostedPlanetStateRelativeKm(planet as HostedPlanetId, epochJdTt);
    if (state.hostId !== host) throw new TypeError(`${planet} orbits ${state.hostId}, not ${host}.`);
    return unit(cross([...state.positionKm] as Vector3, [...state.velocityKmPerDay] as Vector3));
  });
  const z = unit([0, 1, 2].map(axis => normals.reduce((sum, normal) => sum + normal[axis]!, 0)) as Vector3);
  const spreadDegrees = Math.max(...normals.map(normal => Math.acos(Math.min(1, dot(normal, z))) * 180 / Math.PI));
  // The plane's x: the first planet's direction, taken into the plane.
  const toward = placeOf(planets[0]!).map((value, axis) => value - originM[axis]!) as Vector3, along = dot(toward, z);
  const x = unit(toward.map((value, axis) => value - along * z[axis]!) as Vector3), y = cross(z, x);
  const offPlaneDegrees = Math.max(...planets.map(planet => {
    const from = placeOf(planet).map((value, axis) => value - originM[axis]!) as Vector3;
    return Math.abs(Math.asin(dot(from, z) / Math.hypot(...from))) * 180 / Math.PI;
  }));
  if (!(offPlaneDegrees < 1)) throw new TypeError(`A planet stands ${offPlaneDegrees.toFixed(2)} degrees off the plane; the plane is not the planets'.`);
  const trace = x[0] + y[1] + z[2];
  const localToReferenceXyzw = ((): [number, number, number, number] => {
    if (trace > 0) { const s = 2 * Math.sqrt(trace + 1); return [(y[2] - z[1]) / s, (z[0] - x[2]) / s, (x[1] - y[0]) / s, s / 4]; }
    if (x[0] > y[1] && x[0] > z[2]) { const s = 2 * Math.sqrt(1 + x[0] - y[1] - z[2]); return [s / 4, (y[0] + x[1]) / s, (z[0] + x[2]) / s, (y[2] - z[1]) / s]; }
    if (y[1] > z[2]) { const s = 2 * Math.sqrt(1 + y[1] - x[0] - z[2]); return [(y[0] + x[1]) / s, s / 4, (z[1] + y[2]) / s, (z[0] - x[2]) / s]; }
    const s = 2 * Math.sqrt(1 + z[2] - x[0] - y[1]); return [(z[0] + x[2]) / s, (z[1] + y[2]) / s, s / 4, (x[1] - y[0]) / s];
  })();
  return { referenceFrame: requireString(worldFrame.referenceFrame), epochJdTt, originM, localToReferenceXyzw, spreadDegrees, offPlaneDegrees };
}

export interface PlaneBankPicture {
  readonly id: string;
  readonly objectDirectory: string;
  readonly host: string;
  /** The recipe's path under the object's directory. */
  readonly recipe: string;
  readonly plane: SystemOrbitPlane;
  /** The square picture: its file under `prepared/`, its side in pixels, and the share of it that is not empty. */
  readonly texturePath: string;
  readonly webp: Buffer;
  readonly sizePx: number;
  readonly alphaCoverage: number;
  /** The radius, in pixels and in metres, of the circle that is ten frame units from the star. */
  readonly outerRadiusPx: number;
  readonly outerRadiusM: number;
  readonly source: string;
  readonly meaning: string;
  /** The camera distances from the star, in metres, between which the plane fades out as the camera nears. */
  readonly centreFadeM: readonly number[];
  /** The opacity the orbit lines take while the plane shows whole; left out, they keep theirs. */
  readonly orbitOpacity?: number;
}

/** Write a plane bank's descriptor, prepared plane, picture and inventory. */
export async function writePlaneBank(bank: PlaneBankPicture): Promise<void> {
  const { id, objectDirectory, plane } = bank, prepared = resolve(objectDirectory, 'prepared');
  // One frame unit is a tenth of the outer distance; the picture's half side reaches a little past it, as its margin does.
  const half = 10 * (bank.sizePx / 2) / bank.outerRadiusPx;
  const frame = parseDensityVolumeFrame({ referenceFrame: plane.referenceFrame, epochJdTt: plane.epochJdTt, originM: plane.originM,
    localToReferenceXyzw: plane.localToReferenceXyzw, metersPerUnit: bank.outerRadiusM / 10, boundsUnits: { min: [-half, -half, -half / 100], max: [half, half, half / 100] } });
  const quad: VolumeSliceQuad = { id, axis: 'z', sliceIndex: 0, texturePath: bank.texturePath, widthPx: bank.sizePx, heightPx: bank.sizePx,
    vertices: [[-half, half, 0], [half, half, 0], [half, -half, 0], [-half, -half, 0]], uvs: [[0, 0], [1, 0], [1, 1], [0, 1]], center: [0, 0, 0], normal: [0, 0, 1],
    bytes: bank.webp.length, alphaCoverage: bank.alphaCoverage };
  const leaf = compilePlaneLeaf(id, frame, quad);
  const backing = { schema: GALAXY_BACKING_SCHEMA, id, source: bank.source, meaning: bank.meaning, frame,
    leaf: { texturePath: leaf.texturePath, style: leaf.style }, centreFadeM: bank.centreFadeM };
  parseGalaxyBacking(backing, `${id}/prepared/plane.json`);

  await rm(prepared, { recursive: true, force: true });
  await mkdir(dirname(resolve(prepared, bank.texturePath)), { recursive: true });
  await writeFile(resolve(prepared, bank.texturePath), bank.webp);
  await writeFile(resolve(prepared, 'plane.json'), `${JSON.stringify(backing)}\n`);
  await writeFile(resolve(objectDirectory, 'object.json'), `${JSON.stringify({ schema: OBJECT_SCHEMA, id, type: 'plane-bank',
    properties: { preparation: { source: bank.recipe }, host: bank.host, frame, ...(bank.orbitOpacity === undefined ? {} : { orbitOpacity: bank.orbitOpacity }) }, prepared: { format: GALAXY_BACKING_SCHEMA, url: 'prepared/plane.json' } }, null, 2)}\n`);
  await inventoryPreparedAssets({ objectId: id, objectDirectory });
}
