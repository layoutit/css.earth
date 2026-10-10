import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { geometryFields, geometryRestore, geometryValues, photographOutlines, photographPixel, plateOutline, platePictures, readPlateRecipe, speedPoints, speedTable } from './plates-model.ts';
import { setRecipeNumber } from '../../server/workflows/plates/recipe-text.ts';
import { draftBake, platesDirectory, plateObjectId } from './plates-paths.ts';

const root = process.cwd();
const subjects = JSON.parse(readFileSync(resolve(root, 'labs/nebula/packages/lab/src/state/subjects.json'), 'utf8')) as { id: string; workflow?: string; directory: string; plates?: { object: string } }[];
const plateObjects = [...new Set(subjects.flatMap(subject => subject.plates ? [subject.plates.object] : []))];
const recipeOf = (object: string): unknown => JSON.parse(readFileSync(resolve(root, object, 'source/recipe.json'), 'utf8'));

test('every plates subject opens on its site bank and names a tracked image-layer recipe', () => {
  assert.ok(plateObjects.length >= 20, `only ${plateObjects.length} plate objects are configured`);
  for (const subject of subjects.filter(item => item.workflow === 'plates')) {
    assert.equal(subject.directory, subject.plates!.object, `${subject.id} must open the site's prepared bank`);
    assert.equal(platesDirectory(subject.plates!.object), `src/objects/${plateObjectId(subject.plates!.object)}/.local/lab/draft`);
    readPlateRecipe(recipeOf(subject.plates!.object));
  }
});

test('the Helix rings are two plates at the published tilts, each as deep as its radius times the sine of its tilt', () => {
  const recipe = readPlateRecipe(recipeOf('src/objects/helix-layers'));
  const rings = recipe.geometry.find(item => item.kind === 'rings')!;
  assert.equal(rings.source, 'publication-odell-2004-helix-structure');
  assert.deepEqual(rings.plates.map(plate => [plate.id, plate.radiusArcsec, plate.tiltDeg, plate.farAxisPaDeg]), [['disc', 250, 23, 288], ['ring', 371, 53, 168]]);
  for (const plate of rings.plates) assert.ok(Math.abs(plate.depthArcsec - plate.radiusArcsec * Math.sin(plate.tiltDeg * Math.PI / 180)) < 1e-9);
  assert.equal(rings.lineOfSightThicknessArcsec, 100);
  // Seen from the Sun a tilted circle keeps its radius along the line of nodes and shrinks by cos(tilt) across it.
  for (const plate of rings.plates) {
    const outline = plateOutline(recipe, plate);
    assert.ok(Math.abs(outline.ry / outline.rx - Math.cos(plate.tiltDeg * Math.PI / 180)) < 1e-9);
    assert.ok(Math.abs(outline.rx / (plate.radiusArcsec / (recipe.observation.fieldOfViewDeg[0] * 3600 / recipe.photograph.width)) - 1) < 1e-3);
  }
});

const textOf = (object: string) => readFileSync(resolve(root, object, 'source/recipe.json'), 'utf8');

test('an edit to any geometry number of any plate recipe changes that number, and only its characters', () => {
  for (const object of plateObjects) {
    const text = textOf(object), recipe = JSON.parse(text) as unknown, fields = geometryFields(recipe);
    assert.ok(fields.length > 0, `${object} has no editable geometry`);
    for (const field of fields) {
      const edited = setRecipeNumber(text, field.path, field.value + 1);
      const changed = geometryFields(JSON.parse(edited)).filter((item, index) => item.value !== fields[index]!.value);
      assert.deepEqual(changed.map(item => [item.path, item.value]), [[field.path, field.value + 1]], `${object} ${field.path}`);
      // Every line but the edited one is the tracked text.
      const before = text.split('\n'), after = edited.split('\n');
      assert.equal(after.length, before.length);
      assert.equal(after.filter((line, index) => line !== before[index]).length, 1, `${object} ${field.path}`);
    }
  }
});

