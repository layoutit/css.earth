/** Acquire full observations, verify field stars, then explicitly separate stars on the native grid. */
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { readObservationRecipe, scienceObservationSources, observationSourceFile } from '../../features/observations/recipe.ts';
import { detectStars, publisherTransform, publisherRegistration, matchStars, verifyRegistration } from '@cssearth/nebula-reconstruction/registration/stellar';
import { applyAffine, invertAffine } from '@cssearth/nebula-reconstruction/registration/affine';
import { nativeStarless } from '../../server/workflows/emission-inference/native-source.ts';
import { detectCompactStars, matchCompactStars } from '@cssearth/nebula-reconstruction/registration/compact';
import { transferRegistration, type RegistrationEvidence } from '../../server/workflows/observations/registration-transfer.ts';
import { nativePreserved } from '../../server/workflows/emission-inference/native-preserved.ts';
import { loadMatchedStarCatalogue, calibratedInitialTransform } from '../../server/workflows/observations/matched-star-catalogue.ts';
import { loadNativeSeparationCache, nativeSeparationCacheDirectory } from '../../server/workflows/observations/native-separation-cache.ts';
import { composeSkyBandSource } from '../../server/workflows/observations/sky-band-source.ts';
import { verifySkyBandRecipe } from '../../adapters/sources/sky-bands.ts';

const [recipePath, mode, extra] = process.argv.slice(2);
if (!recipePath || extra || (mode && mode !== '--alignment-only')) throw new TypeError('Usage: prepare-observations <recipe.json> [--alignment-only]');
const recipeBytes = await readFile(recipePath), recipe = readObservationRecipe(JSON.parse(recipeBytes.toString()));
const nativeSeparationCache = await loadNativeSeparationCache(recipe);
const directory = resolve('.local/nebula-lab/observations', recipe.id);
const sha = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const json = async (file: string, data: unknown) => { await writeFile(`${file}.pending`, JSON.stringify(data, null, 2) + '\n'); await rename(`${file}.pending`, file); };
await mkdir(resolve(directory, 'sources'), { recursive: true });
const sources: Array<{ source: typeof recipe.images[number]; bytes: Buffer; stars: Awaited<ReturnType<typeof detectStars>>;
  initial: ReturnType<typeof publisherTransform>; publisherInitial: ReturnType<typeof publisherTransform> }> = [];
