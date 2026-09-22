import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { readObservationRecipe } from '../../../features/observations/recipe.js';
import { publisherTransform, verifyRegistration, type Pair } from '@cssearth/nebula-reconstruction/registration/stellar';
import { loadMatchedStarCatalogue, readMatchedStarCatalogue, calibratedInitialTransform } from './matched-star-catalogue.js';
test('actual inspected native identities pass unchanged affine gates and reject shift, parity and scale corruption', async () => {
  const recipe = readObservationRecipe(JSON.parse(await readFile('labs/nebula/models/m1/observations.json', 'utf8')));
  const reference = recipe.images.find(image => image.id === recipe.referenceId)!, referenceMatrix = publisherTransform(reference, recipe.frame);
  for (const id of ['hubble-2017-bridge', 'webb-components']) {
    const source = recipe.images.find(image => image.id === id)!, publisher = publisherTransform(source, recipe.frame);
    const initial = await calibratedInitialTransform(source, reference, recipe.frame, publisher);
    const pairs = await loadMatchedStarCatalogue(source, reference, referenceMatrix);
    const verify = (pairs: Pair[], prior = initial) => verifyRegistration(pairs, source, recipe.frame, prior, { ...reference, imageToFrame: referenceMatrix });
    assert.equal(verify(pairs).pass, true);
    const shifted: Pair[] = pairs.map(pair => ({ ...pair, frame: [pair.frame[0] + 30, pair.frame[1]] }));
    const mirrored: Pair[] = pairs.map(pair => ({ ...pair, frame: [recipe.frame.width - pair.frame[0], pair.frame[1]] }));
    const scaled: Pair[] = pairs.map(pair => ({ ...pair, frame: [512 + (pair.frame[0] - 512) * 1.1, 512 + (pair.frame[1] - 512) * 1.1] }));
    for (const broken of [shifted, mirrored, scaled]) assert.equal(verify(broken).pass, false);
    if (source.astrometricCalibration) assert.equal(verify(pairs, publisher).pass, false, 'Deleting the explicit scale calibration must restore the failed publisher plausibility gate.');
    const raw = JSON.parse(await readFile(source.matchedStarCatalogue!.path, 'utf8'));
    raw.stars[0].visuallyInspected = false; assert.throws(() => readMatchedStarCatalogue(raw, source, reference, referenceMatrix), /visually inspected/);
    raw.stars[0].visuallyInspected = true;
  }
});