test('an edit must name a number the recipe has', () => {
  const text = textOf('src/objects/helix-layers');
  assert.throws(() => setRecipeNumber(text, 'geometry.rings.disc.missingDeg', 3), /no|not a number/);
  assert.throws(() => setRecipeNumber(text, 'geometry.rings.source', 3), /not a number/);
  assert.throws(() => setRecipeNumber(text, 'geometry.rings.disc.tiltDeg', Number.NaN), /finite/);
  // A respelled number elsewhere (1e-06) stays as the recipe spells it.
  const wfi = textOf('src/objects/helix-wfi-layers');
  assert.match(setRecipeNumber(wfi, 'geometry.rings.disc.tiltDeg', 30), /"thicknessKpc": 1e-06/);
});

test('an edit to a tilt moves its outline on the photograph', () => {
  const raw = recipeOf('src/objects/helix-layers'), before = photographOutlines(readPlateRecipe(raw), raw);
  const edited = JSON.parse(setRecipeNumber(textOf('src/objects/helix-layers'), 'geometry.rings.disc.tiltDeg', 60)) as unknown, after = photographOutlines(readPlateRecipe(edited), edited);
  assert.ok(after[0]!.ry < before[0]!.ry * .6);
  assert.deepEqual(after[1], before[1]);
});

test('a draft samples the recipe more coarsely and changes nothing else', () => {
  const bake = { maxFacePixels: 4096, bulgeFacePixels: 256, bulgeSlices: 56, bulgeCrossSlices: 56, crossAxisSlices: 32, flat: true };
  assert.deepEqual(draftBake(bake), { maxFacePixels: 512, bulgeFacePixels: 96, bulgeSlices: 28, bulgeCrossSlices: 28, crossAxisSlices: 32, flat: true });
  assert.deepEqual(draftBake({ maxFacePixels: 400, bulgeSlices: 10 }), { maxFacePixels: 400, bulgeSlices: 8 });
});

const manifestOf = (object: string): unknown => JSON.parse(readFileSync(resolve(root, object, 'source/manifest.json'), 'utf8'));

test('every plate dataset names its published photograph, and its star-free copy only where the bake reads one', () => {
  for (const object of plateObjects) {
    const raw = recipeOf(object) as { source: { path: string } }, { pictures } = readPlateRecipe(raw, manifestOf(object));
    assert.ok(pictures.original, `${object} has no published photograph to show`);
    assert.match(pictures.original!, /\.(?:jpe?g|png|webp)$/, `${object}: a browser cannot show ${pictures.original}`);
    if (pictures.starless) {
      assert.equal(pictures.starless, raw.source.path, `${object}: the star-free copy is the picture the bake reads`);
      assert.notEqual(pictures.original, pictures.starless, `${object}: the original must not be the star-free copy`);
    } else {
      assert.equal(pictures.original, raw.source.path);
      assert.ok(pictures.starlessReason);
    }
  }
  // The five banks whose picture remove-stars writes show the published picture their manifest declares as their original.
  for (const id of ['m57-layers', 'm76-layers', 'm97-layers', 'm1-67-layers', 'cassiopeia-a-layers'])
    assert.deepEqual(readPlateRecipe(recipeOf(`src/objects/${id}`), manifestOf(`src/objects/${id}`)).pictures, { starless: 'starless.jpg', original: 'source.jpg' });
  // Mutation: without the manifest's original input a star-free bank has no original, and it never shows the star-free copy as one.
  assert.deepEqual(platePictures('starless.jpg', [{ id: 'optical', path: 'src/objects/x/source/starless.jpg', generator: 'labs/nebula/run.mts remove-stars' }], false), { starless: 'starless.jpg' });
  // Without the manifest the panel cannot tell, and claims nothing.
  assert.deepEqual(platePictures('starless.jpg', [], false), {});
});

