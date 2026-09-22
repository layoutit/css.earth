import { parseLabModelJson } from '../../resources/model-paths.ts';
/** Deliver existing native-grid separation products; never separates sources or bakes a volume. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import sharp from 'sharp';
import { overlayVariantsPath, parseOverlayVariants, type OverlayVariants } from '../../features/legacy-viewer/overlay-variants.ts';
import { overlayCorners } from '@cssearth/volume-core/coordinates/overlay-wcs';
import { registeredOverlayCorners } from '@cssearth/volume-core/coordinates/overlay-registration';
import { prepareOverlayGeometry } from '../../adapters/renderer/overlay-geometry.ts';

export async function prepareOverlayVariants(planPath: string, selected: string[] = []) {
  const plan = parseLabModelJson(await readFile(planPath, 'utf8'));
  if (plan.schema !== 'cssearth-image-processing-plan@1' || !Array.isArray(plan.selections)) throw new TypeError('Invalid processing plan.');
  const alignment = parseLabModelJson((await readFile(plan.alignmentReport.path)).toString());
  if (alignment.pass !== true || alignment.status !== 'passed' || !Array.isArray(alignment.sources)) throw new TypeError('Alignment report did not pass.');
  const catalogue = parseLabModelJson(await readFile(plan.catalogue, 'utf8'));
  const directory = dirname(overlayVariantsPath), rows: OverlayVariants[] = [];
  const files: { path: string; bytes: Buffer | string }[] = [];
  if (selected.some(id => !plan.selections.some((item: { id: string }) => item.id === id))) throw new TypeError('Unknown requested image.');
  for (const selection of plan.selections) {
    if (selected.length && !selected.includes(selection.id)) continue;
    const recipe = parseLabModelJson((await readFile(selection.recipe)).toString());
    const target = catalogue.targets.find((item: { images: { id: string }[] }) => item.images.some(image => image.id === selection.id));
    const input = target?.images.find((image: { id: string }) => image.id === selection.id);
    if (!input || input.path !== recipe.source.path) throw new TypeError('Separation source differs from aligned source.');
    const proof = alignment.sources.find((item: { id: string }) => item.id === selection.id);
    const geometry = input.registration ? { kind: 'matched-star-homography', registration: input.registration } :
      { kind: 'fixed-publisher-wcs', wcs: input.wcs };
    if (!proof || proof.pass !== true || proof.status !== 'passed' || proof.sourcePath !== input.path ||
      JSON.stringify(proof.sourceDimensions) !== JSON.stringify(recipe.source.nativeDimensions) || JSON.stringify(proof.geometry) !== JSON.stringify(geometry))
      throw new TypeError('Active image registration differs from its passing alignment evidence.');
    await readFile(proof.gate.path);
    const manifest = parseLabModelJson(await readFile(`${target.directory}/overlays.json`, 'utf8'));
    const original = manifest.overlays.find((image: { id: string }) => image.id === selection.id);
    if (!original) throw new TypeError('Aligned original is missing.');
    const corners = input.registration ? registeredOverlayCorners(input.registration, recipe.source.nativeDimensions[0], recipe.source.nativeDimensions[1], manifest.frame) :
      overlayCorners(input.wcs, manifest.frame);
    const preparedGeometry = prepareOverlayGeometry(corners, original.widthPx, original.heightPx);
    if (original.style.transform !== `matrix3d(${preparedGeometry.matrix})` || original.style.width !== `${preparedGeometry.leafWidth}px` ||
      original.style.height !== `${preparedGeometry.leafHeight}px` || original.style.backgroundSize !== preparedGeometry.backgroundSize.map(value => `${value}px`).join(' ') ||
      original.style.backgroundPosition !== preparedGeometry.backgroundPosition.map(value => `${value}px`).join(' '))
      throw new TypeError('Prepared image geometry differs from its passing alignment evidence.');
    await readFile(`${target.directory}/${original.texturePath}`);
    const receiptBytes = await readFile(`${recipe.outputDirectory}/receipt.json`), receipt = parseLabModelJson(receiptBytes.toString());
    if (receipt.schema !== 'cssearth-star-separation-receipt@1' || receipt.verification?.maximumReconstructionErrorCodeValues !== 0 ||
      receipt.verification?.changedPixelsOutsideMask !== 0 || receipt.verification?.encodedRoundTripExact !== true ||
      JSON.stringify(receipt.source.nativeDimensions) !== JSON.stringify(recipe.source.nativeDimensions)) throw new TypeError('Separation accounting or source binding failed.');
    const receiptPath = `${directory}/receipts/${selection.id}.json`;
    const row: OverlayVariants = { imageId: selection.id, receiptPath, layers: [] };
    for (const [id, name, label] of [['diffuse', 'diffuse.png', 'Diffuse trial'], ['stars', 'stars.png', 'Compact residual']] as const) {
      const bytes = await readFile(`${recipe.outputDirectory}/${name}`);
      const metadata = await sharp(bytes, { unlimited: true }).metadata();
      if (metadata.width !== recipe.source.nativeDimensions[0] || metadata.height !== recipe.source.nativeDimensions[1])
        throw new TypeError('Separation changed the native pixel grid.');
      const maximum = Math.min(4096, Math.max(original.widthPx, original.heightPx));
      const output = await sharp(bytes, { unlimited: true }).toColourspace('srgb')
        .resize({ width: maximum, height: maximum, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 92, alphaQuality: 100, effort: 5 }).toBuffer({ resolveWithObject: true });
      const texturePath = `${directory}/prepared/${selection.id}-${id}.webp`;
      files.push({ path: texturePath, bytes: output.data });
      row.layers.push({ id, label, texturePath, widthPx: output.info.width, heightPx: output.info.height });
    }
    files.push({ path: receiptPath, bytes: JSON.stringify({ ...receipt, delivery: { layers: row.layers,
      note: 'Full source extent, reduced delivery sampling only. Original sky geometry and placement reused. No crop, tone change or 3D reconstruction.' } }, null, 2) + '\n' });
    rows.push(row);
  }
  const previous = selected.length ? parseOverlayVariants(parseLabModelJson(await readFile(overlayVariantsPath, 'utf8'))) : [];
  const result = { schema: 'cssearth-nebula-overlay-variants@1', variants: [...previous.filter(row => !selected.includes(row.imageId)), ...rows] };
  parseOverlayVariants(result);
  for (const file of files) { await mkdir(dirname(file.path), { recursive: true }); await writeFile(file.path, file.bytes); }
  await writeFile(overlayVariantsPath, JSON.stringify(result, null, 2) + '\n');
  for (const row of rows) console.log(`${row.imageId}: ${row.layers.length} prepared inspection layers`);
  return result;
}
if (process.argv[1] && resolve(process.argv[1]).endsWith('prepare-overlay-variants.mjs')) {
  if (!process.argv[2]) throw new TypeError('Usage: run.ts prepare-overlay-variants <plan.json> [image-id ...]');
  await prepareOverlayVariants(process.argv[2], process.argv.slice(3));
}
