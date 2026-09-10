#!/usr/bin/env node
// Source authoring only. Rendering uses the existing terrestrial preparation recipe.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import sharp from 'sharp';
import * as fontkit from 'fontkit';
import { createPlanetTitleSource } from '../../tools/prepare-planet-title-sources.mjs';
import { PLANET_TITLE_RECIPE } from '../../src/platform/planet-title-recipe.mjs';
import { parsePdsRadiusTable } from '../../tools/objects/terrestrial-layers/obj-shape.mjs';
import { simplifyRadialShape } from '../../tools/objects/terrestrial-layers/radial-terrain.mjs';
import { renderRadialSnapshot } from '../../tools/objects/terrestrial-layers/radial-snapshot.mjs';
import { paintMissingCoverage } from '../../src/platform/prepare-missing-coverage.mjs';

const root = resolve(import.meta.dirname, '../..');
if (process.cwd() !== root) throw new Error('Run from the repository root.');
const inputsArg = process.argv.find(arg => arg.startsWith('--inputs='));
const inputsPath = inputsArg ? resolve(root, inputsArg.slice(9)) : new URL('./inputs.json', import.meta.url);
const { bodies, checkedOn } = JSON.parse(await readFile(inputsPath));
const commonCommit = 'e97ee9532b17beaf0c7ae38281c5bef12b64fa5b';
// Current page contract loads only metadata into Astro's build graph.
const common = 'src/planets/menoetius/';
const readCommon = path => execFileSync('git', ['show', `${commonCommit}:${common}${path}`]);
const commonJson = path => JSON.parse(readCommon(path));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const write = async (path, value) => {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value, null, 2) + '\n');
};
const files = async path => (await Promise.all((await readdir(path, { withFileTypes: true })).map(e => e.isDirectory() ? files(resolve(path, e.name)) : [resolve(path, e.name)]))).flat();
const replace = (text, b) => text.replaceAll('menoetius', b.id).replaceAll('Menoetius', b.name);
const configFor = (path, b) => JSON.parse(replace(readCommon(path).toString(), b));
async function repin(b) {
  const pkg = resolve(root, 'src/planets', b.id), src = resolve(pkg, 'source');
  const manifest = JSON.parse(await readFile(resolve(src, 'manifest.json')));
  const declared = new Set([...manifest.inputs, ...manifest.generatedIntermediates].map(e => e.path));
  manifest.documents = [];
  for (const path of (await files(src)).sort()) {
    const rel = relative(src, path);
    if (rel === 'manifest.json' || declared.has(rel)) continue;
    const bytes = await readFile(path);
    manifest.documents.push({ path: rel, expectedBytes: bytes.length, expectedSha256: hash(bytes), purpose: 'Pinned body-specific source interpretation or preparation input.' });
  }
  await write(resolve(src, 'manifest.json'), manifest);
  const descriptorPath = resolve(pkg, 'object.json'), descriptor = JSON.parse(await readFile(descriptorPath));
  for (const ref of descriptor.properties.recipe.sources) ref.sha256 = hash(await readFile(resolve(pkg, ref.path)));
  await write(descriptorPath, descriptor);
}
if (process.argv.includes('--refresh-pins')) {
  for (const b of bodies) await repin(b);
  process.exit(0);
}
const fontPath = resolve(root, 'src/planets/earth/source/presentation/InterVariable.ttf');
if (hash(await readFile(fontPath)) !== PLANET_TITLE_RECIPE.sourceSha256) throw new Error('Shared title font digest differs.');
const font = fontkit.openSync(fontPath).getVariation({ wght: PLANET_TITLE_RECIPE.weight, opsz: PLANET_TITLE_RECIPE.opticalSize });
const neutral = await sharp({ create: { width: 64, height: 32, channels: 3, background: { r: 160, g: 160, b: 160 } } }).png().toBuffer();
const width = 512, height = 256;
const grid = paintMissingCoverage(Buffer.alloc(width * height * 3, 160), { width, height, channels: 3 }, new Uint8Array(width * height).fill(1));
const contextMap = await sharp(grid, { raw: { width, height, channels: 3 } }).ensureAlpha().webp({ lossless: true, effort: 4 }).toBuffer();
for (const b of bodies) {
  const pkg = resolve(root, 'src/planets', b.id), src = resolve(pkg, 'source');
  const [a, c2, c] = b.fullAxesKm.map(x => x / 2), radius = Math.cbrt(a * c2 * c);
  const shape = [];
  for (let lat = -90; lat <= 90; lat += 5) for (let lon = 0; lon <= 360; lon += 5) {
    const p = lat * Math.PI / 180, l = lon * Math.PI / 180;
    const r = 1 / Math.sqrt((Math.cos(p) * Math.cos(l) / a) ** 2 + (Math.cos(p) * Math.sin(l) / c2) ** 2 + (Math.sin(p) / c) ** 2);
    shape.push(`${lon} ${lat} ${r.toFixed(12)}`);
  }
  const table = shape.join('\n') + '\n';
  await write(resolve(src, 'shape/ellipsoid.tab'), table);
  await write(resolve(src, 'material/neutral.png'), neutral);
  const dimensions = b.fullAxesKm.join(' × ') + ' km';
  const coverage = `${b.shapeMeaning} Full approximation dimensions: ${dimensions}. ${b.orientationMeaning} The grid marks unmapped terrain.`;
  let pole = b.poleIcrfDegrees;
  if (!pole) {
    const [lon, lat] = b.poleEclipticDegrees.map(v => v * Math.PI / 180), ob = 23.439291111 * Math.PI / 180;
    const x = Math.cos(lat) * Math.cos(lon), y = Math.cos(lat) * Math.sin(lon), z = Math.sin(lat);
    pole = [(Math.atan2(y * Math.cos(ob) - z * Math.sin(ob), x) * 180 / Math.PI + 360) % 360, Math.asin(y * Math.sin(ob) + z * Math.cos(ob)) * 180 / Math.PI];
  }
  const measurements = {
    schema: 'cssearth-approximate-ellipsoid@1', id: b.id, horizonsCommand: b.horizons,
    source: { url: b.source, papers: b.papers, credit: b.credit, retrieved: checkedOn },
    constraints: { kind: 'approximate-ellipsoid', fullAxesKm: b.fullAxesKm, semiAxesKm: [a, c2, c], fullAxesUncertaintyKm: b.axisUncertaintyKm,
      referenceRadiusKm: radius, axisConvention: 'Full axes are halved exactly. +Z is the adopted pole; +X is the arbitrary display meridian.', qualification: b.shapeMeaning,
      scale: 'The reference radius is the geometric mean of the approximation semiaxes. It is a rendering scale, not an independent measured mean radius or convex-model volume.' },
    approximation: { semiAxesKm: [a, c2, c], assumptions: [b.shapeMeaning, b.orientationMeaning], qualification: 'Observation-constrained ellipsoid; no invented local terrain or albedo.' },
    sampling: { stepDegrees: 5, longitudeDirection: 'east-positive', radiusUnit: 'km', formula: 'r = 1 / sqrt((cos(lat)*cos(lon)/a)^2 + (cos(lat)*sin(lon)/b)^2 + (sin(lat)/c)^2)' },
    spin: { periodHours: b.periodHours, periodText: b.periodText, poleEclipticDegrees: b.poleEclipticDegrees ?? null, poleIcrfRaDecDegrees: pole,
      eclipticToIcrfObliquityDegrees: b.poleEclipticDegrees ? 23.439291111 : null, meridianDegrees: 0, meaning: b.orientationMeaning },
    unresolved: b.unresolved
  };
  await write(resolve(src, 'measurements.json'), measurements);
  await write(resolve(src, 'preparation/rotation.json'), {
    schema: b.periodHours === null ? 'cssearth-display-orientation@1' : 'cssearth-observed-pole@1',
    rightAscensionDegrees: pole[0], declinationDegrees: pole[1], displayMeridianDegrees: 0,
    ...(b.periodHours === null ? {} : { periodHours: b.periodHours }), phase: 'arbitrary-display-phase',
    source: b.id === 'patroclus' ? 'https://doi.org/10.3847/1538-3881/ad1f6e' : b.source,
    coordinateSystem: 'ICRF/J2000; observed or explicitly approximate pole; arbitrary display meridian', qualification: b.orientationMeaning
  });
  const config = configFor('source/preparation/terrestrial.json', b);
  config.geometry.radiusKm = radius;
  config.geometry.camera.framingScale = Math.min(1, radius / a);
  config.geometry.radialTerrain.simplification = { targetFaces: 480, maximumErrorMeters: 25 * radius, method: 'source-meshoptimizer' };
  config.raster.observations[0].metadata.coverage = coverage;
  config.celestial.sunSource = 'JPL Horizons heliocentric state at the fixed 2026-09-03 TT scene epoch. ' + b.orientationMeaning;
  await write(resolve(src, 'preparation/terrestrial.json'), config);
  const content = configFor('source/content/object.json', b);
  content.panel.introduction = b.introduction;
  content.panel.facts = [
    { id: 'shape', label: 'Shape evidence', value: 'Approximate ellipsoid' },
    { id: 'dimensions', label: 'Full approximation dimensions', value: dimensions },
    { id: 'rotation', label: b.id === 'patroclus' ? 'Mutual orbital period' : 'Rotation period', value: b.periodText },
    { id: 'class', label: 'Population', value: b.population ?? 'Jupiter Trojan' }
  ];
  content.panel.moreFacts = [];
  content.lenses.controls[0].description = coverage;
  content.lenses.controls[0].title = b.datasetTitle ?? 'Published shape approximation';
  content.lenses.controls[0].detail = 'Approximate shape';
  content.lenses.controls[0].source.url = b.source;
  content.settings.controls.find(c => c.name === 'shadows').checked = false;
  content.settings.controls.find(c => c.name === 'orbit').checked = false;
  content.resources = [{ label: 'Shape and dimensions', role: 'surface', description: b.credit, href: b.source }, ...b.papers.map(href => ({ label: 'Scientific source', role: 'facts', description: 'Published model and interpretation', href })), content.resources.find(r => r.role === 'stars')];
  content.provenance.editorial = { url: b.source, credit: b.credit };
  content.provenance.physical = { path: '../measurements.json', credit: b.credit };
  await write(resolve(src, 'content/object.json'), content);
  await write(resolve(src, 'presentation/title-mark.json'), { schema: 'cssearth-title-source@1', ...createPlanetTitleSource(b.name, font) });
  await write(resolve(src, 'presentation/minimap.json'), commonJson('source/presentation/minimap.json'));
  for (const file of ['preparation/acquisition.json', 'stars/ESO-IMAGE-LICENSE.md', 'stars/LICENSE.md', 'stars/hyg-v41-field.json']) await write(resolve(src, file), replace(readCommon('source/' + file).toString(), b));
  const mesh = parsePdsRadiusTable(table, config.geometry.radialTerrain.grid);
  const faces = await simplifyRadialShape(mesh, config.geometry.radialTerrain, 230 / (radius * 1000));
  const snapshotRecipe = { generator: 'tools/objects/terrestrial-layers/radial-snapshot.mjs', inputs: ['occultation-approximation', 'model-surface'], size: 512, longitudeDegrees: 55, latitudeDegrees: 20, ambient: .45, diffuse: .55, lensId: 'model' };
  const context = await renderRadialSnapshot({ ...snapshotRecipe, faces, map: contextMap });
  await write(resolve(src, 'presentation/context.png'), context);
  const navigation = configFor('source/preparation/navigation.json', b);
  Object.assign(navigation.source, { origin: b.source, credit: b.credit, expectedBytes: context.length, expectedSha256: hash(context), recipe: snapshotRecipe });
  await write(resolve(src, 'preparation/navigation.json'), navigation);
  const manifest = configFor('source/manifest.json', b);
  for (const entry of manifest.inputs.filter(e => ['occultation-approximation', 'model-surface'].includes(e.id))) {
    const bytes = await readFile(resolve(src, entry.path));
    Object.assign(entry, { expectedBytes: bytes.length, expectedSha256: hash(bytes), origin: b.source, credit: b.credit, coverage, licenseEvidence: [b.source] });
    entry.projection.referenceRadiusMeters = radius * 1000;
  }
  manifest.generatedIntermediates = [{ ...navigation.source }];
  await write(resolve(src, 'manifest.json'), manifest);
  const descriptor = configFor('object.json', b);
  delete descriptor.properties.worldFrame;
  descriptor.properties.recipe.shape.radiusKm = radius;
  descriptor.prepared.sha256 = '0'.repeat(64);
  descriptor.properties.page = { stylesheets: [`src/renderers/css/styles/${b.id}-surfaces.css`] };
  await write(resolve(pkg, 'object.json'), descriptor);
  await repin(b);
  // Keep the body README and its reviewed evidence when regenerating source data.
  await write(resolve(pkg, 'NOTICE.md'), `# Credits\n\nScientific shape constraints: ${b.credit}. Numerical extraction and ellipsoid approximation: cssEarth, MIT. Retain the source citations and approximate status; research papers are not relicensed or bundled. The missing-data grid is authored display content, not observed regolith. ESO/S. Brunier panorama: CC BY 4.0. Inter: SIL OFL 1.1. HYG metadata: Astronexus, CC BY-SA 4.0. See source/stars for full license records.\n`);
  await write(resolve(root, `src/renderers/css/styles/${b.id}-surfaces.css`), replace(execFileSync('git', ['show', `${commonCommit}:src/renderers/css/styles/menoetius-surfaces.css`]).toString(), b));
  await write(resolve(root, `tests/objects/browser/${b.id}/browser-profile.mjs`), replace(execFileSync('git', ['show', `${commonCommit}:tests/objects/browser/menoetius/browser-profile.mjs`]).toString(), b));
  console.log(JSON.stringify({ id: b.id, sourceFaces: mesh.indices.length, outputFaces: faces.length, radiusKm: radius, contextBytes: context.length }));
}
