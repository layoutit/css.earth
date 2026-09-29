import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { SCENE_OBJECTS } from '../../../site/objects.mts';
import { readJsonSource } from '@cssearth/bake/objects/sources';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { projectRoot } from '../fixtures.mts';
import { sourceTest } from '../source-test.mts';

const test = sourceTest();
const planets = SCENE_OBJECTS.filter(object => object.classification === 'exoplanet');

test('every registered exoplanet bakes the source-radius silhouette through a lit or emissive path', async () => {
  // Every exoplanet the astronomy catalogue holds is registered, so none escapes the checks below.
  const bodies = resolve(projectRoot, 'packages/astronomy/data/bodies');
  const catalogued = [];
  for (const file of readdirSync(bodies).filter(name => name.endsWith('.json'))) {
    const body = requireRecord(await readJsonSource(resolve(bodies, file)), file);
    if (body.classification === 'exoplanet') catalogued.push(requireString(body.id, `${file} id`));
  }
  assert.deepEqual(planets.map(({ id }) => id).sort(), catalogued.sort());
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
        // The plate is wholly transparent, and the raster lane publishes no plate without a visible pixel.
        assert.ok(!assets.some(asset => typeof asset.filename === 'string' && asset.filename.includes(`-limb-${name}@2x.webp`)), `${id}/${name} publishes no empty plate`);
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
  assert.equal(hosts.size, 72);
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
    // Every host has a law: one a paper fit or fixed for the star (WD 1856+534 takes the model coefficients its discovery paper
    // fixed), or a model grid's law at its own temperature and gravity (packages/telescope-cli/src/new-object/limb.mts).
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
  // HR 8799 and Kepler-16 A were gray shapes, and WD 1856+534 and Epsilon Indi A uniform discs, until `--star-limb` gave them
  // their laws: no host star is left without one.
  assert.deepEqual(shapeOnly, []);
  assert.deepEqual(uniform, []);
});
