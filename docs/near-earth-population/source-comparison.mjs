// Adapted from the existing asteroids-survey source-comparison helper.
// The same source snapshot renderer, normals and four camera directions are used.
import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {loadPdsPlateShape} from '../../tools/objects/terrestrial-layers/obj-shape.mts';
import {shadeRadialFaces} from '../../tools/objects/terrestrial-layers/radial-terrain.mts';
import {renderRadialSnapshot} from '../../tools/objects/terrestrial-layers/radial-snapshot.mts';

const root = resolve(import.meta.dirname, '../..');
const allBodies = JSON.parse(await readFile(resolve(root, 'docs/near-earth-population/inputs.json'), 'utf8'));
const requested = process.argv.slice(2);
const views = [[0, 35], [180, 0], [0, 90], [0, -90]];
if (requested.includes('--list')) {
  console.log(JSON.stringify({objects:allBodies.map(body => body.id), views, imageSize:[1024,512], concurrency:1, usesPreparedTerrain:true}));
  process.exit(0);
}
const ids = requested.length ? requested : allBodies.map(body => body.id);
for (const id of ids) {
  if (!allBodies.some(body => body.id === id)) throw Error(`Unknown selected asteroid ${id}`);
  const started = performance.now(), out = resolve(root, 'output/near-earth-population', id);
  const configBytes = await readFile(resolve(root, 'src/planets', id, 'source/preparation/terrestrial.json'));
  const config = JSON.parse(configBytes), p = config.geometry.radialTerrain;
  const sourceDirectory = resolve(root, 'src/planets', id, 'source');
  const mapFilename = `${id}-shape-map.webp`, map = resolve(root, 'output/near-earth-population/context', id, mapFilename);
  const [sourceBytes, terrainBytes, mapBytes, sourceManifestBytes, surfacesBytes] = await Promise.all([
    readFile(resolve(sourceDirectory, p.path)),
    readFile(resolve(root, 'src/planets', id, 'prepared/terrain.json')),
    readFile(map),
    readFile(resolve(sourceDirectory, 'manifest.json')),
    readFile(resolve(root, 'src/planets', id, 'prepared/surfaces.json')),
  ]);
  const terrain = JSON.parse(terrainBytes), sourceManifest = JSON.parse(sourceManifestBytes), surfaces = JSON.parse(surfacesBytes);
  const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
  assert.equal(sha256(sourceBytes), sourceManifest.inputs.find(input => input.path === p.path)?.expectedSha256, 'Original source pin');
  assert.equal(sha256(mapBytes), surfaces.surfaces.find(surface => surface.id === 'shape')?.map.sha256, 'Prepared intermediate grid map pin');
  assert.deepEqual(terrain.source.grid, p.grid, 'Prepared terrain preserves physical source units');
  assert.equal(terrain.source.path, p.path);
  assert.ok(terrain.faces.length > 0 && terrain.faces.length <= 800);
  const mesh = await loadPdsPlateShape(resolve(sourceDirectory, p.path), p.grid);
  const scale = config.geometry.radius / (config.geometry.radiusKm * 1000);
  const original = mesh.indices.map(face => {
    const vertices = face.map(index => mesh.positions[index].map(value => value * scale));
    const [a, b, c] = vertices, ab = b.map((value, axis) => value - a[axis]), ac = c.map((value, axis) => value - a[axis]);
    const n = [ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]];
    return {vertices, normal:n.map(value => value / Math.hypot(...n))};
  });
  shadeRadialFaces(original);
  await mkdir(out, {recursive:true});
  const images = [];
  for (const [longitudeDegrees, latitudeDegrees] of views) {
    const opts = {map, size:512, longitudeDegrees, latitudeDegrees, ambient:.45, diffuse:.55};
    const source = await renderRadialSnapshot({...opts, faces:original});
    const result = await renderRadialSnapshot({...opts, faces:terrain.faces});
    const bytes = await sharp({create:{width:1024,height:512,channels:4,background:'#101010'}})
      .composite([{input:source,left:0,top:0},{input:result,left:512,top:0}]).png().toBuffer();
    const filename = `source-result-${longitudeDegrees}-${latitudeDegrees}.png`;
    await writeFile(resolve(out, filename), bytes);
    images.push({filename, longitudeDegrees, latitudeDegrees, sha256:sha256(bytes), bytes:bytes.length});
  }
  const report = {
    schema:'cssearth-asteroid-source-comparison@1', id,
    comparison:'Left: original source; right: actual prepared terrain. Each is normalized to its own maximum radius by the established orthographic renderer; these are shape-inspection views, not pixel parity with the browser or a matched physical framing.',
    geometrySource:'Original pinned counted triangle mesh versus prepared/terrain.json; no simplification or geometry preparation is run by this helper',
    sourceIdentity:{path:p.path,sha256:sha256(sourceBytes),bytes:sourceBytes.length,vertices:mesh.positions.length,faces:mesh.indices.length,metersPerUnit:p.grid.metersPerUnit},
    preparedIdentity:{path:`src/planets/${id}/prepared/terrain.json`,sha256:sha256(terrainBytes),bytes:terrainBytes.length,faces:terrain.faces.length,metersToLogicalUnits:scale},
    mapIdentity:{role:'Preparation intermediate pinned by prepared/surfaces.json; not a runtime request',path:`output/near-earth-population/context/${id}/${mapFilename}`,sha256:sha256(mapBytes),bytes:mapBytes.length},
    configurationSha256:sha256(configBytes), sourceFirstVertexMeters:mesh.positions[0], sourceFirstTriangle:mesh.indices[0],
    equatorialSamples:[0,90,180,270].map(longitude => [longitude,mesh.sample(longitude,0)]),
    poleSamples:[mesh.sample(0,90),mesh.sample(0,-90)], images, elapsedSeconds:(performance.now()-started)/1000,
  };
  await writeFile(resolve(out, 'source-comparison.json'), JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}