for (const source of recipe.images) {
  const path = resolve(directory, 'sources', observationSourceFile(source));
  if (source.skyBands) await verifySkyBandRecipe(source.skyBands, file => readFile(resolve(process.cwd(), file)));
  let bytes: Buffer;
  try { bytes = await readFile(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    if (source.skyBands) {
      console.log(`OBSERVATION_COMPOSE ${source.id}`);
      if (!source.wcs) throw new Error(`${source.id}: a sky band source needs its grid WCS.`);
      const composed = await composeSkyBandSource({ ...source, wcs: source.wcs, skyBands: source.skyBands });
      bytes = composed.bytes;
      await json(resolve(directory, 'sources', `${source.id}.sky-bands.json`), composed.evidence);
    } else {
      console.log(`OBSERVATION_DOWNLOAD ${source.id}`);
      const response = await fetch(source.url);
      if (!response.ok) throw new Error(`Source download failed: ${response.status}`);
      bytes = Buffer.from(await response.arrayBuffer());
    }
    await writeFile(path, bytes);
  }
  const metadata = await sharp(bytes).metadata();
  if (metadata.width !== source.width || metadata.height !== source.height) throw new Error(`${source.id}: native dimensions differ.`);
  const stars = source.registrationTransfer || source.registrationMode === 'publisher-wcs' ? [] : source.registrationMode === 'compact-stars'
    ? await detectCompactStars(bytes, [source.width, source.height], source.compactStarChannel, 500)
    : await detectStars(bytes, [source.width, source.height], source.registrationDetection?.sourceMaximum, source.registrationDetection?.maximumStars);
  const publisherInitial = publisherTransform(source, recipe.frame);
  const initial = await calibratedInitialTransform(source, recipe.images.find(image => image.id === recipe.referenceId)!, recipe.frame, publisherInitial);
  console.log(`OBSERVATION_STARS ${source.id} ${stars.length}`);
  sources.push({ source, bytes, stars, initial, publisherInitial });
}
const reference = sources.find(row => row.source.id === recipe.referenceId)!;
const aligned: Array<typeof sources[number] & { imageToFrame: typeof reference.initial;
  registration: RegistrationEvidence }> = [];
const expandedStars = new Map<string, Awaited<ReturnType<typeof detectStars>>>();
const expand = async (row: typeof sources[number], workingMaximum = 2048, maximumStars = 12000) => {
  const key = `${row.source.id}:${workingMaximum}:${maximumStars}`;
  let stars = expandedStars.get(key);
  if (!stars) { stars = await detectStars(row.bytes, [row.source.width, row.source.height], workingMaximum, maximumStars); expandedStars.set(key, stars); }
  return stars;
};
for (const row of sources) {
  if (row === reference || row.source.registrationTransfer) continue;
  let result: ReturnType<typeof verifyRegistration> | undefined;
  const attempts: unknown[] = [];
  const publisherOnly = row.source.registrationMode === 'publisher-wcs' || reference.source.registrationMode === 'publisher-wcs';
  const compact = row.source.registrationMode === 'compact-stars' || reference.source.registrationMode === 'compact-stars';
  if (row.source.matchedStarCatalogue) {
    const pairs = await loadMatchedStarCatalogue(row.source, reference.source, reference.initial);
    result = verifyRegistration(pairs, row.source, recipe.frame, row.initial, { width: reference.source.width, height: reference.source.height, imageToFrame: reference.initial });
    result.evidence.interpretation = 'Explicit native stellar identities established by model-assisted search and visual inspection. Held-out residuals evaluate only the affine fit conditional on those identities; discovery is not a blind test. Absolute astrometry remains publisher metadata.';
    attempts.push({ matchedStarCatalogue: row.source.matchedStarCatalogue, astrometricCalibration: row.source.astrometricCalibration, publisherInitial: row.publisherInitial, calibratedInitial: row.initial, pass: result.pass });
  }
  const detection = row.source.registrationDetection;
  for (const maximumStars of row.source.matchedStarCatalogue || publisherOnly ? [] : compact ? [250, 500] : detection ? [detection.maximumStars] : [6000, 12000]) {
    try {
      const pool = compact ? await Promise.all([row, reference].map(r => r.source.registrationMode === 'compact-stars' ? r.stars.slice(0, maximumStars) : detectCompactStars(r.bytes, [r.source.width, r.source.height], r.source.compactStarChannel, maximumStars)))
        : detection ? [row.stars, await expand(reference, detection.referenceMaximum, detection.maximumStars)]
        : maximumStars === 6000 ? [row.stars, reference.stars] : [await expand(row), await expand(reference)];
      const pairs = (compact ? matchCompactStars : matchStars)(pool[0]!, pool[1]!, row.initial, reference.initial);
      result = verifyRegistration(pairs, row.source, recipe.frame, row.initial,
        { width: reference.source.width, height: reference.source.height, imageToFrame: reference.initial });
      attempts.push({ maximumStars, ...(detection ? { detection } : {}), sourceStars: pool[0]!.length, referenceStars: pool[1]!.length, pass: result.pass, evidence: { ...result.evidence, matches: undefined } });
      if (result.pass) break;
    } catch (error) { attempts.push({ maximumStars, pass: false, error: error instanceof Error ? error.message : String(error) }); }
    console.log(`OBSERVATION_ALIGNMENT_RETRY ${row.source.id}; pool=${maximumStars}; residual gates unchanged`);
  }
  if (!result) result = { pass: false, matrix: row.initial, evidence: publisherRegistration(publisherOnly
    ? 'Publisher WCS only. This band is not configured for stellar registration; diffuse knots must not be treated as stars.'
    : 'Publisher WCS only. Neither bounded star pool passed registration; see the registration receipt for failed attempts.') };
  if (row.source.coordinateOrigin === 'authored-bright-star-seed') result.evidence.interpretation = result.pass
    ? 'Relative stellar registration from an authored bright-star seed; absolute astrometry is inherited from the reference image. Outer-field distortion is not measured.'
    : 'Authored bright-star seed only, not publisher astrometry. The unchanged independent-star residual gate has not passed; no removal or reconstruction input.';
  await json(resolve(directory, `${row.source.id}-registration.json`), { ...result, attempts });
  console.log(`OBSERVATION_ALIGNMENT ${row.source.id} ${JSON.stringify({ ...result.evidence, matches: undefined })}`);
  // Failed relative fits remain inspectable at the original publisher placement.
  // They never become inputs to star removal or reconstruction.
  aligned.push({ ...row, imageToFrame: result.pass ? result.matrix : row.initial, registration: { ...result.evidence, referenceId: recipe.referenceId } });
}
const anchorPeer = aligned.find(row => row.registration.status === 'verified') ?? aligned[0]!;
if (!anchorPeer) throw new Error('A second direct observation must corroborate the sky anchor before any grid transfer.');
aligned.push({ ...reference, imageToFrame: reference.initial, registration: { ...anchorPeer.registration, referenceId: anchorPeer.source.id,
  matches: anchorPeer.registration.matches.map(match => ({ ...match, source: applyAffine(invertAffine(reference.initial), match.frame), frame: applyAffine(anchorPeer.imageToFrame, match.source), predictedFrame: match.frame })),
  interpretation: anchorPeer.registration.status === 'verified'
    ? 'Publisher sky anchor; corroborated by other images through held-out stars. Absolute sky coordinates are not independently catalogue calibrated.'
    : 'Publisher sky anchor only; relative star registration failed. No removal or reconstruction is authorized by this preview.' } });
await json(resolve(directory, `${reference.source.id}-registration.json`), { pass: aligned.at(-1)!.registration.status === 'verified',
  matrix: reference.initial, evidence: aligned.at(-1)!.registration });
for (const row of sources.filter(row => row.source.registrationTransfer)) {
  const bridge = aligned.find(candidate => candidate.source.id === row.source.registrationTransfer!.referenceId);
  let result: { matrix: typeof row.initial; evidence: RegistrationEvidence };
  try {
    if (!bridge) throw new Error('Registration bridge is missing.');
    result = await transferRegistration(row.source, bridge.source, bridge.imageToFrame, bridge.registration);
  } catch (error) {
    result = { matrix: row.initial, evidence: { ...publisherRegistration(error instanceof Error ? error.message : String(error)), referenceId: row.source.registrationTransfer!.referenceId } };
  }
  aligned.push({ ...row, imageToFrame: result.matrix, registration: result.evidence });
  await json(resolve(directory, `${row.source.id}-registration.json`), { ...result });
  console.log(`OBSERVATION_ALIGNMENT ${row.source.id} ${JSON.stringify({ ...result.evidence, matches: undefined })}`);
}
const verified = aligned.every(row => row.registration.status !== 'publisher');
type Layer = { path: string; width: number; height: number; sha256: string };
const preview = async (output: string, layer: string, bytes: Buffer): Promise<Layer> => {
  const path = resolve(output, `${layer}.png`);
  const info = await sharp(bytes).removeAlpha().toColourspace('srgb').resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true }).png().toFile(path);
  return { path: relative(process.cwd(), path), width: info.width, height: info.height, sha256: sha(await readFile(path)) };
};
const images: Array<{ id: string; label: string; source: typeof recipe.images[number] & { path: string };
  layers: { original: Layer; diffuse?: Layer; stars?: Layer }; imageToFrame: typeof reference.initial;
  publisherImageToFrame: typeof reference.initial; registration: typeof anchorPeer.registration; removal?: unknown }> = [];
