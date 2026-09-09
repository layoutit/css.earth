import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const recipe = { size: 288, fit: 'inside', withoutEnlargement: true, quality: 88, alphaQuality: 100, trimTransparentArtwork: true };

/** Small, pinned mission artwork; never a runtime image transformation. */
export async function prepareSpacecraft({ acquire = false, force = false } = {}) {
  const catalog = JSON.parse(await readFile(resolve(root, 'site/source/spacecraft/catalog.json'), 'utf8'));
  const output = resolve(root, 'public/shell/spacecraft');
  const cache = resolve(root, '.local/spacecraft-inputs');
  await mkdir(output, { recursive: true });
  await mkdir(cache, { recursive: true });
  const previous = await readFile(resolve(root, 'site/prepared-spacecraft.json'), 'utf8').then(JSON.parse).catch(error => {
    if (error.code === 'ENOENT') return {}; throw error;
  });
  const prepared = {};
  for (const entry of catalog.spacecraft) {
    if (!/^[a-z][a-z0-9-]*$/u.test(entry.id) || prepared[entry.id]
        || !/^[a-f0-9]{64}$/u.test(entry.image.sourceSha256)) throw new TypeError('Invalid spacecraft catalog identity.');
    const filename = `${entry.id}-${entry.image.kind}.webp`, path = resolve(output, filename);
    const old = previous[entry.id];
    const existing = await readFile(path).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
    let bytes = existing;
    if (force || !bytes || old?.image.sourceSha256 !== entry.image.sourceSha256 || digest(bytes) !== old?.image.sha256
        || JSON.stringify(old?.image.recipe) !== JSON.stringify(recipe)) {
      const sourcePath = resolve(cache, entry.image.sourceSha256);
      let source = await readFile(sourcePath).catch(error => { if (error.code === 'ENOENT') return null; throw error; });
      if (!source && acquire) {
        const response = await fetch(entry.image.url);
        if (!response.ok) throw new Error(`Spacecraft image download failed: ${entry.id}, ${response.status}`);
        source = Buffer.from(await response.arrayBuffer());
      }
      if (!source) throw new Error(`Missing pinned spacecraft image ${entry.id}. Run pnpm prepare:spacecraft -- --acquire.`);
      if (source.length !== entry.image.sourceBytes || digest(source) !== entry.image.sourceSha256)
        throw new Error(`Spacecraft source identity changed: ${entry.id}.`);
      await writeFile(sourcePath, source);
      let pipeline = sharp(source).rotate();
      // Remove transparent canvas padding while keeping the complete artwork.
      if ((await sharp(source).metadata()).hasAlpha) pipeline = pipeline.trim({ background: '#00000000' });
      bytes = await pipeline.resize(recipe.size, recipe.size, { fit: recipe.fit, withoutEnlargement: recipe.withoutEnlargement })
        .webp({ quality: recipe.quality, alphaQuality: recipe.alphaQuality }).toBuffer();
      await writeFile(path, bytes);
    }
    const metadata = await sharp(bytes).metadata();
    prepared[entry.id] = { ...entry, image: { ...entry.image, src: `/shell/spacecraft/${filename}`,
      width: metadata.width, height: metadata.height, bytes: bytes.length, sha256: digest(bytes), recipe } };
  }
  await writeFile(resolve(root, 'site/prepared-spacecraft.json'), JSON.stringify(prepared, null, 2) + '\n');
  return prepared;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const entries = await prepareSpacecraft({ acquire: process.argv.includes('--acquire'), force: process.argv.includes('--force') });
  console.log(`Prepared ${Object.keys(entries).length} mission images (${Object.values(entries).reduce((n, entry) => n + entry.image.bytes, 0)} bytes).`);
}
