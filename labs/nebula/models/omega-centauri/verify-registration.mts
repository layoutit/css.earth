/** Replay native registration from the actual processing recipe and embedded TIFF AVM metadata. */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { readObservationRecipe, observationSourceFile, type ObservationSource } from '../../packages/lab/src/features/observations/recipe.ts';
import { detectStars, matchStars, verifyRegistration, publisherTransform } from '../../packages/reconstruction/src/registration/stellar.ts';

const root = process.cwd(), directory = 'labs/nebula/models/omega-centauri';
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const recipeBytes = await readFile(resolve(root, directory, 'observations.json'));
const recipe = readObservationRecipe(JSON.parse(recipeBytes.toString()));
const reference = recipe.images.find(image => image.id === recipe.referenceId)!;
const source = recipe.images.find(image => image.id === 'eso0844a')!;
if (!source || reference.id !== 'eso1119b') throw new Error('Expected the two pinned ESO observations.');

function avmPair(xml: string, key: string): [number, number] {
  const section = xml.match(new RegExp(`<avm:Spatial\\.${key}>([\\s\\S]*?)</avm:Spatial\\.${key}>`));
  if (!section) throw new Error(`Missing AVM ${key}.`);
  const values = [...section[1]!.matchAll(/<rdf:li>([^<]+)<\/rdf:li>/g)].map(match => Number(match[1]));
  if (values.length !== 2 || !values.every(Number.isFinite)) throw new Error(`Invalid AVM ${key}.`);
  return [values[0]!, values[1]!];
}
async function loadNative(image: ObservationSource) {
  const path = resolve(root, '.local/nebula-lab/observations', recipe.id, 'sources', observationSourceFile(image));
  const bytes = await readFile(path);
  if (sha256(bytes) !== image.sha256) throw new Error(`${image.id}: source hash differs.`);
  const metadata = await sharp(bytes).metadata(), xml = metadata.xmp?.toString();
  if (!xml || metadata.width !== image.width || metadata.height !== image.height) throw new Error(`${image.id}: missing native AVM or dimensions differ.`);
  const rotation = xml.match(/avm:Spatial.Rotation="([^"]+)"/);
  if (!rotation || !Number.isFinite(Number(rotation[1])) || !xml.includes('avm:Spatial.CoordinateFrame="ICRS"') ||
    !xml.includes('avm:Spatial.CoordsystemProjection="TAN"')) throw new Error(`${image.id}: unexpected native sky frame.`);
  const wcs = { projection: 'TAN', coordinateFrame: 'ICRS', referenceDimension: avmPair(xml, 'ReferenceDimension'),
    referencePixel: avmPair(xml, 'ReferencePixel'), referenceValueDeg: avmPair(xml, 'ReferenceValue'),
    scaleDeg: avmPair(xml, 'Scale'), rotationDeg: Number(rotation[1]) };
  assert.deepEqual(image.wcs, wcs, `${image.id}: recipe must retain exact embedded AVM, including noncentral reference pixel.`);
  const settings = image.registrationDetection;
  if (!settings) throw new Error('Explicit native registration detection settings required.');
  console.log(`REGISTRATION_DETECT ${image.id}`);
  const stars = await detectStars(bytes, [image.width, image.height], settings.sourceMaximum, settings.maximumStars);
  return { stars, avmSha256: sha256(Buffer.from(xml)), wcs };
}
const referenceNative = await loadNative(reference), sourceNative = await loadNative(source);
const referenceInitial = publisherTransform(reference, recipe.frame), sourceInitial = publisherTransform(source, recipe.frame);
const footprint = { width: reference.width, height: reference.height, imageToFrame: referenceInitial };
const pairs = matchStars(sourceNative.stars, referenceNative.stars, sourceInitial, referenceInitial);
const result = verifyRegistration(pairs, source, recipe.frame, sourceInitial, footprint);
assert.equal(result.pass, true, 'The unchanged native registration gate must pass.');
const centred = structuredClone(source);
assert.ok(centred.wcs);
centred.wcs.referencePixel = [centred.wcs.referenceDimension[0] / 2, centred.wcs.referenceDimension[1] / 2];
const centredResult = verifyRegistration(pairs, centred, recipe.frame, publisherTransform(centred, recipe.frame), footprint);
assert.equal(centredResult.pass, false, 'Reinstating the lost AVM offset must fail.');
const corrupted = structuredClone(pairs), heldOut = result.evidence.matches.find(match => match.heldOut)!;
corrupted.find(pair => pair.source[0] === heldOut.source[0] && pair.source[1] === heldOut.source[1])!.frame[0] += 3;
const corruptedResult = verifyRegistration(corrupted, source, recipe.frame, sourceInitial, footprint);
assert.equal(corruptedResult.pass, false, 'A wrong held-out identity must fail.');
const output = resolve(root, 'output/omega-centauri-registration');
await mkdir(output, { recursive: true });
const fullReceipt = Buffer.from(JSON.stringify({ recipeSha256: sha256(recipeBytes), result }, null, 2) + '\n');
await writeFile(resolve(output, 'native-registration-full.json'), fullReceipt);
const { matches: _matches, ...evidence } = result.evidence;
const receipt = { schema: 'cssearth-nebula-intake-registration-evidence@1', objectId: recipe.id,
  checkedAt: new Date().toISOString().slice(0, 10), recipeSha256: sha256(recipeBytes),
  implementationSha256: sha256(await readFile(resolve(root, 'labs/nebula/packages/reconstruction/src/registration/stellar.ts'))),
  method: 'Exact native AVM WCS; automatic reciprocal field-star constellations, unchanged RANSAC affine and spatial holdout gates. Full native source pixels, bounded 8000-pixel detection only.',
  source: { id: source.id, sha256: source.sha256, width: source.width, height: source.height, avmSha256: sourceNative.avmSha256, wcs: sourceNative.wcs },
  reference: { id: reference.id, sha256: reference.sha256, width: reference.width, height: reference.height, avmSha256: referenceNative.avmSha256, wcs: referenceNative.wcs },
  frame: recipe.frame, matrix: result.matrix, pass: result.pass, evidence,
  controls: { recentredPublisherReferencePixel: { pass: centredResult.pass, centreShiftPixels: centredResult.evidence.centreShiftPixels },
    corruptedHeldOutIdentity: { pass: corruptedResult.pass, maxResidualPixels: corruptedResult.evidence.maxResidualPixels } },
  fullReceipt: { path: 'output/omega-centauri-registration/native-registration-full.json', sha256: sha256(fullReceipt) },
  limits: 'Relative alignment only; publisher absolute astrometry is not independently catalogue calibrated. WFI includes publisher-declared DSS gap fill. No depth, membership or photometric calibration is established.' };
await writeFile(resolve(root, directory, 'native-registration.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ pass: result.pass, ...evidence }, null, 2));
console.log('OMEGA_NATIVE_REGISTRATION_VERIFIED');
