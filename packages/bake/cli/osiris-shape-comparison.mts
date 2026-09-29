/** Compare OSIRIS Cartesian backplanes with the selected and base source meshes.
 * This measures source-model disagreement, independently of display tessellation and atlas density.
 * node packages/bake/cli/osiris-shape-comparison.mts <body> <lens> <output.json> */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireRecord, requireString } from '@cssearth/core';
import { createSourceManifest } from '@cssearth/objects/node';
import { requireTerrainMesh } from '@cssearth/bake/objects/geometry';
import { parseSolidPreparationSource, decodeOsirisGeo, decodeOsirisQuality, acceptOsirisQuality, project } from '@cssearth/bake/objects/layers/terrestrial';
import { radialTerrainForLens } from '@cssearth/bake/objects/layers/terrestrial';
import { loadRadialTerrain } from '@cssearth/bake/objects/layers/terrestrial';
import { fitBackplaneCamera } from '@cssearth/bake/objects/layers/terrestrial';
import { parseGeoLens } from '@cssearth/bake/objects/layers/terrestrial';

const summary = (values: number[]) => {
  values.sort((a, b) => a - b);
  return { count: values.length, p50: values[Math.floor(values.length * .5)] ?? null,
    p95: values[Math.floor(values.length * .95)] ?? null, maximum: values.at(-1) ?? null };
};

export async function compareOsirisShapes(id: string, lensId: string) {
  if (![id, lensId].every(value => /^[a-z][a-z0-9-]*$/.test(value))) throw new TypeError('Invalid body or lens.');
  const sourceDirectory = resolve('src/objects', id, 'source');
  const recipeBytes = await readFile(resolve(sourceDirectory, 'preparation/terrestrial.json'));
  const config = parseSolidPreparationSource(JSON.parse(recipeBytes.toString('utf8')));
  const raw = config.raster.surfaceObservations?.find(lens => lens.id === lensId);
  if (!raw || requireRecord(raw).format !== 'osiris-geo') throw new TypeError('Select an OSIRIS GEO dataset.');
  const recipe = parseGeoLens(raw), source = await createSourceManifest({ objectId: id, objectName: id, sourceRoot: sourceDirectory });
  const selected = radialTerrainForLens(config, lensId);
  if (!config.geometry.radialTerrain || !selected) throw new TypeError('Source meshes are required.');
  const profiles = [{ name: 'base', profile: config.geometry.radialTerrain }, { name: 'selected', profile: selected }];
  const meshes = await Promise.all(profiles.map(async item => {
    const radial = await loadRadialTerrain({ config: { ...config, geometry: { ...config.geometry, radialTerrain: item.profile } }, sourceDirectory, source });
    if (!radial) throw new Error('Missing source surface.');
    const path = requireString(requireRecord(item.profile).path);
    return { name: item.name, path, mesh: requireTerrainMesh(radial.grid) };
  }));
  const frames = [];
  for (const input of recipe.frames) {
    await source.validatePath(input.path); await source.validatePath(requireString(input.qualityPath));
    const bytes = await readFile(resolve(sourceDirectory, input.path)), decoded = decodeOsirisGeo(bytes);
    const quality = decodeOsirisQuality(await readFile(resolve(sourceDirectory, requireString(input.qualityPath))), decoded);
    const camera = fitBackplaneCamera(decoded);
    const measurements = meshes.map(() => ({ distances: [] as number[], pixels: [] as number[], withinTransfer: 0 }));
    let samples = 0;
    // Offset and stride are disjoint from the fitting grid where possible; this is a deterministic detector sample, not an area estimate.
    for (let i = 503; i < decoded.width * decoded.height; i += 1009) {
      if (i % 179 === 0 || !decoded.valid(i) || !acceptOsirisQuality(quality.flags[i], recipe.allowLossy === true)) continue;
      const point = decoded.xyz(i).map(n => n * 1000); samples++;
      for (let m = 0; m < meshes.length; m++) {
        const hit = meshes[m].mesh.closestPoint(point);
        if (!hit) throw new Error('Source mesh has no closest surface.');
        measurements[m].distances.push(hit.distanceMeters);
        const p = project(camera.matrix, hit.point.map(n => n / 1000));
        measurements[m].pixels.push(Math.hypot(p[0] - i % decoded.width, p[1] - Math.floor(i / decoded.width)));
        if (hit.distanceMeters <= (recipe.transfer.maximumSeparationMeters ?? 0)) measurements[m].withinTransfer++;
      }
    }
    frames.push({ id: input.id, samples, shapeModel: decoded.shapeModel,
      cameraHoldoutMaximumPixels: camera.maximumResidualPixels,
      meshes: meshes.map((mesh, i) => ({ name: mesh.name, path: mesh.path, distancesMeters: summary(measurements[i].distances),
        nearestPointDisplacementPixels: summary(measurements[i].pixels), withinTransfer: measurements[i].withinTransfer })) });
  }
  return { schema: 'cssearth-osiris-shape-comparison@1', objectId: id, lensId,
    method: 'Every 1009th detector pixel from offset 503, excluding the camera-fitting grid. Native GEO validity and paired L4 flags apply. Compare each archive XYZ to the closest full-source point and reproject that point into the original camera. No emission, phase or visibility filtering; this deliberately includes points later withheld by the mosaic. Detector-weighted statistics are not surface coverage or measurement uncertainty.',
    meshes: meshes.map(({ mesh: _mesh, ...record }) => record), frames };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [id, lensId, output] = process.argv.slice(2);
  if (!id || !lensId || !output || process.argv.length !== 5) throw new TypeError('Usage: osiris-shape-comparison <body> <lens> <output.json>');
  const report = await compareOsirisShapes(id, lensId);
  await writeFile(resolve(output), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.frames.map(frame => ({ id: frame.id, samples: frame.samples, meshes: frame.meshes.map(mesh => ({ name: mesh.name, medianMeters: mesh.distancesMeters.p50, medianPixels: mesh.nearestPointDisplacementPixels.p50 })) })), null, 2));
}
