#!/usr/bin/env node
/**
 * Which apparitions a survey lens can cast, and what each would add.
 *
 *   node packages/bake/cli/sphere-survey-apparitions.mts [object-id …]   audit every shipped survey lens, or the ones named
 *
 * Deconvolved frames carry no calibrated level, so the level fit places an apparition only through surface it shares with
 * another at moderate angles (`observingSeasons` in the controlled-camera format). Whether it can is decided here from
 * geometry, before any pixel is read: each released frame's view of the lens mesh, from the release's rotation record and
 * JPL Horizons at the start its file name states, and for frames of different apparitions the surface both see within the
 * fit's angle limit, counted in the display samples the fit compares. An apparition joins the lens when one of its frames
 * shares at least the fit's minimum pair count with a frame the lens already casts; the fit then decides from the pixels.
 *
 * The audit runs the same geometry for the lenses in the repository with the Sun limits the lens photometry states, and
 * reports each apparition's share of the surface and what it adds. A face counts when its centre faces the camera and the
 * Sun within the limits and nothing hides it from the camera; the prepared lens's measured coverage is printed beside the
 * model's for the frames it casts, as the model's check.
 */
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { horizonsCommand, loadOrientation, parseObserverCameras, radialTerrainForLens } from '@cssearth/bake/objects/layers/terrestrial';
import { loadCameraShape } from '@cssearth/bake/objects/geometry';
import { apparitionLinks, apparitions, bodyDirection, coveredShare, listedViews, meshFaces, releasedFrames, seenFaces, type LamFrame } from '@cssearth/bake/objects/sphere-survey';

const ROOT = resolve(import.meta.dirname, '../../..');
type Mesh = Parameters<typeof meshFaces>[0];

