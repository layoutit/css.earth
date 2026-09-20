import { parsePreparedGalaxyCatalog, parsePreparedClusterCatalog } from '@cssearth/catalog';
import localGroup from '../../src/objects/local-group/prepared/catalogue.json' with { type: 'json' };
import clusterCatalogue from '../../src/objects/galaxy-clusters/prepared/catalogue.json' with { type: 'json' };
import { catalogMarkerSvg } from '../../src/renderers/css/universe/catalog-marker.ts';
import type { PositionM } from '@cssearth/engine';
// Prepared spatial minimap. Rebuild with: pnpm prepare:minimap
import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { eclipticJ2000ToIcrf } from '@cssearth/astronomy';
import { SCENE_OBJECTS } from '../objects.mts';
import context from '../../src/objects/sun/prepared/world-context.json' with { type: 'json' };
import starDescriptor from '../../src/objects/stellar-neighbourhood/object.json' with { type: 'json' };
import { loadPreparedCssPointField } from '../../src/renderers/css/dist/index.js';
import volume from '../../src/objects/milky-way/prepared/volume.json' with { type: 'json' };
import slices from '../../src/objects/milky-way/prepared/volume-slices.json' with { type: 'json' };
import { worldRotationFromQuaternion, rotateWorldPosition } from '../../src/renderers/css/dist/navigation.js';
import { minimapDataOnly, prepareMinimapProjection } from './prepare-projection.mts';

const dataOnly = minimapDataOnly(process.argv.slice(2));

const radius = 88;
const registry = new Map(SCENE_OBJECTS.map(object => [object.id, object]));
const bodies = [context.focus, ...context.bodies].filter(body => registry.has(body.id));
const rim = `<i class="space-minimap-ring space-minimap-rim" style="width:${2 * radius}px;height:${2 * radius}px"></i>`;
const spokes = [0, 45, 90, 135].map(angle =>
  `<i class="space-minimap-spoke" style="width:${2 * radius}px;transform:translate(-50%,-50%) rotate(${angle}deg)"></i>`);
// Small bodies first so a coincident moon does not obscure its planet marker.
const order = (body: { id: string }) => (new Map<string, number>(Object.entries({ star: 3, planet: 2, 'dwarf-planet': 1 }))).get(registry.get(body.id)!.classification) ?? 0;
const points = [...bodies].sort((a, b) => order(a) - order(b)).map(body => ({
  id: body.id, positionM: body.positionM, classification: registry.get(body.id)!.classification,
  color: body.id === context.focus.id ? '#f5dfa2' : body.color,
}));
// Bounded preview catalog: nearest stars plus intrinsically bright stars from
// the existing HYG bank. These are source positions, not synthetic galaxy dots.
// The pinned manifest and binary bank decode through the application loader.
const starDirectory = new URL('../../src/objects/stellar-neighbourhood/', import.meta.url);
const stars = await loadPreparedCssPointField(starDescriptor, { read: async path => new Uint8Array(await readFile(new URL(path, starDirectory))).buffer });
const selectedStars = new Map([
  ...[...stars.stars].sort((a, b) => Math.hypot(...a.positionUnits) - Math.hypot(...b.positionUnits)).slice(0, 1024),
  ...[...stars.stars].sort((a, b) => a.absoluteMagnitude - b.absoluteMagnitude).slice(0, 1024),
].map(star => [star.id, star]));
const starRotation = worldRotationFromQuaternion([stars.frame.localToReferenceXyzw[0], stars.frame.localToReferenceXyzw[1], stars.frame.localToReferenceXyzw[2], stars.frame.localToReferenceXyzw[3]]);
const stellarPoints = [...selectedStars.values()].map(star => ({
  id: star.id, classification: 'catalog-star',
  positionM: rotateWorldPosition(starRotation, [star.positionUnits[0], star.positionUnits[1], star.positionUnits[2]]).map((value, axis) => value * stars.frame.metersPerUnit + stars.frame.originM[axis]),
  color: `rgb(${stars.atlas.colors[star.colorIndex].join(' ')})`,
}));
const galaxies = parsePreparedGalaxyCatalog(localGroup), clusters = parsePreparedClusterCatalog(clusterCatalogue);
for (const catalogue of [galaxies, clusters]) if (catalogue.frame.referenceFrame !== context.frame.referenceFrame || catalogue.frame.epochJdTt !== context.frame.epochJdTt) throw new TypeError('Minimap catalogue frame mismatch.');
const extragalacticPoints = [
  ...galaxies.objects.filter(object => object.membership.group === 'local-group' && object.detailedObjectId).map(object => ({id:object.id, positionM:object.positionM, classification:'galaxy', color:'#c2ccd8'})),
  ...clusters.objects.map(object => ({id:object.id, positionM:object.positionM, classification:'galaxy-cluster', color:'#c2ccd8'})),
];
const allPoints = [...stellarPoints, ...points, ...extragalacticPoints];
const pointOrderX = allPoints.map((_, index) => index)
  .sort((a, b) => allPoints[a].positionM[0] - allPoints[b].positionM[0]);