test('the measured speeds of Cassiopeia A land on the photograph around the star, split by the sign the bake splits them by', () => {
  for (const id of ['cassiopeia-a-layers', 'cassiopeia-a-miri-layers']) {
    const object = `src/objects/${id}`, raw = recipeOf(object), recipe = readPlateRecipe(raw, manifestOf(object)), table = speedTable(raw)!;
    assert.deepEqual(table.columns, { east: 0, north: 1, kmS: 2 });
    const text = readFileSync(resolve(root, object, 'source', table.path), 'utf8'), { points, rows, stride } = speedPoints(recipe, table, text, 20000);
    // DeLaney et al. (2010) newar-ascii.vtk: 10632 cells, 6078 approach and 4554 recede (the recipe's basis). Both banks'
    // tables (beyondRing) also hold the outer optical knots (2036) and jets (955) beyond the forward shock.
    const outer = { 'optical-knots': [1536, 500], jets: [804, 151] };
    assert.equal(rows, 10632 + Object.values(outer).reduce((sum, [toward, away]) => sum + toward + away, 0)); assert.equal(stride, 1);
    const surfaces = text.trim().split(/\r?\n/).map(line => line.trim().split(/\s+/)[3] ?? 'argon');
    const counted = (surface: string, approaching: boolean) => points.filter((point, index) => surfaces[index] === surface && (point.kmS < 0) === approaching).length;
    assert.equal(counted('argon', true), 6078); assert.equal(counted('argon', false), 4554);
    for (const [surface, [toward, away]] of Object.entries(outer)) { assert.equal(counted(surface, true), toward, surface); assert.equal(counted(surface, false), away, surface); }
    // Their mean lies near the expansion centre, the recipe's target, on the photograph.
    const [cx, cy] = photographPixel(recipe, (recipe.target.raDeg - recipe.observation.centerRaDeg) * Math.cos(recipe.observation.centerDecDeg * Math.PI / 180) * 3600, (recipe.target.decDeg - recipe.observation.centerDecDeg) * 3600);
    const mean = points.reduce((sum, point) => [sum[0] + point.x / points.length, sum[1] + point.y / points.length], [0, 0]);
    const pixelArcsec = recipe.observation.fieldOfViewDeg[0] * 3600 / recipe.photograph.width;
    assert.ok(Math.hypot(mean[0] - cx, mean[1] - cy) * pixelArcsec < 30, `${id}: the ejecta's mean is ${Math.hypot(mean[0] - cx, mean[1] - cy) * pixelArcsec} arcsec from the centre`);
  }
  // A long table is shown evenly thinned, never cut.
  const recipe = readPlateRecipe(recipeOf('src/objects/cassiopeia-a-layers'));
  const thinned = speedPoints(recipe, { path: 't', source: '', columns: { east: 0, north: 1, kmS: 2 } }, Array.from({ length: 25 }, (_, row) => `0 0 ${row - 12}`).join('\n'), 10);
  assert.equal(thinned.stride, 3); assert.equal(thinned.points.length, 9); assert.equal(thinned.points.at(-1)!.kmS, 12);
});

test('Reset geometry writes back only the slider numbers, and the recipe text returns exactly to the snapshot', () => {
  for (const object of plateObjects) {
    const text = readFileSync(resolve(root, object, 'source/recipe.json'), 'utf8'), snapshot = geometryValues(JSON.parse(text));
    const [first, second] = geometryFields(JSON.parse(text));
    if (!first || !second) continue;
    // Two slider edits and an edit outside geometry that Reset geometry must keep.
    let edited = setRecipeNumber(setRecipeNumber(text, first.path, first.value + 1), second.path, second.value * 2 + 1);
    const other = JSON.parse(edited) as { id?: unknown }; other.id = `${String(other.id)}-kept`;
    edited = edited.replace(JSON.stringify(JSON.parse(text).id), JSON.stringify(other.id));
    const writes = geometryRestore(geometryValues(JSON.parse(edited)), snapshot);
    assert.deepEqual(writes.map(item => item.path).sort(), [first.path, second.path].sort(), object);
    const restored = writes.reduce((value, item) => setRecipeNumber(value, item.path, item.value), edited);
    assert.equal(restored, text.replace(JSON.stringify(JSON.parse(text).id), JSON.stringify(other.id)), object);
  }
});