/** One shipped lens's apparitions: what the frames it casts cover, and what each apparition would add and share. */
async function auditLens(objectId: string) {
  const source = resolve(ROOT, 'src/objects', objectId, 'source'), downloads = resolve(ROOT, 'output/sphere-survey', objectId, 'downloads');
  const recipe = requireRecord(JSON.parse(await readFile(resolve(source, 'preparation/terrestrial.json'), 'utf8')));
  const lens = requireArray(requireRecord(recipe.raster).surfaceObservations).map(value => requireRecord(value)).find(entry => entry.id === 'zimpol');
  if (!lens) throw new Error(`${objectId} has no survey lens.`);
  const record = parseObserverCameras(JSON.parse(await readFile(resolve(source, 'preparation/observer-cameras.json'), 'utf8')));
  const command = horizonsCommand(JSON.parse(await readFile(resolve(ROOT, 'packages/astronomy/data/bodies', `${objectId}.json`), 'utf8')));
  const stated = new Map(requireArray(lens.frames).map(value => requireRecord(value)).map(frame => [requireString(frame.path), frame]));
  // The release's listing is the folder the lens's own frames were pinned from.
  const inputs = requireArray(requireRecord(JSON.parse(await readFile(resolve(source, 'manifest.json'), 'utf8'))).inputs).map(value => requireRecord(value));
  const origin = inputs.find(input => stated.has(requireString(input.path)))?.origin;
  if (typeof origin !== 'string') throw new Error(`${objectId}: the manifest pins no origin for the lens's frames.`);
  const released = await releasedFrames(new URL('./', origin).href, downloads), orientation = await loadOrientation(source, record.rotation, ROOT);
  const listed = await listedViews(released, orientation, command, downloads);
  // The frames the lens casts keep the cameras its recipe states; the others take the listed start's.
  const views = released.map((frame, index) => {
    const own = stated.get(`observations/${frame.file}`);
    return own ? { observer: bodyDirection(requireFiniteNumber(own.observerLatitude), requireFiniteNumber(own.observerWestLongitude)),
      sun: bodyDirection(requireFiniteNumber(own.sunLatitude), requireFiniteNumber(own.sunWestLongitude)), latitude: requireFiniteNumber(own.observerLatitude), rangeKm: requireFiniteNumber(own.rangeKm) } : listed[index];
  });
  if (stated.size !== released.filter(frame => stated.has(`observations/${frame.file}`)).length) throw new Error(`${objectId}: the lens casts a frame the release does not list.`);
  const mesh: Mesh = await loadCameraShape(source, radialTerrainForLens(recipe as unknown as Parameters<typeof radialTerrainForLens>[0], 'zimpol'));
  const faces = meshFaces(mesh), photometry = requireRecord(lens.photometry), transfer = requireRecord(lens.transfer), levels = requireRecord(lens.levelMatching);
  const limit = Math.min(requireFiniteNumber(photometry.maximumIncidenceDegrees), requireFiniteNumber(photometry.maximumEmissionDegrees), requireFiniteNumber(transfer.maximumEmissionDegrees));
  const seen = views.map(view => seenFaces(faces, mesh, view, limit));
  const groups = apparitions(released), apparitionOf = (frame: LamFrame) => groups.findIndex(group => group.includes(frame));
  const cast = released.flatMap((frame, index) => stated.has(`observations/${frame.file}`) ? [index] : []);
  const anchor = apparitionOf(released[cast[0]]), current = coveredShare(faces, cast.map(index => seen[index]));
  const displaySamples = requireFiniteNumber(requireRecord(radialTerrainForLens(recipe as unknown as Parameters<typeof radialTerrainForLens>[0], 'zimpol')).faceBudget) * requireFiniteNumber(levels.samplesPerTriangle);
  const links = apparitionLinks(faces, mesh, released.map((frame, index) => ({ apparition: apparitionOf(frame), view: views[index] })), anchor,
    { gateDegrees: requireFiniteNumber(levels.maximumAngleDegrees), minimumPairs: requireFiniteNumber(levels.minimumPairs), displaySamples });
  const prepared = await readFile(resolve(ROOT, 'src/objects', objectId, 'prepared/surfaces.json'), 'utf8').then(text => {
    const surfaces = requireArray(requireRecord(JSON.parse(text)).surfaces).map(value => requireRecord(value));
    const observation = surfaces.map(surface => surface.observation).find(value => value && requireArray(requireRecord(value).frames).length === stated.size);
    return observation ? requireFiniteNumber(requireRecord(requireRecord(observation).areaCoverage).acceptedFraction) : null;
  }, () => null);
  const percent = (share: number) => Number((share * 100).toFixed(1));
  return { objectId, released: released.length, cast: cast.length, coverage: { prepared: prepared === null ? null : percent(prepared), model: percent(current),
      linked: percent(coveredShare(faces, released.flatMap((frame, index) => links[apparitionOf(frame)].cast ? [seen[index]] : []))), all: percent(coveredShare(faces, seen)) },
    apparitions: groups.map((members, apparition) => {
      const own = released.flatMap((frame, index) => apparitionOf(frame) === apparition ? [index] : []), latitudes = own.map(index => views[index].latitude);
      const ranges = own.map(index => views[index].rangeKm).sort((a, b) => a - b);
      return { from: members[0].start.slice(0, 10), to: members.at(-1)!.start.slice(0, 10), frames: members.length, cast: own.filter(index => cast.includes(index)).length,
        subObserverLatitude: [Math.min(...latitudes), Math.max(...latitudes)].map(value => Number(value.toFixed(1))), medianRangeKm: Math.round(ranges[Math.floor(ranges.length / 2)]),
        adds: percent(coveredShare(faces, [...cast, ...own].map(index => seen[index])) - current), link: links[apparition] };
    }), anchorApparition: anchor };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const named = process.argv.slice(2), ids: string[] = [];
  for (const id of named.length ? named : (await readdir(resolve(ROOT, 'src/objects'))).sort()) {
    const recipe = await readFile(resolve(ROOT, 'src/objects', id, 'source/preparation/observer-cameras.json'), 'utf8').catch(() => null);
    if (recipe && JSON.parse(recipe).lensId === 'zimpol') ids.push(id);
  }
  // Sequentially: Horizons refuses parallel batches.
  for (const id of ids) console.log(JSON.stringify(await auditLens(id)));
}

