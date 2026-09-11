/** Acquire full observations, verify field stars, then explicitly separate stars on the native grid. */
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { resolve, relative } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { readObservationRecipe } from '../alignment/observations/recipe.js';
import { detectStars, publisherTransform, matchStars, verifyRegistration, applyAffine, invertAffine } from '../alignment/observations/registration.js';
import { nativeStarless } from '../reconstruction/emission-inference/native-source.js';

const [recipePath, mode, extra] = process.argv.slice(2);
if (!recipePath || extra || (mode && mode !== '--alignment-only')) throw new TypeError('Usage: prepare-observations <recipe.json> [--alignment-only]');
const recipeBytes = await readFile(recipePath), recipe = readObservationRecipe(JSON.parse(recipeBytes.toString()));
const directory = resolve('.local/nebula-lab/observations', recipe.id);
const sha = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
const json = async (file: string, data: unknown) => { await writeFile(`${file}.pending`, JSON.stringify(data, null, 2) + '\n'); await rename(`${file}.pending`, file); };
await mkdir(resolve(directory, 'sources'), { recursive: true });
const sources: Array<{ source: typeof recipe.images[number]; bytes: Buffer; stars: Awaited<ReturnType<typeof detectStars>>;
  initial: ReturnType<typeof publisherTransform> }> = [];
for (const source of recipe.images) {
  const path = resolve(directory, 'sources', `${source.id}.tif`);
  let bytes: Buffer;
  try { bytes = await readFile(path); }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    console.log(`OBSERVATION_DOWNLOAD ${source.id}`);
    const response = await fetch(source.url);
    if (!response.ok) throw new Error(`Source download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (sha(bytes) !== source.sha256) throw new Error(`${source.id}: native source pin differs.`);
    await writeFile(path, bytes);
  }
  if (sha(bytes) !== source.sha256) throw new Error(`${source.id}: native source pin differs.`);
  const metadata = await sharp(bytes).metadata();
  if (metadata.width !== source.width || metadata.height !== source.height) throw new Error(`${source.id}: native dimensions differ.`);
  const stars = await detectStars(bytes, [source.width, source.height]);
  const initial = publisherTransform(source, recipe.frame);
  console.log(`OBSERVATION_STARS ${source.id} ${stars.length}`);
  sources.push({ source, bytes, stars, initial });
}
const reference = sources.find(row => row.source.id === recipe.referenceId)!;
const aligned: Array<typeof sources[number] & { imageToFrame: typeof reference.initial;
  registration: ReturnType<typeof verifyRegistration>['evidence'] & { referenceId: string } }> = [];
for (const row of sources) {
  if (row === reference) continue;
  const pairs = matchStars(row.stars, reference.stars, row.initial, reference.initial);
  const result = verifyRegistration(pairs, row.source, recipe.frame, row.initial);
  await json(resolve(directory, `${row.source.id}-registration.json`), { ...result, sourceSha256: row.source.sha256, referenceSha256: reference.source.sha256, recipeSha256: sha(recipeBytes) });
  console.log(`OBSERVATION_ALIGNMENT ${row.source.id} ${JSON.stringify({ ...result.evidence, matches: undefined })}`);
  if (!result.pass) throw new Error(`${row.source.id}: held-out star registration failed. No native removal performed.`);
  aligned.push({ ...row, imageToFrame: result.matrix, registration: { ...result.evidence, referenceId: recipe.referenceId } });
}
const anchorPeer = aligned[0]!;
aligned.push({ ...reference, imageToFrame: reference.initial, registration: { ...anchorPeer.registration, referenceId: anchorPeer.source.id,
  matches: anchorPeer.registration.matches.map(match => ({ ...match, source: applyAffine(invertAffine(reference.initial), match.frame), frame: match.predictedFrame, predictedFrame: match.frame })),
  interpretation: 'Publisher sky anchor; corroborated by other images through held-out stars. Absolute sky coordinates are not independently catalogue calibrated.' } });
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
  const source = row.source, output = resolve(directory, source.id), noxDirectory = resolve(output, 'native-nox');
  if (!allowProcessing) {
    try { await stat(resolve(noxDirectory, 'result.json')); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false; throw error; }
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
  image.removal = { ...separated.provenance, nativeDimensions: [source.width, source.height], residualSha256: sha(starBytes), accounting: applied.verification };
  return true;
}
for (const source of recipe.images) {
  const row = aligned.find(item => item.source.id === source.id)!;
  const output = resolve(directory, source.id);
  await mkdir(output, { recursive: true });
  const original = await preview(output, 'original', row.bytes);
  const layers: { original: Layer; diffuse?: Layer; stars?: Layer } = { original };
  images.push({ id: source.id, label: source.label, source: { ...source, path: relative(process.cwd(), resolve(directory, 'sources', `${source.id}.tif`)) },
    layers, imageToFrame: row.imageToFrame, publisherImageToFrame: row.initial, registration: row.registration });
  if (await addSeparation(images.at(-1)!, row, false)) console.log(`NEBULA_OBSERVATION_REUSED ${source.id}`);
}
const publish = () => json(resolve(directory, 'observations.json'), { schema: 'cssearth-nebula-observations@1', id: recipe.id, frame: recipe.frame, images,
  provenance: { recipePath, recipeSha256: sha(recipeBytes), sourceFrameConvention: 'Native raster pixel edges; pixel centres at n+.5. CSS matrix x=a*x+c*y+e, y=b*x+d*y+f.',
    registrationMethod: 'Gaussian high-pass compact maxima; reciprocal publisher-position matches; six neighbouring star-pattern confirmations within 0.4 frame pixels; fixed spatial holdout; deterministic affine RANSAC on training stars.',
    limits: 'Relative observation alignment, not measured 3D structure. RGB composites have different bands and stretches; no common photometric calibration is implied.' } });
await publish();
console.log(`NEBULA_ALIGNMENT_READY ${directory}/observations.json`);
for (const image of images) {
  const row = aligned.find(item => item.source.id === image.id)!, source = row.source;
  if (mode !== '--alignment-only' && !image.layers.diffuse) {
    console.log(`OBSERVATION_NATIVE_REMOVAL ${source.id}`);
    await addSeparation(image, row, true);
    await publish();
    console.log(`NEBULA_OBSERVATION_REMOVED ${source.id}`);
  }
}
console.log(`NEBULA_OBSERVATIONS_COMPLETE ${directory}; ${images.length} aligned observations; nativeRemoval=${mode !== '--alignment-only'}`);
