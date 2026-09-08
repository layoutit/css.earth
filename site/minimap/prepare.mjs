// Prepared spatial minimap. Rebuild with: pnpm prepare:minimap
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { eclipticJ2000ToIcrf } from '@cssearth/astronomy';
import { OBJECTS } from '../objects.mjs';
import context from '../../src/planets/sun/prepared/world-context.json' with { type: 'json' };
import starField from '../../src/objects/stellar-neighbourhood/prepared/stars.json' with { type: 'json' };
import volume from '../../src/objects/milky-way/prepared/volume.json' with { type: 'json' };
import slices from '../../src/objects/milky-way/prepared/volume-slices.json' with { type: 'json' };
import { worldRotationFromQuaternion, rotateWorldPosition } from '../../src/renderers/css/dist/navigation.js';

const radius = 88;
const registry = new Map(OBJECTS.map(object => [object.id, object]));
const bodies = [context.focus, ...context.bodies].filter(body => registry.has(body.id));
// Fixed physical radii across object, system and galactic scales. Runtime only
// projects these retained circles; it does not re-space them to fit the inset.
const ringRadiiM = Array.from({ length: 96 }, (_, level) => 149597870700 * 2 ** (level - 40));
const rings = ringRadiiM.map(radiusM =>
  `<i class="space-minimap-ring" data-radius-m="${radiusM}" hidden></i>`);
const rim = `<i class="space-minimap-ring space-minimap-rim" style="width:${2 * radius}px;height:${2 * radius}px"></i>`;
const spokes = [0, 45, 90, 135].map(angle =>
  `<i class="space-minimap-spoke" style="width:${2 * radius}px;transform:translate(-50%,-50%) rotate(${angle}deg)"></i>`);
// Small bodies first so a coincident moon does not obscure its planet marker.
const order = body => ({ star: 3, planet: 2, 'dwarf-planet': 1 }[registry.get(body.id).classification] ?? 0);
const points = [...bodies].sort((a, b) => order(a) - order(b)).map(body => ({
  id: body.id, positionM: body.positionM, classification: registry.get(body.id).classification,
  color: body.id === context.focus.id ? '#f5dfa2' : body.color,
}));
// Bounded preview catalog: nearest stars plus intrinsically bright stars from
// the existing HYG bank. These are source positions, not synthetic galaxy dots.
const stars = starField.data;
const selectedStars = new Map([
  ...[...stars.stars].sort((a, b) => Math.hypot(...a.positionUnits) - Math.hypot(...b.positionUnits)).slice(0, 1024),
  ...[...stars.stars].sort((a, b) => a.absoluteMagnitude - b.absoluteMagnitude).slice(0, 1024),
].map(star => [star.id, star]));
const starRotation = worldRotationFromQuaternion(stars.frame.localToReferenceXyzw);
const stellarPoints = [...selectedStars.values()].map(star => ({
  id: star.id, classification: 'catalog-star',
  positionM: rotateWorldPosition(starRotation, star.positionUnits).map((value, axis) => value * stars.frame.metersPerUnit + stars.frame.originM[axis]),
  color: `rgb(${stars.atlas.colors[star.colorIndex].join(' ')})`,
}));
const markup = point => `<i class="space-minimap-dot" data-body="${point.id}" data-classification="${point.classification}" style="background:${point.color}" hidden></i>`;
const axes = [[1, 0, 0], [0, -1, 0], [0, 0, -1]].map(eclipticJ2000ToIcrf);
const galaxyRotation = worldRotationFromQuaternion(volume.data.frame.localToReferenceXyzw);
const galaxyAxes = [[1, 0, 0], [0, -1, 0], [0, 0, -1]].map(axis => rotateWorldPosition(galaxyRotation, axis));
await writeFile(new URL('./prepared.json', import.meta.url), JSON.stringify({
  referenceFrame: context.frame.referenceFrame, epochJdTt: context.frame.epochJdTt,
  diagramToReference: [0, 1, 2].flatMap(row => axes.map(axis => axis[row])),
  radius, ringRadiiM, defaultFocus: { positionM: context.focus.positionM, radiusM: context.focus.radiusM },
  bodyIds: bodies.map(body => body.id), points: [...stellarPoints, ...points],
  gridMarkup: [...rings, ...spokes, rim].join(''), pointMarkup: [...stellarPoints, ...points].map(markup).join(''),
  galaxy: {
    positionM: volume.data.frame.originM, widthM: 20 * volume.data.frame.metersPerUnit,
    planeToReference: [0, 1, 2].flatMap(row => galaxyAxes.map(axis => axis[row])),
    fadeStartM: context.volume.opacityProfile.fadeStartDistanceM,
    fullM: context.volume.opacityProfile.fullDistanceM,
  },
}, null, 2) + '\n');

// Prepare a small face-on density projection from the shipped Z slabs. This is
// a map of the existing volume, not another mounted galaxy scene.
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

console.log(`Prepared minimap: ${bodies.length} bodies, ${stellarPoints.length} catalog stars, galaxy density projection.`);