const markup = (point: { id: string; classification: string; color: string }) => `<i class="space-minimap-dot" data-body="${point.id}" data-classification="${point.classification}" style="${['galaxy','galaxy-cluster'].includes(point.classification) ? 'color:'+point.color : 'background:'+point.color}" hidden>${point.classification === 'galaxy' ? catalogMarkerSvg('galaxy') : point.classification === 'galaxy-cluster' ? catalogMarkerSvg('galaxy-cluster') : ''}</i>`;
const axes = ([[1, 0, 0], [0, -1, 0], [0, 0, -1]] as PositionM[]).map(eclipticJ2000ToIcrf);
const galaxyRotation = worldRotationFromQuaternion([volume.data.frame.localToReferenceXyzw[0], volume.data.frame.localToReferenceXyzw[1], volume.data.frame.localToReferenceXyzw[2], volume.data.frame.localToReferenceXyzw[3]]);
const galaxyAxes = ([[1, 0, 0], [0, -1, 0], [0, 0, -1]] as PositionM[]).map(axis => rotateWorldPosition(galaxyRotation, axis));
await writeFile(new URL('./prepared.json', import.meta.url), JSON.stringify({
  referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
  diagramToReference: [0, 1, 2].flatMap(row => axes.map(axis => axis[row])),
  radius, defaultFocus: { positionM: context.focus.positionM, radiusM: context.focus.radiusM },
  bodyIds: bodies.map(body => body.id), points: allPoints, pointOrderX,
  gridMarkup: [...spokes, rim].join(''), pointMarkup: allPoints.filter(point => point.classification !== 'catalog-star').map(markup).join(''),
  galaxy: {
    positionM: volume.data.frame.originM, widthM: 20 * volume.data.frame.metersPerUnit,
    planeToReference: [0, 1, 2].flatMap(row => galaxyAxes.map(axis => axis[row])),
    fadeStartM: context.volume.opacityProfile.fadeStartDistanceM,
    fullM: context.volume.opacityProfile.fullDistanceM,
  },
}) + '\n');

// Prepare a small face-on density projection from the shipped Z slabs. This is
// a map of the existing volume, not another mounted galaxy scene.
await prepareMinimapProjection(dataOnly, async () => {
  const galaxySize = 512, texelsPerUnit = galaxySize / 20;
  const layers = [];
  for (const quad of slices.quads.filter(quad => quad.axis === 'z' && quad.alphaCoverage > 0)) {
    const [a, b, c] = quad.vertices;
    const left = Math.round((a[0] + 10) * texelsPerUnit), top = Math.round((10 - a[1]) * texelsPerUnit);
    const width = Math.max(1, Math.round((b[0] - a[0]) * texelsPerUnit));
    const height = Math.max(1, Math.round((a[1] - c[1]) * texelsPerUnit));
    const path = new URL(`../../src/objects/milky-way/prepared/${quad.texturePath}`, import.meta.url);
    layers.push({ input: await sharp(path.pathname).resize(width, height).png().toBuffer(), left, top });
  }
  await sharp({ create: { width: galaxySize, height: galaxySize, channels: 4, background: '#00000000' } })
    .composite(layers).png().toFile(new URL('./galaxy.png', import.meta.url).pathname);
});

console.log(`Prepared minimap: ${bodies.length} bodies, ${stellarPoints.length} catalog stars, ${extragalacticPoints.length} extragalactic markers${dataOnly ? ' (data only)' : ', galaxy density projection'}.`);
