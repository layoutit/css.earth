// Maintainer command: mirror a pinned publisher input into R2 under source-cache/<sha256>/<filename>, content-addressed
// and additive. Replaces the ad hoc scripts used to seed this mirror by hand. Two forms:
//
//   node tools/assets/publish-source-cache.mts --object=<id> [...]
//     Publishes every pinned input this repository already knows how to mirror for that object: a volume's
//     publisher previews (source/presentation.json) and any *_nomenclature_center_pts.zip pinned in
//     source/manifest.json. Skips a pin whose local file is missing or does not match its own hash (run
//     restore-source-inputs first).
//
//   node tools/assets/publish-source-cache.mts --file=<path> --sha256=<hex> --bytes=<n>
//     Publishes exactly one file under its own pin, for a one-off input outside those two categories.
//
// Same verify-after-publish contract as publish-runtime-assets.mts: HEAD every key, retry a miss with a per-key
// `wrangler r2 object put`, byte-verify, exit non-zero on any remaining failure.
import { sha256 } from '../../src/platform/sha256.mts';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RUNTIME_ASSET_ORIGIN, sourceCacheKey } from './source-mirror.mts';
import { verifyPublished, reportVerification, type PublishAsset } from './publish-verification.mts';

const BUCKET = 'cssearth-assets';
const CONTENT_TYPE = 'application/octet-stream';
const CACHE_CONTROL = 'public,max-age=31536000,immutable';
const projectRoot = resolve(import.meta.dirname, '../..');

function run(command: string, args: readonly string[]): Promise<void> {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.once('error', reject);
    child.once('close', (code, signal) => code === 0 ? accept() : reject(new Error(`${command} failed: ${signal ?? code}`)));
  });
}

async function uploadOne(asset: PublishAsset): Promise<void> {
  await run('npx', ['--yes', 'wrangler@4.129.0', 'r2', 'object', 'put', `${BUCKET}/${asset.key}`,
    '--file', asset.file, '--remote', '--content-type', CONTENT_TYPE, '--cache-control', CACHE_CONTROL]);
}

interface Candidate { readonly filename: string; readonly path: string; readonly sha256: string; readonly bytes: number; }

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(projectRoot, path), 'utf8'));
}

/** Every source-cache-eligible pin this repository knows about for one object: volume previews and nomenclature zips. */
export async function objectSourceCacheCandidates(id: string): Promise<readonly Candidate[]> {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object id.');
  const candidates: Candidate[] = [];

  const presentation = await readJson(`src/objects/${id}/source/presentation.json`).catch(() => null);
  if (presentation && typeof presentation === 'object' && (presentation as Record<string, unknown>).schema === 'cssearth-volume-presentation-source@1') {
    const lenses = (presentation as Record<string, unknown>).lenses;
    if (Array.isArray(lenses)) for (const lens of lenses) {
      const preview = (lens as Record<string, unknown>).preview as Record<string, unknown> | undefined;
      // A sky-band composite has no publisher URL: it is composed here from survey tiles and pinned by its own
      // hash, so mirroring it is what keeps a fresh checkout off the survey archive.
      const addressable = typeof preview?.url === 'string' || (typeof preview?.skyBands === 'object' && preview.skyBands !== null);
      if (preview && addressable && typeof preview.path === 'string' && typeof preview.sha256 === 'string' && typeof preview.bytes === 'number') {
        candidates.push({ filename: basename(preview.path), path: preview.path, sha256: preview.sha256, bytes: preview.bytes });
      }
    }
  }

  const manifest = await readJson(`src/objects/${id}/source/manifest.json`).catch(() => null);
  if (manifest && typeof manifest === 'object') {
    for (const entry of (manifest as Record<string, unknown>).inputs as unknown[] ?? []) {
      const input = entry as Record<string, unknown>;
      if (typeof input.path === 'string' && input.path.endsWith('_nomenclature_center_pts.zip')
        && typeof input.expectedSha256 === 'string' && typeof input.expectedBytes === 'number') {
        candidates.push({ filename: basename(input.path), path: `src/objects/${id}/source/${input.path}`, sha256: input.expectedSha256, bytes: input.expectedBytes });
      }
    }
  }
  return candidates;
}

async function toAsset(candidate: Candidate): Promise<PublishAsset | null> {
  const file = resolve(projectRoot, candidate.path);
  const bytes = await readFile(file).catch(() => null);
  if (!bytes || bytes.length !== candidate.bytes || sha256(bytes) !== candidate.sha256) return null;
  return { key: sourceCacheKey(candidate.sha256, candidate.filename), file, bytes: candidate.bytes, sha256: candidate.sha256 };
}

export async function publishSourceCache(args: readonly string[]): Promise<void> {
  const objectArgs = args.filter(a => a.startsWith('--object='));
  const fileArg = args.find(a => a.startsWith('--file='));
  const shaArg = args.find(a => a.startsWith('--sha256='));
  const bytesArg = args.find(a => a.startsWith('--bytes='));

  const assets: PublishAsset[] = [];
  const skipped: string[] = [];
  if (objectArgs.length) {
    for (const arg of objectArgs) {
      const id = arg.slice('--object='.length);
      const candidates = await objectSourceCacheCandidates(id);
      if (!candidates.length) throw new Error(`${id}: no source-cache-eligible pins found (no volume previews, no nomenclature zip).`);
      for (const candidate of candidates) {
        const asset = await toAsset(candidate);
        if (asset) assets.push(asset); else skipped.push(`${id}/${candidate.filename}`);
      }
    }
  } else if (fileArg) {
    if (!shaArg || !bytesArg) throw new TypeError('Usage: --file=<path> --sha256=<hex> --bytes=<n>');
    const path = fileArg.slice('--file='.length), expectedSha256 = shaArg.slice('--sha256='.length), expectedBytes = Number(bytesArg.slice('--bytes='.length));
    const candidate: Candidate = { filename: basename(path), path, sha256: expectedSha256, bytes: expectedBytes };
    const asset = await toAsset(candidate);
    if (asset) assets.push(asset); else skipped.push(path);
  } else {
    throw new TypeError('Usage: publish-source-cache.mts --object=<id> [...] | --file=<path> --sha256=<hex> --bytes=<n>');
  }

  if (skipped.length) throw new Error(`Not locally present or hash mismatch (restore-source-inputs first): ${skipped.join(', ')}`);
  if (!assets.length) { console.log('Nothing to publish.'); return; }

  console.log(`Publishing ${assets.length} source-cache object(s) (${(assets.reduce((sum, a) => sum + a.bytes, 0) / 1e6).toFixed(1)} MB).`);
  for (const asset of assets) await uploadOne(asset);
  const result = await verifyPublished(assets, { origin: RUNTIME_ASSET_ORIGIN, uploadOne });
  reportVerification(result);
  console.log(`Verified ${assets.length} key(s) live on ${RUNTIME_ASSET_ORIGIN}.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await publishSourceCache(process.argv.slice(2));
}
