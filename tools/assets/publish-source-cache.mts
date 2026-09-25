// Maintainer command: mirror an object's downloaded source inputs into R2 under source-cache/<object id>/<manifest path>,
// addressed the way the manifest names them and additive. Two forms:
//
//   node tools/assets/publish-source-cache.mts --object=<id> [...]
//     Publishes every download this repository knows how to mirror for that object: a volume's publisher previews
//     and sky-band composites (source/presentation.json, under .local/) and every source/manifest.json input with an
//     archive origin. Skips a file that is not present locally (run restore-source-inputs first).
//
//   node tools/assets/publish-source-cache.mts --file=<path> --key=<object id>/<manifest path>
//     Publishes exactly one file under the key a restorer will ask for.
//
// Same verify-after-publish contract as publish-runtime-assets.mts: HEAD every key, retry a miss with a per-key
// `wrangler r2 object put`, byte-verify, exit non-zero on any remaining failure.
import { sha256 } from '@cssearth/core/node';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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

/** A local file and the mirror key a restorer asks for it by. */
interface Candidate { readonly key: string; readonly path: string; }

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(resolve(projectRoot, path), 'utf8'));
}

/** Every mirror-eligible download this repository knows about for one object: volume previews and manifest downloads. */
export async function objectSourceCacheCandidates(id: string): Promise<readonly Candidate[]> {
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new TypeError('Invalid object id.');
  const candidates: Candidate[] = [];

  const presentation = await readJson(`src/objects/${id}/source/presentation.json`).catch(() => null);
  if (presentation && typeof presentation === 'object' && (presentation as Record<string, unknown>).schema === 'cssearth-volume-presentation-source@1') {
    const lenses = (presentation as Record<string, unknown>).lenses;
    if (Array.isArray(lenses)) for (const lens of lenses) {
      const preview = (lens as Record<string, unknown>).preview as Record<string, unknown> | undefined;
      // A sky-band composite has no publisher URL: it is composed here from survey tiles, so mirroring it is what
      // keeps a fresh checkout off the survey archive.
      const addressable = typeof preview?.url === 'string' || (typeof preview?.skyBands === 'object' && preview.skyBands !== null);
      if (preview && addressable && typeof preview.path === 'string' && preview.path.startsWith('.local/')) {
        candidates.push({ key: sourceCacheKey('local', preview.path.slice('.local/'.length)), path: preview.path });
      }
    }
  }

  const manifest = await readJson(`src/objects/${id}/source/manifest.json`).catch(() => null);
  if (manifest && typeof manifest === 'object') {
    const repositoryPaths = (manifest as Record<string, unknown>).pathBase === 'repository';
    for (const entry of (manifest as Record<string, unknown>).inputs as unknown[] ?? []) {
      const input = entry as Record<string, unknown>;
      if (typeof input.path === 'string' && !input.path.startsWith('.local/') && typeof input.origin === 'string' && /^https?:\/\//u.test(input.origin)) {
        candidates.push({ key: sourceCacheKey(id, input.path), path: repositoryPaths ? input.path : `src/objects/${id}/source/${input.path}` });
      }
    }
  }
  return candidates;
}

async function toAsset(candidate: Candidate): Promise<PublishAsset | null> {
  const file = resolve(projectRoot, candidate.path);
  const bytes = await readFile(file).catch(() => null);
  if (!bytes || !bytes.length) return null;
  return { key: candidate.key, file, bytes: bytes.length, sha256: sha256(bytes) };
}

export async function publishSourceCache(args: readonly string[]): Promise<void> {
  const objectArgs = args.filter(a => a.startsWith('--object='));
  const fileArg = args.find(a => a.startsWith('--file='));
  const keyArg = args.find(a => a.startsWith('--key='));

  const assets: PublishAsset[] = [];
  const skipped: string[] = [];
  if (objectArgs.length) {
    for (const arg of objectArgs) {
      const id = arg.slice('--object='.length);
      const candidates = await objectSourceCacheCandidates(id);
      if (!candidates.length) throw new Error(`${id}: no mirror-eligible downloads found (no volume previews, no manifest input with an archive origin).`);
      for (const candidate of candidates) {
        const asset = await toAsset(candidate);
        if (asset) assets.push(asset); else skipped.push(candidate.path);
      }
    }
  } else if (fileArg) {
    if (!keyArg) throw new TypeError('Usage: --file=<path> --key=<object id>/<manifest path>');
    const path = fileArg.slice('--file='.length), [id, ...rest] = keyArg.slice('--key='.length).split('/');
    if (!id || !rest.length) throw new TypeError('Usage: --file=<path> --key=<object id>/<manifest path>');
    const asset = await toAsset({ key: sourceCacheKey(id, rest.join('/')), path });
    if (asset) assets.push(asset); else skipped.push(path);
  } else {
    throw new TypeError('Usage: publish-source-cache.mts --object=<id> [...] | --file=<path> --key=<object id>/<manifest path>');
  }

  if (skipped.length) throw new Error(`Not locally present (restore-source-inputs first): ${skipped.join(', ')}`);
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
