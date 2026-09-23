import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { SCENE_OBJECTS } from '../../../site/objects.mts';
import { readJsonSource, requireArray, requireFiniteNumber, requireRecord, requireString } from '../../../tools/sources/source-values.mts';
import { projectRoot } from '../fixtures.mts';
import { sourceTest } from '../source-test.mts';

const test = sourceTest();
const planets = SCENE_OBJECTS.filter(object => object.classification === 'exoplanet');

test('every registered exoplanet bakes the source-radius silhouette through a lit or emissive path', async () => {
  assert.equal(planets.length, 44);
  for (const { id } of planets) {
    const directory = resolve(projectRoot, 'src/objects', id);
    const measurements = requireRecord(await readJsonSource(resolve(directory, 'source/measurements.json')), `${id} measurements`);
    assert.ok(requireFiniteNumber(measurements.radiusKm, `${id} radius`) > 0);
    assert.ok(requireString(measurements.radiusSource, `${id} radius source`).length > 20);
    const raster = requireRecord(await readJsonSource(resolve(directory, 'source/preparation/raster.json')), `${id} raster`);
    const manifest = requireRecord(await readJsonSource(resolve(directory, 'source/manifest.json')), `${id} manifest`);
    assert.ok(requireArray(manifest.inputs, `${id} inputs`).some(input => requireRecord(input, 'input').path === 'measurements.json'));
    const lit = raster.lighting !== undefined, emissive = raster.emission !== undefined;
    assert.notEqual(lit, emissive, `${id} needs exactly one silhouette preparation path`);
    if (lit) {
      const lighting = requireRecord(raster.lighting, `${id} lighting`);
      const model = requireRecord(lighting.metadata, `${id} lighting model`);
      assert.equal(model.model, 'prepared-full-phase-lambert-cubic-sky-sun-no-atmosphere');
      assert.equal(model.sourceRenderer, 'OpenSpace@56e29b54/modules/globebrowsing/shaders/texturetilemapping.glsl');
      assert.equal(model.sourceRadius, 'measurements.json#radiusKm');
      assert.match(requireString(model.limbMeaning, `${id} limb meaning`), /no atmospheric rim is inferred/u);
    } else {
      const emission = requireRecord(raster.emission, `${id} emission`);
      const material = requireRecord(requireRecord(emission.metadata, `${id} emission metadata`).limbMaterial, `${id} limb material`);
      assert.match(requireString(material.composition, `${id} limb composition`), /^transparent: the adopted source-radius opaque-sphere silhouette is the limb/u);
      assert.equal(material.sourceRadius, 'measurements.json#radiusKm');
      const inventory = requireRecord(await readJsonSource(resolve(directory, 'inventory.json')), `${id} inventory`);
      const assets = requireArray(inventory.assets, `${id} assets`).map(asset => requireRecord(asset, 'asset'));
      for (const surface of requireArray(raster.surfaces, `${id} surfaces`)) {
        const lens = requireRecord(surface, 'surface');
        const name = requireString(lens.id, `${id} lens`);
        assert.ok(assets.some(asset => typeof asset.filename === 'string' && asset.filename.includes(`-limb-${name}@2x.webp`)), `${id}/${name} must publish its transparent plate`);
      }
    }
  }
});

test('each host star selects a source-bound quadratic limb profile', async () => {
  const hosts = new Set<string>();
  for (const { id } of planets) {
    const astronomy = requireRecord(await readJsonSource(resolve(projectRoot, 'packages/astronomy/data/bodies', `${id}.json`)), `${id} astronomy`);
    hosts.add(requireString(requireRecord(astronomy.physical, `${id} physical`).parent, `${id} host`));
  }
  assert.equal(hosts.size, 27);
  const shapeOnly: string[] = [], uniform: string[] = [];
  for (const id of hosts) {
    const directory = resolve(projectRoot, 'src/objects', id);
    const raster = requireRecord(await readJsonSource(resolve(directory, 'source/preparation/raster.json')), `${id} raster`);
    const manifest = requireRecord(await readJsonSource(resolve(directory, 'source/manifest.json')), `${id} manifest`);
    const inputs = requireArray(manifest.inputs, `${id} inputs`).map(input => requireRecord(input, 'input'));
    const surface = requireRecord(requireArray(raster.surfaces, `${id} surfaces`)[0], `${id} surface`);
    const science = requireRecord(surface.science, `${id} science`);
    // A shape-only star (no colour source fit to draw) carries no limb profile; every other host does.
    if (science.kind === 'neutral-shape') { shapeOnly.push(id); continue; }
    assert.equal(science.kind, 'stellar-photometric-color');
    // WD 1856+534's only fitted law puts the limb below zero, which the preparer refuses (its README), and the young hosts of imaged
    // planets have no measured law in their packages: uniform colour discs, each saying so in its qualification.
    if (science.limbDarkening === undefined) { uniform.push(id); continue; }
    const law = requireRecord(science.limbDarkening, `${id} limb darkening`);
    assert.equal(law.law, 'quadratic');
    if (law.path !== undefined) assert.ok(inputs.some(input => input.path === law.path), `${id} limb input must be in its source manifest`);
    else {
      const transits = requireRecord(law.transits, `${id} transits`);
      for (const path of requireArray(transits.lightCurves, `${id} light curves`)) {
        assert.ok(inputs.some(input => input.path === path), `${id}: ${String(path)} must be in its source manifest`);
      }
    }
    const material = requireRecord(requireRecord(requireRecord(raster.emission, `${id} emission`).metadata, `${id} emission metadata`).limbMaterial, `${id} material`);
    assert.match(requireString(material.composition, `${id} composition`), /black alpha darkens/u);
    const inventory = requireRecord(await readJsonSource(resolve(directory, 'inventory.json')), `${id} inventory`);
    assert.ok(requireArray(inventory.assets, `${id} assets`).some(asset => typeof requireRecord(asset, 'asset').filename === 'string' &&
      String(requireRecord(asset, 'asset').filename).includes('-limb-color@2x.webp')), `${id} must publish its limb plate`);
  }
  assert.deepEqual(shapeOnly.sort(), ['hr-8799', 'kepler-16-a']);
  assert.deepEqual(uniform.sort(), ['ab-pic', 'af-lep', 'dh-tau', 'gq-lup', 'hip-65426', 'roxs-42b', 'vhs-1256-1257', 'wd-1856-534', 'yses-1']);
});
