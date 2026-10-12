/** Restore the unchanged Band 6 reference image from ALMA's public science-verification bundle. */
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { projectRoot } from '@cssearth/core/node';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { readFitsHdus } from '@cssearth/fits';
import { scratchSourceCachePath } from '@cssearth/objects';
import { RUNTIME_ASSET_ORIGIN, sourceCacheUrl } from '@cssearth/bake/objects/sources';

const root = projectRoot(import.meta.url);
const recipe = requireRecord(JSON.parse(await readFile(resolve(root, 'src/objects/hl-tauri-disc/source/circumstellar.json'), 'utf8')) as unknown);
const dataset = requireRecord(requireArray(recipe.datasets)[0], 'disc dataset');
const archive = requireRecord(dataset.archive, 'ALMA archive input');
const args = process.argv.slice(2);
if (args.length > 1 || args.some(arg => !arg.startsWith('--output='))) throw new TypeError('Usage: restore.mts [--output=<native FITS path>]');
const inputPath = requireString(archive.path), path = resolve(root, args[0]?.slice('--output='.length) || inputPath), expected = requireFiniteNumber(archive.bytes);
const member = requireString(archive.bundleMember), url = requireString(archive.url);

function validate(bytes: Buffer): void {
  if (bytes.byteLength !== expected) throw new Error(`The FITS image is ${bytes.byteLength} bytes, not ${expected}.`);
  const hdu = readFitsHdus(bytes)[0];
  if (!hdu || hdu.header.OBJECT !== 'HL_Tau' || hdu.dimensions[0] !== 1600 || hdu.dimensions[1] !== 1600 || hdu.header.BUNIT !== 'JY/BEAM')
    throw new Error('The downloaded member is not the declared HL Tau Band 6 sky image.');
}

let bytes = await readFile(path).catch(() => undefined);
if (bytes) validate(bytes);
else {
  const cached = await fetch(sourceCacheUrl(RUNTIME_ASSET_ORIGIN, 'local', scratchSourceCachePath(inputPath)), { signal: AbortSignal.timeout(60000) }).catch(() => undefined);
  if (cached?.ok) {
    bytes = Buffer.from(await cached.arrayBuffer());
    validate(bytes);
  } else await cached?.body?.cancel();
  if (!bytes) {
  const work = await mkdtemp(resolve(tmpdir(), 'cssearth-hl-tauri-'));
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw new Error(`ALMA reference-image bundle: HTTP ${response.status}.`);
    const bundle = resolve(work, 'reference-images.tgz');
    await writeFile(bundle, Buffer.from(await response.arrayBuffer()));
    // Read only the declared member to stdout; no archive paths are installed into the checkout.
    bytes = execFileSync('tar', ['-xOzf', bundle, member], { maxBuffer: expected + 1024 });
    validate(bytes);
  } finally { await rm(work, { recursive: true, force: true }); }
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, bytes);
}
console.log(`Restored ${path}: ${bytes.byteLength} native FITS bytes.`);