async function addSeparation(image: typeof images[number], row: typeof aligned[number], allowProcessing: boolean): Promise<boolean> {
  const source = row.source, output = resolve(directory, source.id), preserve = source.stellarTreatment === 'preserve';
  const reusedDirectory = !allowProcessing && nativeSeparationCache ? nativeSeparationCacheDirectory(recipe, nativeSeparationCache, source) : undefined;
  const noxDirectory = reusedDirectory ?? resolve(output, preserve ? 'native-preserved' : 'native-nox');
  const reuse = reusedDirectory ? { nativeSeparationCache: recipe.nativeSeparationCache, sourceId: source.id } : {};
  if (!allowProcessing) {
    try { await stat(resolve(noxDirectory, 'result.json')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
  }
  if (preserve) {
    const separated = await nativePreserved(row.bytes, [source.width, source.height], noxDirectory, { allowProcessing });
    image.layers.diffuse = await preview(output, 'diffuse', await readFile(resolve(noxDirectory, 'diffuse.png')));
    image.layers.stars = await preview(output, 'stars', await readFile(resolve(noxDirectory, 'stars.png')));
    image.removal = { ...separated.provenance, ...reuse, nativeDimensions: [source.width, source.height], interpretation: 'Star removal not applicable; compact structural emission and any foreground stars are preserved.' };
    return true;
  }
  const separated = await nativeStarless(row.bytes, [source.width, source.height],
    { ...recipe.nativeRemoval, directory: relative(process.cwd(), noxDirectory) }, { allowProcessing });
  const diffuseBytes = await readFile(resolve(noxDirectory, 'diffuse.png')), starBytes = await readFile(resolve(noxDirectory, 'stars.png'));
  const receipt: unknown = JSON.parse(await readFile(resolve(noxDirectory, 'result.json'), 'utf8'));
  if (!receipt || typeof receipt !== 'object' || !('artifactSha256' in receipt) || !('applied' in receipt)) throw new Error('Missing native receipt artifacts.');
  const artifacts = receipt.artifactSha256, applied = receipt.applied;
  if (!artifacts || typeof artifacts !== 'object' || !('stars.png' in artifacts) || sha(starBytes) !== artifacts['stars.png'] ||
      !applied || typeof applied !== 'object' || !('verification' in applied)) throw new Error(`${source.id}: native residual/receipt differs.`);
  const metadata = await sharp(starBytes).metadata();
  if (metadata.width !== source.width || metadata.height !== source.height || metadata.channels !== 3) throw new Error('Native residual grid differs.');
  image.layers.diffuse = await preview(output, 'diffuse', diffuseBytes);
  image.layers.stars = await preview(output, 'stars', starBytes);
  image.removal = { ...separated.provenance, ...reuse, nativeDimensions: [source.width, source.height], residualSha256: sha(starBytes), accounting: applied.verification };
  return true;
}
for (const source of scienceObservationSources(recipe)) {
  const row = aligned.find(item => item.source.id === source.id)!;
  const output = resolve(directory, source.id);
  await mkdir(output, { recursive: true });
  const original = await preview(output, 'original', row.bytes);
  const layers: { original: Layer; diffuse?: Layer; stars?: Layer } = { original };
  images.push({ id: source.id, label: source.label, source: { ...source, path: relative(process.cwd(), resolve(directory, 'sources', observationSourceFile(source))) },
    layers, imageToFrame: row.imageToFrame, publisherImageToFrame: row.publisherInitial, registration: row.registration });
  if (row.registration.status !== 'publisher' && await addSeparation(images.at(-1)!, row, false)) console.log(`NEBULA_OBSERVATION_REUSED ${source.id}`);
}
const publish = () => json(resolve(directory, 'observations.json'), { schema: 'cssearth-nebula-observations@1', id: recipe.id, frame: recipe.frame, images,
  registrationReferences: aligned.filter(row => row.source.processingRole === 'registration-reference').map(row => ({ id: row.source.id, source: row.source, imageToFrame: row.imageToFrame, registration: row.registration })),
  provenance: { recipePath, recipeSha256: sha(recipeBytes), sourceFrameConvention: 'Native raster pixel edges; pixel centres at n+.5. CSS matrix x=a*x+c*y+e, y=b*x+d*y+f.',
    registrationMethod: 'Per-source discovery records below; every direct affine fit uses the same deterministic training RANSAC, spatial holdout, residual, coverage and parity gates. Transferred bands carry reference-bridge residuals only.',
    registrationSources: aligned.map(row => ({ id: row.source.id, mode: row.source.registrationTransfer ? 'shared-grid-transfer' : row.source.matchedStarCatalogue ? 'explicit-native-star-catalogue' : row.source.registrationMode ?? 'field-stars',
      compactStarChannel: row.source.compactStarChannel ?? 'minimum-rgb', matchedStarCatalogue: row.source.matchedStarCatalogue, astrometricCalibration: row.source.astrometricCalibration,
      registrationTransfer: row.source.registrationTransfer, status: row.registration.status, matchedStars: row.registration.matchedStars, bridgeMatchedStars: row.registration.bridgeMatchedStars })),
    limits: 'Relative observation alignment, not measured 3D structure. RGB composites have different bands and stretches; no common photometric calibration is implied.' } });
await publish();
console.log(`NEBULA_ALIGNMENT_READY ${directory}/observations.json`);
if (!verified && mode !== '--alignment-only') throw new Error('Held-out star registration failed. Publisher-only image previews are available; no native removal performed.');
for (const image of images) {
  const row = aligned.find(item => item.source.id === image.id)!, source = row.source;
  if (mode !== '--alignment-only' && !image.layers.diffuse) {
    console.log(`${source.stellarTreatment === 'preserve' ? 'OBSERVATION_NATIVE_PRESERVE' : 'OBSERVATION_NATIVE_REMOVAL'} ${source.id}`);
    await addSeparation(image, row, true);
    await publish();
    console.log(`${source.stellarTreatment === 'preserve' ? 'NEBULA_OBSERVATION_PRESERVED' : 'NEBULA_OBSERVATION_REMOVED'} ${source.id}`);
  }
}
console.log(`NEBULA_OBSERVATIONS_COMPLETE ${directory}; ${images.length} aligned observations; nativeRemoval=${mode !== '--alignment-only'}`);
