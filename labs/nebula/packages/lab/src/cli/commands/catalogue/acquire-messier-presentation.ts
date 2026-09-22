/** Cache pinned 192px recognition JPEGs only. Never writes the science catalogue or inventory. */
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { readMessierPresentation, type MessierPresentationObject } from '../../../features/catalogue/presentation.ts';

const dataPath = 'labs/nebula/models/messier/presentation.json';
const cacheRoot = '.local/nebula-lab/catalogue/messier/thumbnails';
const maximumBytes = 512 * 1024;

export async function validateThumbnail(bytes: Buffer) {
  if (!bytes.length || bytes.length > maximumBytes || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new TypeError('Expected a bounded JPEG recognition image.');
  const metadata = await sharp(bytes).metadata();
  if (metadata.format !== 'jpeg' || metadata.width !== 192 || metadata.height !== 192 || metadata.channels !== 3) throw new TypeError('Expected a 192×192 RGB JPEG.');
  // Decode pixels as well: a plausible JPEG header alone does not prove an intact preview.
  await sharp(bytes).raw().toBuffer();
  return { bytes: bytes.length, width: 192, height: 192 };
}

async function acquire(url: string): Promise<Buffer> {
  const parsed = new URL(url);
  if (parsed.origin !== 'https://alasky.cds.unistra.fr' || parsed.pathname !== '/hips-image-services/hips2fits' ||
      parsed.searchParams.get('format') !== 'jpg' || parsed.searchParams.get('width') !== '192' || parsed.searchParams.get('height') !== '192' ||
      parsed.searchParams.get('hips') !== 'CDS/P/DSS2/color') throw new TypeError('Only the documented tiny DSS2 recognition requests are allowed.');
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok || !/^image\/jpeg(?:;|$)/i.test(response.headers.get('content-type') ?? '') ||
      Number(response.headers.get('content-length') ?? 0) > maximumBytes) {
    await response.body?.cancel(); throw new Error(`DSS2 JPEG request failed: HTTP ${response.status}.`);
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No recognition image body.');
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.byteLength; if (size > maximumBytes) throw new Error('Recognition response exceeds 512 KiB.'); chunks.push(result.value);
    }
  } catch (error) { await reader.cancel(); throw error; }
  return Buffer.concat(chunks);
}

async function cacheObject(root: string, object: MessierPresentationObject): Promise<'cached' | 'downloaded'> {
  const localPath = `${cacheRoot}/${object.objectId}.jpg`, destination = resolve(root, localPath);
  let bytes: Buffer | undefined;
  try { bytes = await readFile(destination); }
  catch (error) { if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error; }
  if (bytes) {
    const metadata = await validateThumbnail(bytes);
    if (object.thumbnail.bytes !== metadata.bytes) throw new Error(`Cached byte count changed: ${object.objectId}.`);
    object.thumbnail.localPath = localPath; return 'cached';
  }
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try { bytes = await acquire(object.thumbnail.url); lastError = undefined; break; }
    catch (error) { lastError = error; }
  }
  if (lastError || !bytes) throw lastError ?? new Error('No recognition image.');
  const metadata = await validateThumbnail(bytes);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(`${destination}.tmp`, bytes); await rename(`${destination}.tmp`, destination);
  Object.assign(object.thumbnail, metadata, { localPath }); return 'downloaded';
}

export async function acquireMessierPresentation(root: string, args: string[]) {
  const selected = new Set<string>();
  for (const arg of args) {
    if (!/^--object=m([1-9]|[1-9][0-9]|10[0-9]|110)$/.test(arg)) throw new TypeError('Usage: acquire-messier-presentation [--object=m42 ...]');
    selected.add(arg.slice('--object='.length));
  }
  const path = resolve(root, dataPath), original = await readFile(path, 'utf8');
  const presentation = readMessierPresentation(JSON.parse(original));
  const queue = presentation.objects.filter(object => !selected.size || selected.has(object.objectId));
  let next = 0, downloaded = 0, cached = 0;
  const failures: string[] = [];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < queue.length) {
      const object = queue[next++]!;
      try {
        const status = await cacheObject(root, object); if (status === 'cached') cached++; else downloaded++;
        console.log(`MESSIER_THUMBNAIL ${object.objectId} ${status} ${object.thumbnail.bytes} bytes`);
      } catch (error) { failures.push(`${object.objectId}: ${error instanceof Error ? error.message : String(error)}`); }
    }
  }));
  // Keep metadata edits from a parallel source intake; rerun after that writer finishes.
  if (!Buffer.from(await readFile(path, 'utf8')).equals(Buffer.from(original))) throw new Error('Presentation metadata changed during acquisition; rerun with one presentation writer.');
  readMessierPresentation(presentation);
  await writeFile(`${path}.tmp`, `${JSON.stringify(presentation, null, 2)}\n`); await rename(`${path}.tmp`, path);
  console.log(`MESSIER_PRESENTATION_SAVED selected=${queue.length} downloaded=${downloaded} cached=${cached} failed=${failures.length}`);
  if (failures.length) throw new Error(failures.join('\n'));
}

if (/^acquire-messier-presentation\.(?:ts|mjs)$/.test(basename(process.argv[1] ?? ''))) {
  await acquireMessierPresentation(resolve(dirname(fileURLToPath(import.meta.url)), '../../../..'), process.argv.slice(2));
}
