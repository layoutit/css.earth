import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { nebulaType, readmeSources, sourceKind, symmetryOf } from './research-checklist.ts';

test('a Sources row is a paper, a published 3D model, an image or other by its first link', () => {
  assert.equal(sourceKind("O'Dell, McCullough & Meixner (2004)", 'https://arxiv.org/abs/astro-ph/0407556'), 'paper');
  assert.equal(sourceKind('Chandra X-ray Center, Cassiopeia A in 3D', 'https://chandra.harvard.edu/resources/illustrations/3d_files.html'), 'model');
  assert.equal(sourceKind('NGC3132_model', 'https://github.com/hektor-monteiro/NGC3132_model'), 'model');
  assert.equal(sourceKind('ESA/Webb weic2330a', 'https://esawebb.org/images/weic2330a/'), 'image');
  assert.equal(sourceKind('ESO optical, eso1723a', 'https://www.eso.org/public/images/eso1723a/'), 'image');
  assert.equal(sourceKind('Gaia DR3', 'https://doi.org/10.1051/0004-6361/202243940'), 'other');
});

test('the checked-in Cas A and M2-9 READMEs give their papers, models and images', async () => {
  const casA = readmeSources(await readFile('src/objects/cassiopeia-a-layers/README.md', 'utf8'));
  assert.ok(casA.some(row => row.kind === 'paper' && /DeLaney/.test(row.label)));
  assert.ok(casA.some(row => row.kind === 'model' && /3D/.test(row.label)));
  assert.ok(casA.some(row => row.kind === 'image' && /weic2330a/.test(row.label)));
  const m29 = readmeSources(await readFile('src/objects/m2-9-volume/README.md', 'utf8'));
  assert.ok(m29.some(row => row.kind === 'paper' && /Wenger/.test(row.label)));
  assert.ok(m29.some(row => row.kind === 'image'));
  assert.ok(m29.some(row => row.kind === 'paper' && /Corradi/.test(row.label)), 'prose links in Sources count too');
  assert.equal(new Set(m29.map(row => row.url)).size, m29.length);
  assert.deepEqual(readmeSources('# No sources\n\nText.'), []);
});

test('type comes from the classification fact, else the description; symmetry from the method', () => {
  assert.equal(nebulaType({ panel: { facts: [{ id: 'classification', value: 'Planetary nebula' }] } }, ''), 'Planetary nebula');
  assert.equal(nebulaType(null, '{"description":"The Twin Jet is a bipolar nebula with two opposing lobes."}'), 'Bipolar nebula');
  assert.equal(nebulaType(null, '{"description":"Cassiopeia A is a supernova remnant about 3,400 parsecs away."}'), 'Supernova remnant');
  assert.equal(nebulaType(null, '{"classification":"nebula"}'), 'nebula');
  assert.equal(symmetryOf('symmetry', []), 'Axial (assumed)');
  assert.equal(symmetryOf('plates', ['rings']), 'Published surfaces: rings');
  assert.equal(symmetryOf('inference', []), 'None assumed');
});
